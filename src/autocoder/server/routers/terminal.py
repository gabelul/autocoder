"""
Terminal Router
===============

REST + WebSocket endpoints for interactive terminal sessions.

The UI uses:
- REST for terminal tab CRUD
- WebSocket for bidirectional PTY I/O per terminal id
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, WebSocket
from fastapi.websockets import WebSocketDisconnect
from pydantic import BaseModel, Field

from autocoder.agent.registry import get_project_path
from ..services.terminal_manager import (
    create_terminal,
    delete_terminal,
    get_terminal_info,
    get_terminal_session,
    list_terminals,
    rename_terminal,
    stop_terminal_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_name}/terminal", tags=["terminal"])


class TerminalCloseCode:
    INVALID_PROJECT_NAME = 4000
    INVALID_TERMINAL_ID = 4001
    PROJECT_NOT_FOUND = 4004
    TERMINAL_NOT_FOUND = 4005
    FAILED_TO_START = 4500


def _validate_project_name(name: str) -> None:
    if not re.match(r"^[a-zA-Z0-9_-]{1,50}$", name):
        raise HTTPException(status_code=400, detail="Invalid project name")


def _validate_terminal_id(terminal_id: str) -> None:
    if not re.match(r"^[a-zA-Z0-9]{1,16}$", terminal_id):
        raise HTTPException(status_code=400, detail="Invalid terminal id")


def _project_dir(project_name: str) -> Path:
    _validate_project_name(project_name)
    p = get_project_path(project_name)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found in registry")
    d = Path(p).resolve()
    if not d.exists():
        raise HTTPException(status_code=404, detail="Project directory not found")
    return d


class TerminalInfoResponse(BaseModel):
    id: str
    name: str
    created_at: str


class CreateTerminalRequest(BaseModel):
    name: str | None = None


class RenameTerminalRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@router.get("", response_model=list[TerminalInfoResponse])
async def list_project_terminals(project_name: str) -> list[TerminalInfoResponse]:
    _project_dir(project_name)
    terminals = list_terminals(project_name)
    return [TerminalInfoResponse(id=t.id, name=t.name, created_at=t.created_at) for t in terminals]


@router.post("", response_model=TerminalInfoResponse)
async def create_project_terminal(project_name: str, req: CreateTerminalRequest = CreateTerminalRequest()) -> TerminalInfoResponse:
    _project_dir(project_name)
    info = create_terminal(project_name, req.name)
    return TerminalInfoResponse(id=info.id, name=info.name, created_at=info.created_at)


@router.get("/{terminal_id}", response_model=TerminalInfoResponse)
async def get_project_terminal(project_name: str, terminal_id: str) -> TerminalInfoResponse:
    _project_dir(project_name)
    _validate_terminal_id(terminal_id)
    info = get_terminal_info(project_name, terminal_id)
    if not info:
        raise HTTPException(status_code=404, detail="Terminal not found")
    return TerminalInfoResponse(id=info.id, name=info.name, created_at=info.created_at)


@router.patch("/{terminal_id}", response_model=TerminalInfoResponse)
async def rename_project_terminal(project_name: str, terminal_id: str, req: RenameTerminalRequest) -> TerminalInfoResponse:
    _project_dir(project_name)
    _validate_terminal_id(terminal_id)
    ok = rename_terminal(project_name, terminal_id, req.name)
    if not ok:
        raise HTTPException(status_code=404, detail="Terminal not found")
    info = get_terminal_info(project_name, terminal_id)
    assert info is not None
    return TerminalInfoResponse(id=info.id, name=info.name, created_at=info.created_at)


@router.delete("/{terminal_id}")
async def delete_project_terminal(project_name: str, terminal_id: str) -> dict:
    _project_dir(project_name)
    _validate_terminal_id(terminal_id)
    await stop_terminal_session(project_name, terminal_id)
    ok = delete_terminal(project_name, terminal_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Terminal not found")
    return {"ok": True}


async def terminal_websocket(websocket: WebSocket, project_name: str, terminal_id: str) -> None:
    """
    WebSocket endpoint: `/ws/projects/{project_name}/terminal/{terminal_id}`

    Client -> Server:
    - {"type": "input", "data": "<base64>"} (64KB limit)
    - {"type": "resize", "cols": 80, "rows": 24}
    - {"type": "ping"}

    Server -> Client:
    - {"type": "output", "data": "<base64>"}
    - {"type": "exit", "code": 0}
    - {"type": "pong"}
    - {"type": "error", "message": "..."}
    """
    if not re.match(r"^[a-zA-Z0-9_-]{1,50}$", project_name):
        await websocket.close(code=TerminalCloseCode.INVALID_PROJECT_NAME, reason="Invalid project name")
        return
    if not re.match(r"^[a-zA-Z0-9]{1,16}$", terminal_id):
        await websocket.close(code=TerminalCloseCode.INVALID_TERMINAL_ID, reason="Invalid terminal id")
        return

    project_dir = get_project_path(project_name)
    if not project_dir:
        await websocket.close(code=TerminalCloseCode.PROJECT_NOT_FOUND, reason="Project not found in registry")
        return

    project_dir_p = Path(project_dir).resolve()
    if not project_dir_p.exists():
        await websocket.close(code=TerminalCloseCode.PROJECT_NOT_FOUND, reason="Project directory not found")
        return

    if not get_terminal_info(project_name, terminal_id):
        await websocket.close(code=TerminalCloseCode.TERMINAL_NOT_FOUND, reason="Terminal not found")
        return

    await websocket.accept()

    session = get_terminal_session(project_name, project_dir_p, terminal_id)
    output_queue: asyncio.Queue[bytes] = asyncio.Queue()

    def on_output(data: bytes) -> None:
        try:
            output_queue.put_nowait(data)
        except asyncio.QueueFull:
            pass

    session.add_output_callback(on_output)

    if not session.is_active:
        started = await session.start()
        if not started:
            session.remove_output_callback(on_output)
            with contextlib.suppress(Exception):
                await websocket.send_json({"type": "error", "message": "Failed to start terminal session"})
            await websocket.close(code=TerminalCloseCode.FAILED_TO_START, reason="Failed to start terminal")
            return

    async def send_output_task() -> None:
        while True:
            data = await output_queue.get()
            encoded = base64.b64encode(data).decode("ascii")
            await websocket.send_json({"type": "output", "data": encoded})

    async def monitor_exit_task() -> None:
        while session.is_active:
            await asyncio.sleep(0.5)
        await websocket.send_json({"type": "exit", "code": 0})

    output_task = asyncio.create_task(send_output_task())
    exit_task = asyncio.create_task(monitor_exit_task())

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = message.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type == "input":
                encoded_data = message.get("data", "")
                if not isinstance(encoded_data, str) or len(encoded_data) > 65536:
                    await websocket.send_json({"type": "error", "message": "Input too large"})
                    continue
                if encoded_data:
                    try:
                        decoded = base64.b64decode(encoded_data)
                    except Exception:
                        await websocket.send_json({"type": "error", "message": "Invalid base64 data"})
                        continue
                    session.write(decoded)
                continue

            if msg_type == "resize":
                cols = message.get("cols", 80)
                rows = message.get("rows", 24)
                if isinstance(cols, int) and isinstance(rows, int):
                    cols = max(10, min(500, cols))
                    rows = max(5, min(200, rows))
                    session.resize(cols, rows)
                else:
                    await websocket.send_json({"type": "error", "message": "Invalid resize dimensions"})
                continue

            await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info(f"Terminal WebSocket disconnected for {project_name}/{terminal_id}")
    except Exception as e:
        logger.warning(f"Terminal WebSocket error for {project_name}/{terminal_id}: {e}")
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": "Server error"})
    finally:
        output_task.cancel()
        exit_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await output_task
        with contextlib.suppress(asyncio.CancelledError):
            await exit_task

        session.remove_output_callback(on_output)

        # Stop session if last client disconnects (best-effort).
        remaining = session.output_callback_count()
        if remaining == 0:
            with contextlib.suppress(Exception):
                await session.stop()

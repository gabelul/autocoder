"""
Terminal Manager
================

Interactive terminal sessions for the Web UI.

Implementation notes:
- Uses ConPTY via `pywinpty` on Windows (imported as `winpty`).
- Uses the built-in `pty` module on Unix.
- Sessions are keyed by (project_name, terminal_id) and kept in-memory.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import platform
import shutil
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Set

logger = logging.getLogger(__name__)


@dataclass
class TerminalInfo:
    id: str
    name: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


IS_WINDOWS = platform.system() == "Windows"

if IS_WINDOWS:
    try:
        from winpty import PtyProcess as WinPtyProcess  # type: ignore[import-not-found]

        WINPTY_AVAILABLE = True
    except Exception:
        WinPtyProcess = None  # type: ignore[assignment]
        WINPTY_AVAILABLE = False
        logger.warning(
            "pywinpty not installed. Terminal sessions won't be available on Windows. "
            "Install with: pip install pywinpty"
        )
else:
    import fcntl
    import pty
    import select
    import signal
    import struct
    import termios

    WINPTY_AVAILABLE = False


def _get_shell() -> str:
    if IS_WINDOWS:
        for candidate in ("pwsh.exe", "powershell.exe", "cmd.exe"):
            found = shutil.which(candidate)
            if found:
                return found
        return "cmd.exe"

    shell = os.environ.get("SHELL")
    if shell and shutil.which(shell):
        return shell
    for fallback in ("/bin/bash", "/bin/sh"):
        if os.path.exists(fallback):
            return fallback
    return "/bin/sh"


class TerminalSession:
    def __init__(self, project_name: str, project_dir: Path):
        self.project_name = project_name
        self.project_dir = Path(project_dir).resolve()

        self._pty_process: "WinPtyProcess | None" = None
        self._master_fd: int | None = None
        self._child_pid: int | None = None

        self._is_active = False
        self._output_task: asyncio.Task | None = None

        self._output_callbacks: Set[Callable[[bytes], None]] = set()
        self._callbacks_lock = threading.Lock()

    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def pid(self) -> int | None:
        if IS_WINDOWS:
            if self._pty_process is not None:
                try:
                    return int(self._pty_process.pid)
                except Exception:
                    return None
            return None
        return self._child_pid

    def add_output_callback(self, callback: Callable[[bytes], None]) -> None:
        with self._callbacks_lock:
            self._output_callbacks.add(callback)

    def remove_output_callback(self, callback: Callable[[bytes], None]) -> None:
        with self._callbacks_lock:
            self._output_callbacks.discard(callback)

    def output_callback_count(self) -> int:
        with self._callbacks_lock:
            return len(self._output_callbacks)

    def _broadcast_output(self, data: bytes) -> None:
        with self._callbacks_lock:
            callbacks = list(self._output_callbacks)
        for cb in callbacks:
            try:
                cb(data)
            except Exception:
                pass

    async def start(self) -> bool:
        if self._is_active:
            return True

        shell = _get_shell()

        try:
            if IS_WINDOWS:
                if not WINPTY_AVAILABLE:
                    return False
                assert WinPtyProcess is not None
                self._pty_process = WinPtyProcess.spawn(
                    shell,
                    cwd=str(self.project_dir),
                    env=os.environ.copy(),
                )
            else:
                master_fd, slave_fd = pty.openpty()
                pid = os.fork()
                if pid == 0:
                    # Child
                    try:
                        os.setsid()
                    except Exception:
                        pass
                    os.close(master_fd)
                    os.dup2(slave_fd, 0)
                    os.dup2(slave_fd, 1)
                    os.dup2(slave_fd, 2)
                    if slave_fd > 2:
                        os.close(slave_fd)
                    os.chdir(str(self.project_dir))
                    os.execvp(shell, [shell])
                else:
                    # Parent
                    os.close(slave_fd)
                    self._master_fd = master_fd
                    self._child_pid = pid

            self._is_active = True
            self._output_task = asyncio.create_task(self._read_output())
            logger.info(f"Terminal started for {self.project_name}")
            return True
        except Exception as e:
            logger.warning(f"Failed to start terminal for {self.project_name}: {e}")
            self._is_active = False
            return False

    async def _read_output(self) -> None:
        if IS_WINDOWS:
            await self._read_output_windows()
        else:
            await self._read_output_unix()

    async def _read_output_windows(self) -> None:
        if self._pty_process is None:
            return
        try:
            while self._is_active and self._pty_process is not None:
                try:
                    data = self._pty_process.read(4096)
                    if data:
                        if isinstance(data, str):
                            data = data.encode("utf-8", errors="replace")
                        self._broadcast_output(data)
                    else:
                        if self._pty_process is None or not self._pty_process.isalive():
                            break
                        await asyncio.sleep(0.01)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    if self._is_active:
                        logger.debug(f"Windows PTY read error: {e}")
                    break
        except asyncio.CancelledError:
            pass
        finally:
            if self._is_active:
                self._is_active = False

    async def _read_output_unix(self) -> None:
        if self._master_fd is None:
            return

        loop = asyncio.get_running_loop()
        try:
            while self._is_active and self._master_fd is not None:
                def read_with_select() -> bytes:
                    if self._master_fd is None:
                        return b""
                    try:
                        readable, _, _ = select.select([self._master_fd], [], [], 0.1)
                        if readable:
                            return os.read(self._master_fd, 4096)
                        return b""
                    except (OSError, ValueError):
                        return b""

                data = await loop.run_in_executor(None, read_with_select)
                if data:
                    self._broadcast_output(data)
                elif not self._check_child_alive():
                    break
        except asyncio.CancelledError:
            pass
        finally:
            if self._is_active:
                self._is_active = False
            if self._child_pid is not None:
                try:
                    os.waitpid(self._child_pid, os.WNOHANG)
                except Exception:
                    pass

    def _check_child_alive(self) -> bool:
        if self._child_pid is None:
            return False
        try:
            os.kill(self._child_pid, 0)
            return True
        except OSError:
            return False

    def write(self, data: bytes) -> None:
        if not self._is_active:
            return
        try:
            if IS_WINDOWS:
                if self._pty_process is not None:
                    self._pty_process.write(data.decode("utf-8", errors="replace"))
            else:
                if self._master_fd is not None:
                    os.write(self._master_fd, data)
        except Exception:
            pass

    def resize(self, cols: int, rows: int) -> None:
        if not self._is_active:
            return
        try:
            if IS_WINDOWS:
                if self._pty_process is not None:
                    self._pty_process.setwinsize(rows, cols)
            else:
                if self._master_fd is not None:
                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                    fcntl.ioctl(self._master_fd, termios.TIOCSWINSZ, winsize)  # type: ignore[attr-defined]
        except Exception:
            pass

    async def stop(self) -> None:
        if not self._is_active:
            return
        self._is_active = False

        if self._output_task is not None:
            self._output_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._output_task
            self._output_task = None

        try:
            if IS_WINDOWS:
                await self._stop_windows()
            else:
                await self._stop_unix()
        except Exception:
            pass

    async def _stop_windows(self) -> None:
        if self._pty_process is None:
            return
        try:
            if self._pty_process.isalive():
                self._pty_process.terminate()
                await asyncio.sleep(0.1)
                if self._pty_process.isalive():
                    self._pty_process.kill()
        finally:
            self._pty_process = None

    async def _stop_unix(self) -> None:
        if self._master_fd is not None:
            with contextlib.suppress(Exception):
                os.close(self._master_fd)
            self._master_fd = None

        if self._child_pid is not None:
            try:
                os.kill(self._child_pid, signal.SIGTERM)
                await asyncio.sleep(0.1)
                with contextlib.suppress(Exception):
                    os.kill(self._child_pid, signal.SIGKILL)  # type: ignore[attr-defined]
                with contextlib.suppress(Exception):
                    os.waitpid(self._child_pid, 0)
            finally:
                self._child_pid = None


_sessions: dict[str, dict[str, TerminalSession]] = {}
_sessions_lock = threading.Lock()

_terminal_metadata: dict[str, list[TerminalInfo]] = {}
_metadata_lock = threading.Lock()


def create_terminal(project_name: str, name: str | None = None) -> TerminalInfo:
    with _metadata_lock:
        terminals = _terminal_metadata.setdefault(project_name, [])

        if name is None or not name.strip():
            nums: list[int] = []
            for t in terminals:
                if t.name.startswith("Terminal "):
                    with contextlib.suppress(Exception):
                        nums.append(int(t.name.replace("Terminal ", "")))
            name = f"Terminal {max(nums, default=0) + 1}"

        terminal_id = str(uuid.uuid4())[:8]
        info = TerminalInfo(id=terminal_id, name=name)
        terminals.append(info)
        return info


def list_terminals(project_name: str) -> list[TerminalInfo]:
    with _metadata_lock:
        return list(_terminal_metadata.get(project_name, []))


def get_terminal_info(project_name: str, terminal_id: str) -> TerminalInfo | None:
    with _metadata_lock:
        for t in _terminal_metadata.get(project_name, []):
            if t.id == terminal_id:
                return t
    return None


def rename_terminal(project_name: str, terminal_id: str, new_name: str) -> bool:
    new_name = (new_name or "").strip()
    if not new_name:
        return False
    with _metadata_lock:
        for t in _terminal_metadata.get(project_name, []):
            if t.id == terminal_id:
                t.name = new_name
                return True
    return False


def delete_terminal(project_name: str, terminal_id: str) -> bool:
    with _metadata_lock:
        terminals = _terminal_metadata.get(project_name, [])
        for i, t in enumerate(terminals):
            if t.id == terminal_id:
                terminals.pop(i)
                break
        else:
            return False

    with _sessions_lock:
        project_sessions = _sessions.get(project_name, {})
        if terminal_id in project_sessions:
            del project_sessions[terminal_id]
    return True


def get_terminal_session(project_name: str, project_dir: Path, terminal_id: str | None = None) -> TerminalSession:
    if terminal_id is None:
        terminals = list_terminals(project_name)
        if not terminals:
            terminal_id = create_terminal(project_name).id
        else:
            terminal_id = terminals[0].id

    with _sessions_lock:
        project_sessions = _sessions.setdefault(project_name, {})
        if terminal_id not in project_sessions:
            project_sessions[terminal_id] = TerminalSession(project_name, project_dir)
        return project_sessions[terminal_id]


async def stop_terminal_session(project_name: str, terminal_id: str) -> None:
    with _sessions_lock:
        session = _sessions.get(project_name, {}).get(terminal_id)
    if session and session.is_active:
        await session.stop()


async def cleanup_all_terminals() -> None:
    with _sessions_lock:
        sessions = []
        for project_sessions in _sessions.values():
            sessions.extend(project_sessions.values())
        _sessions.clear()

    for s in sessions:
        with contextlib.suppress(Exception):
            if s.is_active:
                await s.stop()

    with _metadata_lock:
        _terminal_metadata.clear()

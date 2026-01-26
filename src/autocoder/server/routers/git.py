"""
Git Router
==========

Endpoints to surface git working-tree state in the UI and provide safe remediation actions.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from autocoder.core.git_dirty import get_git_dirty_status


def _get_project_path(project_name: str) -> Path:
    from autocoder.agent.registry import get_project_path

    return get_project_path(project_name)


router = APIRouter(prefix="/api/projects/{project_name}/git", tags=["git"])


def validate_project_name(name: str) -> str:
    if not re.match(r"^[a-zA-Z0-9_-]{1,50}$", name):
        raise HTTPException(status_code=400, detail="Invalid project name")
    return name


def _require_project_dir(project_name: str) -> Path:
    project_name = validate_project_name(project_name)
    project_dir = _get_project_path(project_name)
    if not project_dir:
        raise HTTPException(
            status_code=404, detail=f"Project '{project_name}' not found in registry"
        )
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project directory not found: {project_dir}")
    return Path(project_dir)


class GitStatusResponse(BaseModel):
    is_clean: bool
    ignored: list[str] = Field(default_factory=list)
    remaining: list[str] = Field(default_factory=list)


class GitStashRequest(BaseModel):
    include_untracked: bool = True
    message: str = "autocoder-ui: stash before parallel run"


class GitStashResponse(BaseModel):
    success: bool
    message: str


@router.get("/status", response_model=GitStatusResponse)
async def git_status(project_name: str) -> GitStatusResponse:
    project_dir = _require_project_dir(project_name)
    st = get_git_dirty_status(project_dir)
    return GitStatusResponse(is_clean=st.is_clean, ignored=st.ignored, remaining=st.remaining)


@router.post("/stash", response_model=GitStashResponse)
async def git_stash(
    project_name: str, req: GitStashRequest = GitStashRequest()
) -> GitStashResponse:
    project_dir = _require_project_dir(project_name)

    args = ["git", "stash", "push", "-m", str(req.message)]
    if req.include_untracked:
        args.append("-u")

    proc = subprocess.run(
        args,
        cwd=str(project_dir),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    if proc.returncode != 0:
        raise HTTPException(
            status_code=400,
            detail=f"git stash failed: {(err or out) or 'unknown error'}",
        )

    # Common outputs:
    # - "Saved working directory and index state WIP on main: ..."
    # - "No local changes to save"
    msg = out or err or "ok"
    return GitStashResponse(success=True, message=msg)

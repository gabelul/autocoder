"""
Activity Router
===============

"Mission Control" timeline feed for a project.

Backed by the project's `agent_system.db` (`activity_events` table).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from autocoder.core.database import get_database
from ..schemas import ActivityEvent, ActivityClearResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects/{project_name}/activity", tags=["activity"])


def _get_project_path(project_name: str) -> Path:
    """Get project path from registry."""
    from autocoder.agent.registry import get_project_path

    p = get_project_path(project_name)
    if not p:
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found in registry")
    return Path(p)


def validate_project_name(name: str) -> str:
    """Validate and sanitize project name to prevent path traversal."""
    if not re.match(r"^[a-zA-Z0-9_-]{1,50}$", name):
        raise HTTPException(status_code=400, detail="Invalid project name")
    return name


@router.get("", response_model=list[ActivityEvent])
async def list_activity_events(
    project_name: str,
    limit: int = Query(default=200, ge=1, le=1000),
    after_id: int | None = Query(default=None, ge=1),
):
    """
    List activity events for a project (chronological).

    Use `after_id` to poll incrementally.
    """
    validate_project_name(project_name)
    project_dir = _get_project_path(project_name).resolve()
    db = get_database(str(project_dir))
    return db.get_activity_events(limit=limit, after_id=after_id)


@router.post("/clear", response_model=ActivityClearResponse)
async def clear_activity_events(project_name: str):
    """Clear all activity events for a project."""
    validate_project_name(project_name)
    project_dir = _get_project_path(project_name).resolve()
    db = get_database(str(project_dir))
    deleted = db.clear_activity_events()
    logger.info("Cleared activity events for %s: deleted=%s", project_name, deleted)
    return ActivityClearResponse(deleted=deleted)


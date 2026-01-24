"""
Project Settings Router
======================

Project-scoped settings stored in the project's `agent_system.db`.

These settings travel with the project and are applied by the UI when spawning
agent/orchestrator subprocesses (and can also affect CLI runs).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from autocoder.agent.registry import get_project_path
from autocoder.core.project_run_defaults import (
    ProjectRunDefaults,
    load_project_run_defaults,
    save_project_run_defaults,
)
from autocoder.core.project_runtime_settings import (
    ProjectRuntimeSettings,
    load_project_runtime_settings,
    save_project_runtime_settings,
)
from autocoder.server.settings_store import load_advanced_settings


router = APIRouter(prefix="/api/projects/{project_name}/settings", tags=["project-settings"])

RunMode = Literal["standard", "parallel"]
ParallelPreset = Literal["quality", "balanced", "economy", "cheap", "experimental", "custom"]


def _project_dir(project_name: str) -> Path:
    if not re.match(r"^[a-zA-Z0-9_-]{1,50}$", project_name):
        raise HTTPException(status_code=400, detail="Invalid project name")
    path = get_project_path(project_name)
    if not path:
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found in registry")
    project_dir = Path(path).resolve()
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project directory not found: {project_dir}")
    return project_dir


class ProjectRunDefaultsModel(BaseModel):
    yolo_mode: bool = False
    mode: RunMode = Field(default="standard")
    parallel_count: int = Field(default=3, ge=1, le=5)
    model_preset: ParallelPreset = Field(default="balanced")

    @model_validator(mode="after")
    def _validate(self) -> "ProjectRunDefaultsModel":
        if self.yolo_mode and self.mode == "parallel":
            # Parallel + YOLO are mutually exclusive; force Standard.
            self.mode = "standard"
        return self

    def to_core(self) -> ProjectRunDefaults:
        return ProjectRunDefaults(
            yolo_mode=bool(self.yolo_mode),
            mode=self.mode,
            parallel_count=int(self.parallel_count),
            model_preset=self.model_preset,
        )

    @staticmethod
    def from_core(v: ProjectRunDefaults) -> "ProjectRunDefaultsModel":
        return ProjectRunDefaultsModel(
            yolo_mode=bool(v.yolo_mode),
            mode=v.mode,
            parallel_count=int(v.parallel_count),
            model_preset=v.model_preset,
        )


class ProjectRuntimeSettingsModel(BaseModel):
    # Planner
    planner_enabled: bool = False
    planner_required: bool = False

    # Gatekeeper behavior
    require_gatekeeper: bool = True
    allow_no_tests: bool = False
    stop_when_done: bool = True

    # Coordination / worker behavior
    locks_enabled: bool = True
    worker_verify: bool = True

    def to_core(self) -> ProjectRuntimeSettings:
        return ProjectRuntimeSettings(
            planner_enabled=bool(self.planner_enabled),
            planner_required=bool(self.planner_required),
            require_gatekeeper=bool(self.require_gatekeeper),
            allow_no_tests=bool(self.allow_no_tests),
            stop_when_done=bool(self.stop_when_done),
            locks_enabled=bool(self.locks_enabled),
            worker_verify=bool(self.worker_verify),
        )

    @staticmethod
    def from_core(v: ProjectRuntimeSettings) -> "ProjectRuntimeSettingsModel":
        return ProjectRuntimeSettingsModel(
            planner_enabled=bool(v.planner_enabled),
            planner_required=bool(v.planner_required),
            require_gatekeeper=bool(v.require_gatekeeper),
            allow_no_tests=bool(v.allow_no_tests),
            stop_when_done=bool(v.stop_when_done),
            locks_enabled=bool(v.locks_enabled),
            worker_verify=bool(v.worker_verify),
        )


@router.get("/run-defaults", response_model=ProjectRunDefaultsModel)
async def get_project_run_defaults(project_name: str):
    project_dir = _project_dir(project_name)
    defaults = load_project_run_defaults(project_dir)
    return ProjectRunDefaultsModel.from_core(defaults)


@router.put("/run-defaults", response_model=ProjectRunDefaultsModel)
async def put_project_run_defaults(project_name: str, payload: ProjectRunDefaultsModel):
    project_dir = _project_dir(project_name)
    defaults = payload.to_core()
    save_project_run_defaults(project_dir, defaults)
    return payload


@router.get("/runtime", response_model=ProjectRuntimeSettingsModel)
async def get_project_runtime_settings(project_name: str):
    project_dir = _project_dir(project_name)
    stored = load_project_runtime_settings(project_dir)
    if stored:
        return ProjectRuntimeSettingsModel.from_core(stored)

    # If a project hasn't stored runtime settings yet, inherit the global UI advanced defaults.
    base = load_advanced_settings()
    inherited = ProjectRuntimeSettings(
        planner_enabled=bool(base.planner_enabled),
        planner_required=bool(base.planner_required),
        require_gatekeeper=bool(base.require_gatekeeper),
        allow_no_tests=bool(base.allow_no_tests),
        stop_when_done=bool(base.stop_when_done),
        locks_enabled=bool(base.locks_enabled),
        worker_verify=bool(base.worker_verify),
    )
    return ProjectRuntimeSettingsModel.from_core(inherited)


@router.put("/runtime", response_model=ProjectRuntimeSettingsModel)
async def put_project_runtime_settings(project_name: str, payload: ProjectRuntimeSettingsModel):
    project_dir = _project_dir(project_name)
    settings = payload.to_core()
    save_project_runtime_settings(project_dir, settings)
    return payload


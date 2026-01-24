"""
Project Runtime Settings
=======================

Project-scoped runtime settings stored in the project's `agent_system.db`.

These settings are intended to "travel with the project" and override global UI
advanced settings when the Web UI spawns agent/orchestrator subprocesses.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .database import get_database


PROJECT_RUNTIME_SETTINGS_KEY = "project_runtime_settings_v1"


@dataclass(frozen=True)
class ProjectRuntimeSettings:
    # Only include settings that should be project-scoped (not UI server bind options).
    planner_enabled: bool
    planner_required: bool

    require_gatekeeper: bool
    allow_no_tests: bool
    stop_when_done: bool

    locks_enabled: bool
    worker_verify: bool

    def to_env(self) -> dict[str, str]:
        planner_enabled = bool(self.planner_enabled or self.planner_required)
        return {
            "AUTOCODER_PLANNER_ENABLED": "1" if planner_enabled else "0",
            "AUTOCODER_PLANNER_REQUIRED": "1" if self.planner_required else "0",
            "AUTOCODER_REQUIRE_GATEKEEPER": "1" if self.require_gatekeeper else "0",
            "AUTOCODER_ALLOW_NO_TESTS": "1" if self.allow_no_tests else "0",
            "AUTOCODER_STOP_WHEN_DONE": "1" if self.stop_when_done else "0",
            "AUTOCODER_LOCKS_ENABLED": "1" if self.locks_enabled else "0",
            "AUTOCODER_WORKER_VERIFY": "1" if self.worker_verify else "0",
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "planner_enabled": bool(self.planner_enabled),
            "planner_required": bool(self.planner_required),
            "require_gatekeeper": bool(self.require_gatekeeper),
            "allow_no_tests": bool(self.allow_no_tests),
            "stop_when_done": bool(self.stop_when_done),
            "locks_enabled": bool(self.locks_enabled),
            "worker_verify": bool(self.worker_verify),
        }

    @staticmethod
    def defaults() -> "ProjectRuntimeSettings":
        return ProjectRuntimeSettings(
            planner_enabled=False,
            planner_required=False,
            require_gatekeeper=True,
            allow_no_tests=False,
            stop_when_done=True,
            locks_enabled=True,
            worker_verify=True,
        )


def load_project_runtime_settings(project_dir: str | Path) -> ProjectRuntimeSettings | None:
    """
    Load project runtime settings from the project DB.

    Returns None when settings were never stored for this project.
    """
    p = Path(project_dir).resolve()
    db = get_database(str(p))
    raw = db.get_project_setting(PROJECT_RUNTIME_SETTINGS_KEY)
    if not raw or not isinstance(raw, dict):
        return None

    defaults = ProjectRuntimeSettings.defaults().to_dict()
    merged: dict[str, Any] = {**defaults, **raw}
    try:
        return ProjectRuntimeSettings(
            planner_enabled=bool(merged.get("planner_enabled", False)),
            planner_required=bool(merged.get("planner_required", False)),
            require_gatekeeper=bool(merged.get("require_gatekeeper", True)),
            allow_no_tests=bool(merged.get("allow_no_tests", False)),
            stop_when_done=bool(merged.get("stop_when_done", True)),
            locks_enabled=bool(merged.get("locks_enabled", True)),
            worker_verify=bool(merged.get("worker_verify", True)),
        )
    except Exception:
        return None


def save_project_runtime_settings(project_dir: str | Path, settings: ProjectRuntimeSettings) -> None:
    p = Path(project_dir).resolve()
    db = get_database(str(p))
    db.set_project_setting(PROJECT_RUNTIME_SETTINGS_KEY, settings.to_dict())


def apply_project_runtime_settings_env(
    project_dir: str | Path,
    env: dict[str, str],
    *,
    override_existing: bool,
) -> dict[str, str]:
    """
    Apply project-scoped runtime settings to an env mapping.

    If no project runtime settings were stored, returns env unchanged.

    Args:
        override_existing: When True, project settings override existing env vars.
            This is appropriate for the Web UI, where we want project settings to
            take precedence over global UI advanced settings defaults.
    """
    settings = load_project_runtime_settings(project_dir)
    if not settings:
        return env

    for k, v in settings.to_env().items():
        if override_existing or not env.get(k):
            env[k] = v
    return env


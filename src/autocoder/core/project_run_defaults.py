"""
Project Run Defaults
====================

Project-scoped "next start" defaults used by the Web UI (run mode, parallel count/preset, YOLO).

Stored in the project's `agent_system.db` so these defaults travel with the project.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .database import get_database


PROJECT_RUN_DEFAULTS_KEY = "project_run_defaults_v1"

RunMode = Literal["standard", "parallel"]
ParallelPreset = Literal["quality", "balanced", "economy", "cheap", "experimental", "custom"]


@dataclass(frozen=True)
class ProjectRunDefaults:
    yolo_mode: bool
    mode: RunMode
    parallel_count: int
    model_preset: ParallelPreset

    def to_dict(self) -> dict[str, Any]:
        return {
            "yolo_mode": bool(self.yolo_mode),
            "mode": str(self.mode),
            "parallel_count": int(self.parallel_count),
            "model_preset": str(self.model_preset),
        }

    @staticmethod
    def defaults() -> "ProjectRunDefaults":
        return ProjectRunDefaults(
            yolo_mode=False,
            mode="standard",
            parallel_count=3,
            model_preset="balanced",
        )


def _clamp_parallel_count(v: Any) -> int:
    try:
        n = int(v)
    except Exception:
        return 3
    if n < 1:
        return 1
    if n > 5:
        return 5
    return n


def load_project_run_defaults(project_dir: str | Path) -> ProjectRunDefaults:
    p = Path(project_dir).resolve()
    db = get_database(str(p))
    raw = db.get_project_setting(PROJECT_RUN_DEFAULTS_KEY)
    defaults = ProjectRunDefaults.defaults()
    if not raw or not isinstance(raw, dict):
        return defaults

    yolo_mode = bool(raw.get("yolo_mode", defaults.yolo_mode))
    mode = str(raw.get("mode", defaults.mode)).strip().lower()
    if mode not in ("standard", "parallel"):
        mode = defaults.mode

    preset = str(raw.get("model_preset", defaults.model_preset)).strip().lower()
    if preset not in ("quality", "balanced", "economy", "cheap", "experimental", "custom"):
        preset = defaults.model_preset

    parallel_count = _clamp_parallel_count(raw.get("parallel_count", defaults.parallel_count))

    # Parallel + YOLO are mutually exclusive.
    if yolo_mode:
        mode = "standard"

    return ProjectRunDefaults(
        yolo_mode=yolo_mode,
        mode=mode,  # type: ignore[arg-type]
        parallel_count=parallel_count,
        model_preset=preset,  # type: ignore[arg-type]
    )


def save_project_run_defaults(project_dir: str | Path, defaults: ProjectRunDefaults) -> None:
    p = Path(project_dir).resolve()
    db = get_database(str(p))
    db.set_project_setting(PROJECT_RUN_DEFAULTS_KEY, defaults.to_dict())


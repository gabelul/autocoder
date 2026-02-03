"""
Agent implementation for AutoCoder.

This module contains the agent session management and SDK client:
- agent: Main agent session loop
- client: Claude SDK client configuration with security hooks
- prompts: Prompt template loading
- progress: Progress tracking
- registry: Project name → path mapping
- security: Command validation whitelist
"""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING, Any

_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "run_autonomous_agent": ("autocoder.agent.agent", "run_autonomous_agent"),
    "ClaudeSDKClient": ("autocoder.agent.client", "ClaudeSDKClient"),
    "scaffold_project_prompts": ("autocoder.agent.prompts", "scaffold_project_prompts"),
    "has_project_prompts": ("autocoder.agent.prompts", "has_project_prompts"),
    "get_project_prompts_dir": ("autocoder.agent.prompts", "get_project_prompts_dir"),
    "register_project": ("autocoder.agent.registry", "register_project"),
    "get_project_path": ("autocoder.agent.registry", "get_project_path"),
    "list_registered_projects": ("autocoder.agent.registry", "list_registered_projects"),
    "ALLOWED_COMMANDS": ("autocoder.agent.security", "ALLOWED_COMMANDS"),
}

__all__ = [
    "run_autonomous_agent",
    "ClaudeSDKClient",
    "scaffold_project_prompts",
    "has_project_prompts",
    "get_project_prompts_dir",
    "register_project",
    "get_project_path",
    "list_registered_projects",
    "ALLOWED_COMMANDS",
]

if TYPE_CHECKING:
    from autocoder.agent.agent import run_autonomous_agent as run_autonomous_agent
    from autocoder.agent.client import ClaudeSDKClient as ClaudeSDKClient
    from autocoder.agent.prompts import (
        scaffold_project_prompts as scaffold_project_prompts,
    )
    from autocoder.agent.prompts import has_project_prompts as has_project_prompts
    from autocoder.agent.prompts import get_project_prompts_dir as get_project_prompts_dir
    from autocoder.agent.registry import register_project as register_project
    from autocoder.agent.registry import get_project_path as get_project_path
    from autocoder.agent.registry import list_registered_projects as list_registered_projects
    from autocoder.agent.security import ALLOWED_COMMANDS as ALLOWED_COMMANDS


def __getattr__(name: str) -> Any:
    spec = _LAZY_EXPORTS.get(name)
    if not spec:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module_name, attr_name = spec
    module = importlib.import_module(module_name)
    value = getattr(module, attr_name)
    globals()[name] = value  # Cache for future access
    return value


def __dir__() -> list[str]:
    return sorted(list(globals().keys()) + list(_LAZY_EXPORTS.keys()))

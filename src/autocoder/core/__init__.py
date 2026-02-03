"""
Core system components for AutoCoder.

This module contains the core parallel agent coordination system:
- Orchestrator: Coordinates multiple parallel agents
- Gatekeeper: Verifies and merges code changes
- WorktreeManager: Manages git worktrees for isolation
- KnowledgeBase: Learns from patterns across iterations
- ModelSettings: Model selection and configuration
- TestFrameworkDetector: Auto-detects testing frameworks
- Database: SQLite database wrapper
"""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING, Any

_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "Orchestrator": ("autocoder.core.orchestrator", "Orchestrator"),
    "create_orchestrator": ("autocoder.core.orchestrator", "create_orchestrator"),
    "Gatekeeper": ("autocoder.core.gatekeeper", "Gatekeeper"),
    "WorktreeManager": ("autocoder.core.worktree_manager", "WorktreeManager"),
    "KnowledgeBase": ("autocoder.core.knowledge_base", "KnowledgeBase"),
    "get_knowledge_base": ("autocoder.core.knowledge_base", "get_knowledge_base"),
    "ModelSettings": ("autocoder.core.model_settings", "ModelSettings"),
    "ModelPreset": ("autocoder.core.model_settings", "ModelPreset"),
    "get_full_model_id": ("autocoder.core.model_settings", "get_full_model_id"),
    "TestFrameworkDetector": ("autocoder.core.test_framework_detector", "TestFrameworkDetector"),
    "Database": ("autocoder.core.database", "Database"),
    "get_database": ("autocoder.core.database", "get_database"),
}

__all__ = [
    "Orchestrator",
    "create_orchestrator",
    "Gatekeeper",
    "WorktreeManager",
    "KnowledgeBase",
    "get_knowledge_base",
    "ModelSettings",
    "ModelPreset",
    "get_full_model_id",
    "TestFrameworkDetector",
    "Database",
    "get_database",
]

if TYPE_CHECKING:
    from autocoder.core.database import Database as Database
    from autocoder.core.database import get_database as get_database
    from autocoder.core.gatekeeper import Gatekeeper as Gatekeeper
    from autocoder.core.knowledge_base import KnowledgeBase as KnowledgeBase
    from autocoder.core.knowledge_base import get_knowledge_base as get_knowledge_base
    from autocoder.core.model_settings import ModelPreset as ModelPreset
    from autocoder.core.model_settings import ModelSettings as ModelSettings
    from autocoder.core.model_settings import get_full_model_id as get_full_model_id
    from autocoder.core.orchestrator import Orchestrator as Orchestrator
    from autocoder.core.orchestrator import create_orchestrator as create_orchestrator
    from autocoder.core.test_framework_detector import (
        TestFrameworkDetector as TestFrameworkDetector,
    )
    from autocoder.core.worktree_manager import WorktreeManager as WorktreeManager


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

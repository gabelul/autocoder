from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pytest

from autocoder.core.orchestrator import Orchestrator


def _init_git_repo(repo_path: Path) -> None:
    repo_path.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init"], cwd=repo_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=repo_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=repo_path, capture_output=True, check=True)
    subprocess.run(["git", "checkout", "-b", "main"], cwd=repo_path, capture_output=True, check=True)

    (repo_path / "README.md").write_text("# Test Repo", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=repo_path, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=repo_path, capture_output=True, check=True)


def test_planner_required_writes_fallback_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTOCODER_SKIP_PORT_CHECK", "1")
    monkeypatch.setenv("AUTOCODER_PLANNER_REQUIRED", "1")
    # Keep planner enabled off; required should still ensure a plan for risky features (fail-open).
    monkeypatch.delenv("AUTOCODER_PLANNER_ENABLED", raising=False)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "repo"
        _init_git_repo(repo_path)
        orch = Orchestrator(project_dir=str(repo_path), max_agents=0)

        worktree = repo_path / "worktrees" / "agent-1"
        worktree.mkdir(parents=True, exist_ok=True)

        feature = {
            "id": 123,
            "name": "Add auth middleware",
            "description": "Protect API routes with auth",
            "category": "backend",
            "steps": ["Find current auth pattern", "Add middleware", "Add tests"],
            "attempts": 0,
        }

        plan_path = orch._ensure_feature_plan(feature=feature, worktree_path=worktree)
        assert plan_path is not None
        p = Path(plan_path)
        assert p.exists()
        text = p.read_text(encoding="utf-8")
        assert "Feature plan (fallback)" in text
        assert "Reason:" in text


def test_planner_required_smart_skips_low_risk(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTOCODER_SKIP_PORT_CHECK", "1")
    monkeypatch.setenv("AUTOCODER_PLANNER_REQUIRED", "1")
    monkeypatch.delenv("AUTOCODER_PLANNER_ENABLED", raising=False)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "repo"
        _init_git_repo(repo_path)
        orch = Orchestrator(project_dir=str(repo_path), max_agents=0)

        worktree = repo_path / "worktrees" / "agent-1"
        worktree.mkdir(parents=True, exist_ok=True)

        feature = {
            "id": 1,
            "name": "Update README",
            "description": "Add usage examples",
            "category": "docs",
            "steps": ["Edit README"],
            "attempts": 0,
        }

        plan_path = orch._ensure_feature_plan(feature=feature, worktree_path=worktree)
        assert plan_path is None


def test_planner_required_smart_triggers_after_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTOCODER_SKIP_PORT_CHECK", "1")
    monkeypatch.setenv("AUTOCODER_PLANNER_REQUIRED", "1")
    monkeypatch.delenv("AUTOCODER_PLANNER_ENABLED", raising=False)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "repo"
        _init_git_repo(repo_path)
        orch = Orchestrator(project_dir=str(repo_path), max_agents=0)

        worktree = repo_path / "worktrees" / "agent-1"
        worktree.mkdir(parents=True, exist_ok=True)

        feature = {
            "id": 2,
            "name": "Fix flaky test",
            "description": "Stabilize timing in unit tests",
            "category": "docs",
            "steps": ["Investigate", "Fix", "Verify"],
            "attempts": 2,
        }

        plan_path = orch._ensure_feature_plan(feature=feature, worktree_path=worktree)
        assert plan_path is not None


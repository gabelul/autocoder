from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest

from autocoder.core.git_bootstrap import ensure_git_repo_for_parallel


@pytest.mark.skipif(shutil.which("git") is None, reason="git not installed")
def test_ensure_git_repo_for_parallel_initializes_and_ignores_runtime_artifacts() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        project_dir = Path(tmp)
        (project_dir / "prompts").mkdir(parents=True, exist_ok=True)
        (project_dir / "prompts" / "app_spec.txt").write_text(
            "<project_specification></project_specification>\n", encoding="utf-8"
        )

        # Files that should be committed
        (project_dir / "hello.txt").write_text("hello\n", encoding="utf-8")

        # Runtime artifacts that should be ignored (and not committed)
        (project_dir / "agent_system.db").write_text("db\n", encoding="utf-8")
        (project_dir / ".autocoder").mkdir(parents=True, exist_ok=True)
        (project_dir / ".autocoder" / "logs.txt").write_text("log\n", encoding="utf-8")

        ok, msg = ensure_git_repo_for_parallel(project_dir)
        assert ok, msg

        # hello.txt should be tracked
        import subprocess

        proc = subprocess.run(
            ["git", "ls-files", "hello.txt"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        assert proc.returncode == 0
        assert proc.stdout.strip() == "hello.txt"

        # agent_system.db should NOT be tracked
        proc2 = subprocess.run(
            ["git", "ls-files", "agent_system.db"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        assert proc2.returncode == 0
        assert proc2.stdout.strip() == ""

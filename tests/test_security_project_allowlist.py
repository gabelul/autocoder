import asyncio
import tempfile
from pathlib import Path

import pytest

from autocoder.agent.security import bash_security_hook


def _write_config(project_dir: Path, content: str) -> None:
    (project_dir / "autocoder.yaml").write_text(content, encoding="utf-8")


def _run_hook(command: str) -> dict:
    input_data = {"tool_name": "Bash", "tool_input": {"command": command}}
    return asyncio.run(bash_security_hook(input_data))


def test_project_allowlist_extends_global(monkeypatch: pytest.MonkeyPatch) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        project_dir = Path(tmpdir)
        _write_config(
            project_dir,
            """
security:
  allow_commands:
    - "poetry"
            """.strip(),
        )
        old_cwd = Path.cwd()
        try:
            monkeypatch.chdir(project_dir)
            result = _run_hook("poetry install")
            assert result == {}
        finally:
            monkeypatch.chdir(old_cwd)


def test_project_allowlist_ignored_in_strict_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        project_dir = Path(tmpdir)
        _write_config(
            project_dir,
            """
security:
  strict: true
  allow_commands:
    - "poetry"
            """.strip(),
        )
        old_cwd = Path.cwd()
        try:
            monkeypatch.chdir(project_dir)
            result = _run_hook("poetry install")
            assert result.get("decision") == "block"
        finally:
            monkeypatch.chdir(old_cwd)

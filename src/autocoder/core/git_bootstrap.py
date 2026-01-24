"""
Git Bootstrap
=============

Parallel mode relies on git worktrees, which requires:
- a git repository (`.git` exists)
- an initial commit (HEAD exists)

For new projects created via AutoCoder, it's common to start without git.
These helpers safely bootstrap git when needed.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


_DEFAULT_GITIGNORE_LINES = [
    "",
    "# Common local / build artifacts",
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    ".turbo/",
    ".cache/",
    ".pytest_cache/",
    ".mypy_cache/",
    ".ruff_cache/",
    ".venv/",
    "venv/",
    "*.log",
    ".DS_Store",
    "Thumbs.db",
    "",
    "# Secrets (avoid accidental commits)",
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.crt",
    "*.cer",
    "*.der",
    "",
    "# AutoCoder runtime artifacts",
    ".autocoder/",
    "worktrees/",
    ".agent.lock",
    ".progress_cache",
    "agent_system.db",
    "agent_system.db-wal",
    "agent_system.db-shm",
    "assistant.db",
    ".claude_settings*.json",
    "prompts/.spec_status.json",
]


def _run_git(argv: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def _git_has_head(project_dir: Path) -> bool:
    proc = _run_git(["git", "rev-parse", "--verify", "HEAD"], cwd=project_dir)
    return proc.returncode == 0


def _ensure_gitignore(project_dir: Path) -> None:
    path = project_dir / ".gitignore"
    existing = ""
    if path.exists():
        try:
            existing = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            existing = ""

    # Only append missing lines to preserve user formatting.
    missing: list[str] = []
    for line in _DEFAULT_GITIGNORE_LINES:
        if not line:
            continue
        if line not in existing:
            missing.append(line)

    if not missing:
        return

    new_text = existing
    if new_text and not new_text.endswith("\n"):
        new_text += "\n"
    if "# AutoCoder runtime artifacts" not in existing:
        new_text += "\n" + "\n".join(_DEFAULT_GITIGNORE_LINES).lstrip("\n") + "\n"
    else:
        new_text += "\n" + "\n".join(missing) + "\n"

    path.write_text(new_text, encoding="utf-8")


def _ensure_git_identity(project_dir: Path) -> None:
    """
    Ensure git can commit without global config.

    If user.name/email are not set, configure repo-local values.
    """
    name = _run_git(["git", "config", "--get", "user.name"], cwd=project_dir).stdout.strip()
    email = _run_git(["git", "config", "--get", "user.email"], cwd=project_dir).stdout.strip()
    if name and email:
        return
    _run_git(["git", "config", "user.name", "AutoCoder"], cwd=project_dir)
    _run_git(["git", "config", "user.email", "autocoder@local"], cwd=project_dir)


def ensure_git_repo_for_parallel(project_dir: Path) -> tuple[bool, str]:
    """
    Ensure `project_dir` is ready for parallel mode worktrees.

    Returns:
        (ok, message). If ok is False, message is user-facing guidance.
    """
    project_dir = Path(project_dir).resolve()
    if shutil.which("git") is None:
        return False, "git not found on PATH"

    git_dir = project_dir / ".git"
    if not git_dir.exists():
        # Prefer main branch when supported (git >= 2.28); fall back gracefully.
        proc = _run_git(["git", "init", "-b", "main"], cwd=project_dir)
        if proc.returncode != 0:
            proc = _run_git(["git", "init"], cwd=project_dir)
        if proc.returncode != 0:
            return False, f"git init failed: {(proc.stderr or proc.stdout).strip() or 'unknown error'}"

    # If HEAD exists already, we are good (don't touch user repo further).
    if _git_has_head(project_dir):
        return True, "git repo ready"

    # Bootstrap: ensure ignores, stage, and commit an initial snapshot.
    try:
        _ensure_gitignore(project_dir)
    except Exception as e:
        return False, f"failed to write .gitignore: {e}"

    add = _run_git(["git", "add", "-A"], cwd=project_dir)
    if add.returncode != 0:
        return False, f"git add failed: {(add.stderr or add.stdout).strip() or 'unknown error'}"

    _ensure_git_identity(project_dir)
    commit = _run_git(["git", "commit", "--no-gpg-sign", "-m", "init"], cwd=project_dir)
    if commit.returncode != 0:
        joined = (commit.stderr or commit.stdout or "").strip()
        # If there is nothing to commit, allow an empty initial commit so HEAD exists.
        if "nothing to commit" in joined.lower():
            commit2 = _run_git(["git", "commit", "--no-gpg-sign", "--allow-empty", "-m", "init"], cwd=project_dir)
            if commit2.returncode != 0:
                return False, f"git commit failed: {(commit2.stderr or commit2.stdout).strip() or 'unknown error'}"
        else:
            return False, f"git commit failed: {joined or 'unknown error'}"

    if not _git_has_head(project_dir):
        return False, "git bootstrap succeeded but HEAD is still missing"

    return True, "git repo initialized for parallel mode"

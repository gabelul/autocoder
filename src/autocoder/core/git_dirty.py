"""
Git Dirty Detection
===================

Shared helper for determining whether a project git working tree is "dirty" in a way that should
block deterministic merges (Gatekeeper) or parallel-mode worktree orchestration.

We intentionally ignore known runtime artifacts that AutoCoder / Playwright can create, to avoid
blocking merges on harmless files.
"""

from __future__ import annotations

import fnmatch
import subprocess
from dataclasses import dataclass
from pathlib import Path


def _run_git(argv: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def git_status_porcelain(project_dir: Path) -> list[str]:
    raw = _run_git(["git", "status", "--porcelain"], cwd=Path(project_dir)).stdout
    return [ln for ln in (raw or "").splitlines() if ln.strip()]


def split_dirty(lines: list[str], *, project_dir: Path) -> tuple[list[str], list[str]]:
    """
    Split `git status --porcelain` lines into:
    - ignored (runtime/artifacts we don't want to block on)
    - remaining (real changes that should block deterministic merges)
    """
    project_dir = Path(project_dir).resolve()

    ignore_any_status_substrings = [
        ".autocoder/",
        "worktrees/",
        "agent_system.db",
        "assistant.db",
        ".progress_cache",
        ".eslintrc.json",
    ]
    ignore_untracked_substrings = [
        # Playwright MCP verification artifacts / screenshots
        ".playwright-mcp/",
    ]
    ignore_untracked_filenames = {
        # Claude Code CLI can leave these behind in the target project root.
        ".claude_settings.json",
        "claude-progress.txt",
    }
    ignore_untracked_globs = [
        "*.pid",
    ]

    ignored: list[str] = []
    remaining: list[str] = []
    for ln in lines:
        target = ln.replace("\\", "/")
        status = ln[:2]
        path_part = ln[3:] if len(ln) > 3 else ""
        # Handle renames like: "R  old -> new"
        if "->" in path_part:
            path_part = path_part.split("->", 1)[-1].strip()
        rel = path_part.replace("\\", "/")
        filename = rel.split("/")[-1] if rel else ""

        if any(s in target for s in ignore_any_status_substrings):
            ignored.append(ln)
            continue

        if status == "??":
            if any(s in rel for s in ignore_untracked_substrings):
                ignored.append(ln)
                continue
            if filename in ignore_untracked_filenames:
                ignored.append(ln)
                continue
            if any(fnmatch.fnmatch(filename, pat) for pat in ignore_untracked_globs):
                ignored.append(ln)
                continue

            # Claude CLI sometimes drops a redundant root-level app_spec.txt even when prompts/app_spec.txt exists.
            if filename == "app_spec.txt" and (project_dir / "prompts" / "app_spec.txt").exists():
                ignored.append(ln)
                continue

            # AutoCoder prompt scaffolding files are often left untracked in the target project.
            if rel == "prompts/" or rel == "prompts":
                ignored.append(ln)
                continue
            if rel.startswith("prompts/"):
                rel_name = rel.split("/")[-1] if rel else ""
                if rel_name == "app_spec.txt" or rel_name.endswith("_prompt.txt"):
                    ignored.append(ln)
                    continue

        remaining.append(ln)

    return ignored, remaining


@dataclass(frozen=True)
class GitDirtyStatus:
    ignored: list[str]
    remaining: list[str]

    @property
    def is_clean(self) -> bool:
        return not self.remaining


def get_git_dirty_status(project_dir: Path) -> GitDirtyStatus:
    lines = git_status_porcelain(project_dir)
    ignored, remaining = split_dirty(lines, project_dir=project_dir)
    return GitDirtyStatus(ignored=ignored, remaining=remaining)

from __future__ import annotations

from pathlib import Path

from autocoder.qa_worker import _apply_patch, _strip_fences, _trim_to_diff_start


def _init_git_repo(repo: Path) -> None:
    import subprocess

    subprocess.run(["git", "init"], cwd=str(repo), check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(repo), check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=str(repo), check=True)
    (repo / "a.txt").write_text("one\n", encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=str(repo), check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=str(repo), check=True, capture_output=True)


def test_trim_to_diff_start_prefers_diff_git() -> None:
    raw = "some preamble\n\n```diff\ndiff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@\n-one\n+two\n```\n"
    trimmed = _trim_to_diff_start(_strip_fences(raw))
    assert trimmed.startswith("diff --git ")


def test_apply_patch_accepts_git_style_diff(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir(parents=True)
    _init_git_repo(repo)

    patch = (
        "diff --git a/a.txt b/a.txt\n"
        "index 43dd47e..64c5e58 100644\n"
        "--- a/a.txt\n"
        "+++ b/a.txt\n"
        "@@ -1 +1 @@\n"
        "-one\n"
        "+two\n"
    )
    ok, err = _apply_patch(repo, patch)
    assert ok, err


def test_apply_patch_accepts_unified_diff_without_diff_git(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir(parents=True)
    _init_git_repo(repo)

    patch = (
        "--- a/a.txt\n"
        "+++ b/a.txt\n"
        "@@ -1 +1 @@\n"
        "-one\n"
        "+two\n"
    )
    ok, err = _apply_patch(repo, patch)
    assert ok, err


def test_apply_patch_rejects_apply_patch_format(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir(parents=True)
    _init_git_repo(repo)

    patch = "*** Begin Patch\n*** Update File: a.txt\n-one\n+two\n*** End Patch\n"
    ok, err = _apply_patch(repo, patch)
    assert not ok
    assert "apply_patch format" in err


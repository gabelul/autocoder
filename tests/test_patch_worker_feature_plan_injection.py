from __future__ import annotations

from pathlib import Path


def test_patch_worker_implement_prompt_includes_feature_plan(tmp_path: Path) -> None:
    from autocoder import qa_worker

    repo = tmp_path / "repo"
    (repo / ".autocoder").mkdir(parents=True, exist_ok=True)
    (repo / ".autocoder" / "feature_plan.md").write_text("PLAN CONTENT\n", encoding="utf-8")

    prompt = qa_worker._implement_prompt(
        repo=repo,
        project_dir=repo,
        feature={"id": 1, "name": "feat", "description": "desc", "category": "demo", "steps": ["do x"]},
        files=[],
        hints={},
        diff="",
        attempt=1,
    )

    assert "Feature plan (generated):" in prompt
    assert "PLAN CONTENT" in prompt

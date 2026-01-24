from __future__ import annotations

from pathlib import Path

from autocoder.generation.repo_map import REPO_MAP_FILES, get_repo_map_status


def test_repo_map_status_missing(tmp_path: Path) -> None:
    st = get_repo_map_status(tmp_path)
    assert st.exists is False
    assert st.present == []
    assert set(st.missing) == set(REPO_MAP_FILES.values())


def test_repo_map_status_present(tmp_path: Path) -> None:
    knowledge = tmp_path / "knowledge"
    knowledge.mkdir(parents=True, exist_ok=True)

    for filename in REPO_MAP_FILES.values():
        (knowledge / filename).write_text("# x\n", encoding="utf-8")

    st = get_repo_map_status(tmp_path)
    assert st.exists is True
    assert st.missing == []
    assert set(st.present) == set(REPO_MAP_FILES.values())


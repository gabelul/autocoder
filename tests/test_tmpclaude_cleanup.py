from __future__ import annotations

from pathlib import Path

from autocoder.server.services.process_manager import cleanup_tmpclaude_dirs


def test_cleanup_tmpclaude_dirs_removes_dirs(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("AUTOCODER_TMPCLAUDE_MAX_AGE_S", raising=False)
    monkeypatch.delenv("AUTOCODER_CLEAN_TMPCLAUDE", raising=False)

    d1 = tmp_path / "tmpclaude-aaaa-cwd"
    d2 = tmp_path / "tmpclaude-bbbb-cwd"
    d1.mkdir()
    d2.mkdir()
    (d1 / "foo.txt").write_text("x", encoding="utf-8")
    (d2 / "bar.txt").write_text("y", encoding="utf-8")

    deleted, failed = cleanup_tmpclaude_dirs(tmp_path)
    assert failed == 0
    assert deleted == 2
    assert not d1.exists()
    assert not d2.exists()


def test_cleanup_tmpclaude_dirs_can_be_disabled(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("AUTOCODER_CLEAN_TMPCLAUDE", "0")
    d = tmp_path / "tmpclaude-cccc-cwd"
    d.mkdir()

    deleted, failed = cleanup_tmpclaude_dirs(tmp_path)
    assert deleted == 0
    assert failed == 0
    assert d.exists()

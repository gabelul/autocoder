from autocoder.core.database import Database


def test_sqlite_journal_mode_env_override(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTOCODER_SQLITE_JOURNAL_MODE", "DELETE")
    db = Database(str(tmp_path / "agent_system.db"))

    with db.get_connection() as conn:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    assert str(mode).lower() == "delete"


def test_sqlite_journal_mode_network_fallback(tmp_path, monkeypatch):
    monkeypatch.delenv("AUTOCODER_SQLITE_JOURNAL_MODE", raising=False)
    monkeypatch.setattr(Database, "_is_network_filesystem", lambda self, path: True)
    db = Database(str(tmp_path / "agent_system.db"))

    with db.get_connection() as conn:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    assert str(mode).lower() == "delete"


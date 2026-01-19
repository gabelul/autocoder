import importlib
import json

from autocoder.core.database import Database


def test_create_regression_issue_dedupes_open_issue(tmp_path):
    db = Database(str(tmp_path / "agent_system.db"))

    feature_id = db.create_feature("feat-1", "desc-1", "backend")
    assert db.mark_feature_passing(feature_id) is True

    first = db.create_regression_issue(regression_of_id=feature_id, summary="Homepage 500", details="GET / returns 500")
    assert first["success"] is True
    assert first["created"] is True
    assert isinstance(first["feature_id"], int)

    issue_id = int(first["feature_id"])
    issue = db.get_feature(issue_id) or {}
    assert int(issue.get("regression_of_id") or 0) == feature_id
    assert str(issue.get("category") or "") == "REGRESSION"
    assert str(issue.get("status") or "").upper() in {"PENDING", "IN_PROGRESS", "BLOCKED"}
    assert str(issue.get("last_error") or "") == "Homepage 500"

    second = db.create_regression_issue(
        regression_of_id=feature_id,
        summary="Homepage still 500",
        details="Repro: curl /",
        artifact_path=".autocoder/regressions/x.json",
    )
    assert second["success"] is True
    assert second["created"] is False
    assert int(second["feature_id"]) == issue_id

    refreshed = db.get_feature(issue_id) or {}
    assert str(refreshed.get("last_error") or "") == "Homepage still 500"
    assert str(refreshed.get("last_artifact_path") or "") == ".autocoder/regressions/x.json"


def test_feature_report_regression_mcp_tool_creates_issue(tmp_path, monkeypatch):
    monkeypatch.setenv("PROJECT_DIR", str(tmp_path))

    import autocoder.tools.feature_mcp as feature_mcp

    importlib.reload(feature_mcp)
    db = feature_mcp.get_db()

    feature_id = db.create_feature("feat-1", "desc-1", "backend")
    assert db.mark_feature_passing(feature_id) is True

    raw = feature_mcp.feature_report_regression(
        regression_of_id=feature_id,
        summary="Broken nav",
        details="Clicking X now 404s",
        artifact_path=".autocoder/regressions/r1.json",
    )
    out = json.loads(raw)
    assert out["success"] is True
    assert out["feature_id"]
    assert out["created"] is True


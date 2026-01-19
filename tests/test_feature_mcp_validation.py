import json

import autocoder.tools.feature_mcp as feature_mcp


class _DummyDB:
    def __init__(self) -> None:
        self.created: list[dict] | None = None

    def create_features_bulk(self, features: list[dict]) -> int:
        self.created = features
        return len(features)


def test_feature_create_bulk_rejects_invalid_items():
    dummy = _DummyDB()
    original = feature_mcp._db
    feature_mcp._db = dummy
    try:
        out = feature_mcp.feature_create_bulk(
            [
                {
                    "category": "",
                    "name": "Valid name",
                    "description": "ok",
                    "steps": ["step 1"],
                }
            ]
        )
        payload = json.loads(out)
        assert payload["success"] is False
        assert dummy.created is None
    finally:
        feature_mcp._db = original


def test_feature_create_bulk_applies_defaults_and_calls_db():
    dummy = _DummyDB()
    original = feature_mcp._db
    feature_mcp._db = dummy
    try:
        out = feature_mcp.feature_create_bulk(
            [
                {
                    "category": "core",
                    "name": "Some feature",
                    "description": "Do the thing",
                    "steps": ["step 1"],
                }
            ]
        )
        payload = json.loads(out)
        assert payload["success"] is True
        assert payload["created"] == 1
        assert dummy.created is not None
        assert dummy.created[0]["priority"] == 0
        assert dummy.created[0]["enabled"] is True
    finally:
        feature_mcp._db = original


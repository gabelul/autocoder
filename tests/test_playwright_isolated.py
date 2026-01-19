import autocoder.agent.client as client_mod


def test_playwright_mcp_is_isolated_by_default(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "test-token")
    captured = {}

    class DummyClient:
        def __init__(self, options):
            captured["options"] = options

    monkeypatch.setattr(client_mod, "ClaudeSDKClient", DummyClient)
    client_mod.create_client(tmp_path, model="claude-opus", yolo_mode=False)

    args = captured["options"].mcp_servers["playwright"]["args"]
    assert "--isolated" in args


def test_playwright_mcp_can_disable_isolated(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "test-token")
    monkeypatch.setenv("AUTOCODER_PLAYWRIGHT_ISOLATED", "0")
    captured = {}

    class DummyClient:
        def __init__(self, options):
            captured["options"] = options

    monkeypatch.setattr(client_mod, "ClaudeSDKClient", DummyClient)
    client_mod.create_client(tmp_path, model="claude-opus", yolo_mode=False)

    args = captured["options"].mcp_servers["playwright"]["args"]
    assert "--isolated" not in args


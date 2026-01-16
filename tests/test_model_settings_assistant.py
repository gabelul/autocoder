import os

from autocoder.core.model_settings import ModelSettings, get_full_model_id


def test_get_full_model_id_uses_env_override(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_DEFAULT_OPUS_MODEL", "custom-opus")
    assert get_full_model_id("opus") == "custom-opus"


def test_assistant_model_invalid_values_are_cleared(tmp_path):
    path = tmp_path / "model_settings.json"
    path.write_text(
        '{"preset":"balanced","available_models":["opus","haiku"],"assistant_model":"bogus"}',
        encoding="utf-8",
    )
    settings = ModelSettings.load(path)
    assert settings.assistant_model is None


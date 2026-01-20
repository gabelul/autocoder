from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[import-not-found]


@dataclass(frozen=True)
class CodexCliDefaults:
    model: str | None = None
    reasoning_effort: str | None = None


def get_codex_cli_defaults() -> CodexCliDefaults:
    """
    Best-effort Codex CLI default detection.

    Reads `~/.codex/config.toml` when available. If the file doesn't exist or can't be parsed,
    returns empty defaults.
    """
    if tomllib is None:  # pragma: no cover
        return CodexCliDefaults()

    path = Path.home() / ".codex" / "config.toml"
    if not path.exists():
        return CodexCliDefaults()

    try:
        raw = path.read_bytes()
        data = tomllib.loads(raw.decode("utf-8", errors="replace"))
    except Exception:
        return CodexCliDefaults()

    model = data.get("model")
    model = model.strip() if isinstance(model, str) and model.strip() else None

    reasoning = data.get("model_reasoning_effort")
    reasoning = reasoning.strip() if isinstance(reasoning, str) and reasoning.strip() else None

    return CodexCliDefaults(model=model, reasoning_effort=reasoning)

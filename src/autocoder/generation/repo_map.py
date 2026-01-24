from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

from autocoder.core.model_settings import ModelSettings, get_full_model_id

logger = logging.getLogger(__name__)


REPO_MAP_FILES: dict[str, str] = {
    "STACK": "codebase_STACK.md",
    "ARCHITECTURE": "codebase_ARCHITECTURE.md",
    "STRUCTURE": "codebase_STRUCTURE.md",
    "CONVENTIONS": "codebase_CONVENTIONS.md",
    "TESTING": "codebase_TESTING.md",
    "CONCERNS": "codebase_CONCERNS.md",
    "INTEGRATIONS": "codebase_INTEGRATIONS.md",
}


@dataclass(frozen=True)
class RepoMapStatus:
    exists: bool
    knowledge_dir: Path
    present: list[str]
    missing: list[str]


def get_repo_map_status(project_dir: Path) -> RepoMapStatus:
    knowledge_dir = Path(project_dir).resolve() / "knowledge"
    exists = knowledge_dir.exists() and knowledge_dir.is_dir()
    present: list[str] = []
    missing: list[str] = []

    for filename in REPO_MAP_FILES.values():
        if exists and (knowledge_dir / filename).exists():
            present.append(filename)
        else:
            missing.append(filename)

    return RepoMapStatus(
        exists=exists,
        knowledge_dir=knowledge_dir,
        present=sorted(present),
        missing=sorted(missing),
    )


def _extract_json_from_text(text: str) -> dict[str, Any] | None:
    s = (text or "").strip()
    if not s:
        return None
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    start = s.find("{")
    end = s.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(s[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _claude_cli_path(use_custom_api: bool) -> str | None:
    if use_custom_api:
        return None
    cli_command = (os.environ.get("AUTOCODER_CLI_COMMAND") or os.environ.get("CLI_COMMAND") or "claude").strip()
    return shutil.which(cli_command)


def _select_map_model(project_dir: Path, model: str | None) -> str:
    explicit = (model or "").strip()
    if explicit:
        return explicit
    try:
        settings = ModelSettings.load_for_project(Path(project_dir).resolve())
        best_family = settings.available_models[0] if settings.available_models else settings.fallback_model
        return get_full_model_id(best_family)
    except Exception:
        return os.environ.get("AUTOCODER_REVIEW_MODEL") or "sonnet"


def _build_map_prompt() -> str:
    keys = ", ".join(REPO_MAP_FILES.keys())
    return (
        "You are a codebase mapping agent.\n"
        "Use Read/Glob/Grep to inspect the repository in the current working directory.\n\n"
        "Output requirements:\n"
        "- Return ONLY valid JSON (no markdown fences).\n"
        f"- Top-level keys MUST be: {keys}.\n"
        "- Each value MUST be a Markdown string.\n"
        "- Include concrete file paths in backticks like `src/foo/bar.py`.\n"
        "- Prefer specific commands (setup/test/lint/typecheck/dev) if discoverable.\n"
        "- Note major architectural boundaries, conventions, and risks/pitfalls.\n"
        "- Keep each document concise but useful (~1–3 pages each).\n\n"
        "Document definitions:\n"
        "- STACK: languages, runtimes, frameworks, package managers, entrypoints.\n"
        "- ARCHITECTURE: conceptual components, data flow, key modules, boundaries.\n"
        "- STRUCTURE: where things live; directory map; where to add new code.\n"
        "- CONVENTIONS: patterns, naming, style, error handling, logging.\n"
        "- TESTING: frameworks, how to run tests, patterns, fixtures, test locations.\n"
        "- CONCERNS: sharp edges, tech debt, tricky areas, TODO hotspots, perf/security risks.\n"
        "- INTEGRATIONS: external APIs/services, env vars, credentials, webhooks, queues.\n"
    )


async def _run_claude_repo_map(
    *,
    repo: Path,
    artifacts_dir: Path,
    model: str,
    timeout_s: int,
) -> str:
    # If using an Anthropic-compatible proxy that uses AUTH_TOKEN, mirror it to API_KEY for SDK.
    use_custom_api = False
    if "ANTHROPIC_AUTH_TOKEN" in os.environ:
        os.environ.setdefault("ANTHROPIC_API_KEY", os.environ["ANTHROPIC_AUTH_TOKEN"])
        use_custom_api = True

    # Helpful preflight: if we're not using a custom API and don't have Claude credentials, fail early.
    credentials_path = Path.home() / ".claude" / ".credentials.json"
    if not use_custom_api and not credentials_path.exists():
        raise RuntimeError("Claude credentials not found. Run `claude login` or set API env vars.")

    # Read-only settings file.
    settings_file = artifacts_dir / ".claude_settings.repo_map.json"
    settings = {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "reject",
            "allow": [
                "Read(./**)",
                "Glob(./**)",
                "Grep(./**)",
            ],
        },
    }
    settings_file.write_text(json.dumps(settings, indent=2), encoding="utf-8")

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model=model,
            cli_path=_claude_cli_path(use_custom_api),
            allowed_tools=["Read", "Glob", "Grep"],
            system_prompt=(
                "You are a precise senior engineer creating codebase mapping docs. "
                "Follow the output schema exactly."
            ),
            cwd=str(repo),
            settings=str(settings_file),
            max_turns=40,
            setting_sources=["project"],
        )
    )

    async def _collect() -> str:
        async with client:
            await client.query(_build_map_prompt())
            text = ""
            async for msg in client.receive_response():
                if type(msg).__name__ == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                            text += block.text
            return text.strip()

    return await asyncio.wait_for(_collect(), timeout=timeout_s)


def generate_repo_map_to_knowledge(
    project_dir: Path,
    *,
    overwrite: bool = True,
    timeout_s: int = 900,
    model: str | None = None,
) -> dict[str, Any]:
    """
    Generate a repo map (codebase index) into `<project>/knowledge/`.

    Writes 7 files (codebase_*.md) intended to be injected into prompts automatically.
    Also stores raw/success artifacts under `<project>/.autocoder/generate/repo_map/<timestamp>/`.
    """
    project_dir = Path(project_dir).resolve()
    knowledge_dir = project_dir / "knowledge"
    knowledge_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    artifacts_dir = project_dir / ".autocoder" / "generate" / "repo_map" / stamp
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    picked_model = _select_map_model(project_dir, model)
    timeout_s = max(30, min(int(timeout_s or 900), 36000))

    try:
        text = asyncio.run(
            _run_claude_repo_map(repo=project_dir, artifacts_dir=artifacts_dir, model=picked_model, timeout_s=timeout_s)
        )
    except Exception as e:
        logger.exception("Repo map generation failed")
        (artifacts_dir / "error.txt").write_text(str(e), encoding="utf-8")
        raise

    (artifacts_dir / "raw.txt").write_text(text, encoding="utf-8")
    data = _extract_json_from_text(text)
    if not data:
        raise ValueError("Repo map did not return valid JSON")

    missing_keys = [k for k in REPO_MAP_FILES.keys() if not str(data.get(k) or "").strip()]
    if missing_keys:
        raise ValueError(f"Repo map missing required keys: {', '.join(missing_keys)}")

    written: list[str] = []
    for key, filename in REPO_MAP_FILES.items():
        content = str(data.get(key) or "").strip()
        out_path = knowledge_dir / filename
        if out_path.exists() and not overwrite:
            continue
        out_path.write_text(content.rstrip() + "\n", encoding="utf-8")
        written.append(str(out_path))

    status = {
        "status": "complete",
        "timestamp": datetime.now().isoformat(),
        "model": picked_model,
        "knowledge_dir": str(knowledge_dir),
        "artifacts_dir": str(artifacts_dir),
        "files": written,
        "overwrite": bool(overwrite),
    }
    (artifacts_dir / "status.json").write_text(json.dumps(status, indent=2), encoding="utf-8")

    return status


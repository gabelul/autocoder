"""
Spec Validation
===============

Shared helpers for determining whether a project has a "real" app_spec.txt.

We treat the default scaffold template as not-real to prevent accidental runs that
crash early or waste cycles generating features from placeholder content.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


_SPEC_PLACEHOLDER_MARKERS = (
    "YOUR_PROJECT_NAME",
    "Replace with your actual project specification",
    "Describe your project in 2-3 sentences",
)


def find_app_spec_path(project_dir: Path) -> Path | None:
    """Return the app_spec.txt path if it exists, preferring `prompts/app_spec.txt`."""
    project_dir = Path(project_dir).resolve()
    prompts_spec = project_dir / "prompts" / "app_spec.txt"
    if prompts_spec.exists():
        return prompts_spec
    legacy_spec = project_dir / "app_spec.txt"
    if legacy_spec.exists():
        return legacy_spec
    return None


def read_app_spec_text(project_dir: Path) -> str | None:
    """Read app_spec.txt contents (best-effort), or None if missing/unreadable."""
    spec_path = find_app_spec_path(project_dir)
    if not spec_path:
        return None
    try:
        return spec_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None


def is_app_spec_text_placeholder(text: str) -> bool:
    if not text:
        return True
    return any(marker in text for marker in _SPEC_PLACEHOLDER_MARKERS)


def is_app_spec_text_real(text: str) -> bool:
    """
    Return True if text looks like a real AutoCoder spec.

    Requirements:
    - Must include the `<project_specification>` tag (and closing tag)
    - Must not include the default placeholder markers
    """
    if not text or not text.strip():
        return False
    if "<project_specification>" not in text:
        return False
    if "</project_specification>" not in text:
        return False
    if is_app_spec_text_placeholder(text):
        return False
    return True


@dataclass(frozen=True)
class SetupStatus:
    required: bool
    reason: str = ""


def project_setup_status(project_dir: Path) -> SetupStatus:
    text = read_app_spec_text(project_dir)
    if text is None:
        return SetupStatus(required=True, reason="No app_spec.txt found (expected prompts/app_spec.txt).")
    if "<project_specification>" not in text:
        return SetupStatus(required=True, reason="app_spec.txt missing <project_specification> tag.")
    if "</project_specification>" not in text:
        return SetupStatus(required=True, reason="app_spec.txt missing </project_specification> closing tag.")
    if is_app_spec_text_placeholder(text):
        return SetupStatus(required=True, reason="app_spec.txt is still the scaffold template.")
    return SetupStatus(required=False, reason="")


def is_project_setup_required(project_dir: Path) -> bool:
    return project_setup_status(project_dir).required


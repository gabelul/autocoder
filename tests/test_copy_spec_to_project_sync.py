from __future__ import annotations

import tempfile
from pathlib import Path

from autocoder.agent.prompts import copy_spec_to_project


def test_copy_spec_to_project_overwrites_stale_root_spec() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        project_dir = Path(tmp)
        (project_dir / "prompts").mkdir(parents=True, exist_ok=True)

        prompts_spec = "<project_specification>\n  <project_name>Real</project_name>\n</project_specification>\n"
        (project_dir / "prompts" / "app_spec.txt").write_text(prompts_spec, encoding="utf-8")

        # Simulate a stale legacy root app_spec.txt (e.g. placeholder from an old run).
        (project_dir / "app_spec.txt").write_text(
            "<project_specification>YOUR_PROJECT_NAME</project_specification>\n",
            encoding="utf-8",
        )

        copy_spec_to_project(project_dir)

        assert (project_dir / "app_spec.txt").read_text(encoding="utf-8") == prompts_spec


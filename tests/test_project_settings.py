from pathlib import Path


def test_project_runtime_settings_roundtrip_and_env_override(tmp_path: Path):
    from autocoder.core.project_runtime_settings import (
        ProjectRuntimeSettings,
        apply_project_runtime_settings_env,
        load_project_runtime_settings,
        save_project_runtime_settings,
    )

    project_dir = tmp_path
    assert load_project_runtime_settings(project_dir) is None

    settings = ProjectRuntimeSettings(
        planner_enabled=True,
        planner_required=True,
        require_gatekeeper=True,
        allow_no_tests=False,
        stop_when_done=False,
        locks_enabled=False,
        worker_verify=False,
        playwright_headless=True,
    )
    save_project_runtime_settings(project_dir, settings)

    loaded = load_project_runtime_settings(project_dir)
    assert loaded == settings

    base_env = {"AUTOCODER_STOP_WHEN_DONE": "1"}
    overridden = apply_project_runtime_settings_env(
        project_dir, dict(base_env), override_existing=True
    )
    assert overridden["AUTOCODER_STOP_WHEN_DONE"] == "0"
    assert overridden["AUTOCODER_PLANNER_REQUIRED"] == "1"
    assert overridden["PLAYWRIGHT_HEADLESS"] == "1"

    not_overridden = apply_project_runtime_settings_env(
        project_dir, dict(base_env), override_existing=False
    )
    assert not_overridden["AUTOCODER_STOP_WHEN_DONE"] == "1"


def test_project_run_defaults_roundtrip(tmp_path: Path):
    from autocoder.core.project_run_defaults import (
        ProjectRunDefaults,
        load_project_run_defaults,
        save_project_run_defaults,
    )

    project_dir = tmp_path

    defaults = load_project_run_defaults(project_dir)
    assert defaults.mode == "standard"
    assert defaults.parallel_count == 3

    save_project_run_defaults(
        project_dir,
        ProjectRunDefaults(
            yolo_mode=True,
            mode="parallel",  # should be coerced to standard on load
            parallel_count=5,
            model_preset="economy",
        ),
    )

    loaded = load_project_run_defaults(project_dir)
    assert loaded.yolo_mode is True
    assert loaded.mode == "standard"
    assert loaded.parallel_count == 5
    assert loaded.model_preset == "economy"


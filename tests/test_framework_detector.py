#!/usr/bin/env python3
"""
Test Framework Detector Tests
===============================

Tests for automatic test framework detection which allows the agent
to run the correct test commands for any project.

Run with: pytest tests/test_framework_detector.py -v
"""

import tempfile
import json
from pathlib import Path

from autocoder.core.test_framework_detector import TestFrameworkDetector


def test_detect_jest():
    """Test detecting Jest framework."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir)

        # Create package.json with jest
        package_json = {
            "name": "test-project",
            "scripts": {
                "test": "jest",
                "test:watch": "jest --watch"
            },
            "devDependencies": {
                "jest": "^29.0.0"
            }
        }

        (project_path / "package.json").write_text(json.dumps(package_json))

        # Detect
        detector = TestFrameworkDetector(str(project_path))
        framework = detector.get_framework_info()

        assert framework["framework"] == "jest", "Should detect Jest"
        assert "npm test" in framework["test_command"], "Should have npm test command"
        print("✅ Jest detection works")


def test_detect_pytest():
    """Test detecting pytest framework."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir)

        # Create requirements.txt (marks as Python project)
        (project_path / "requirements.txt").write_text("pytest\n")

        # Create pytest.ini
        (project_path / "pytest.ini").write_text("[pytest]\ntestpaths = tests")

        # Create a test file
        tests_dir = project_path / "tests"
        tests_dir.mkdir()
        (tests_dir / "test_example.py").write_text("def test_something(): pass")

        # Detect
        detector = TestFrameworkDetector(str(project_path))
        framework = detector.get_framework_info()

        assert framework["framework"] == "pytest", "Should detect pytest"
        assert "pytest" in framework["test_command"], "Should have pytest command"
        print("✅ Pytest detection works")


def test_detect_vitest():
    """Test detecting Vitest framework."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir)

        # Create package.json with vitest
        package_json = {
            "name": "test-project",
            "scripts": {
                "test": "vitest"
            },
            "devDependencies": {
                "vitest": "^1.0.0"
            }
        }

        (project_path / "package.json").write_text(json.dumps(package_json))

        # Detect
        detector = TestFrameworkDetector(str(project_path))
        framework = detector.get_framework_info()

        assert framework["framework"] == "vitest", "Should detect Vitest"
        assert "npm test" in framework["test_command"], "Should have npm test command"
        print("✅ Vitest detection works")


def test_detect_no_framework():
    """Test project with no test framework."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir)

        # Create empty project
        (project_path / "README.md").write_text("# No tests here")

        # Detect
        detector = TestFrameworkDetector(str(project_path))
        framework = detector.get_framework_info()

        assert framework["framework"] == "unknown", "Should return unknown for no framework"
        print("✅ Unknown framework detection works")


def test_detect_with_test_files():
    """Test detection based on test file patterns."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir)

        # Create requirements.txt to mark as Python
        (project_path / "requirements.txt").write_text("pytest\n")

        # Create Python test files
        tests_dir = project_path / "tests"
        tests_dir.mkdir()
        (tests_dir / "test_auth.py").write_text("def test_login(): pass")
        (tests_dir / "test_users.py").write_text("def test_create_user(): pass")

        # Detect
        detector = TestFrameworkDetector(str(project_path))
        framework = detector.get_framework_info()

        assert framework["framework"] == "pytest", "Should detect pytest from test files"
        print("✅ Test file pattern detection works")


def test_get_framework_info():
    """Test getting framework info."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir)

        # Create requirements.txt
        (project_path / "requirements.txt").write_text("pytest\n")

        # Create pytest.ini
        (project_path / "pytest.ini").write_text("[pytest]")

        # Use detector
        detector = TestFrameworkDetector(str(project_path))
        framework = detector.get_framework_info()

        assert framework is not None, "Should return a framework"
        assert framework["framework"] == "pytest", "Should detect pytest"
        print("✅ Get framework info works")


if __name__ == "__main__":
    print("Running Test Framework Detector Tests...\n")

    test_detect_jest()
    test_detect_pytest()
    test_detect_vitest()
    test_detect_no_framework()
    test_detect_with_test_files()
    test_get_framework_info()

    print("\n" + "=" * 70)
    print("ALL TEST FRAMEWORK DETECTOR TESTS PASSED ✅")
    print("=" * 70)

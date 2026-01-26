import asyncio
import os
import types

import psutil

from autocoder.server.services.process_manager import AgentProcessManager


def test_agent_lock_blocks_when_pid_and_create_time_match(tmp_path):
    manager = AgentProcessManager("test", tmp_path, tmp_path)
    pid = os.getpid()
    create_time = psutil.Process(pid).create_time()
    manager.lock_file.write_text(f"{pid}:{create_time}", encoding="utf-8")

    assert manager._check_lock() is False


def test_agent_lock_clears_when_pid_reused_or_mismatched_create_time(tmp_path):
    manager = AgentProcessManager("test", tmp_path, tmp_path)
    pid = os.getpid()
    create_time = psutil.Process(pid).create_time() - 10_000
    manager.lock_file.write_text(f"{pid}:{create_time}", encoding="utf-8")

    assert manager._check_lock() is True
    assert manager.lock_file.exists() is False


def test_agent_lock_create_is_atomic(tmp_path):
    manager = AgentProcessManager("test", tmp_path, tmp_path)
    manager.process = types.SimpleNamespace(pid=os.getpid())

    assert manager._create_lock() is True
    assert manager.lock_file.read_text(encoding="utf-8").strip().startswith(f"{os.getpid()}:")
    assert manager._create_lock() is False


def test_healthcheck_clears_stale_lock_and_running_status(tmp_path):
    manager = AgentProcessManager("test", tmp_path, tmp_path)
    manager.status = "running"
    # Point the lock at a PID that (very likely) doesn't exist.
    manager.lock_file.write_text("999999:0.0", encoding="utf-8")

    asyncio.run(manager.healthcheck())

    assert manager.lock_file.exists() is False
    assert manager.status in {"stopped", "crashed"}


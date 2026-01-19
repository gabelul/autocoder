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


"""
Regression Worker - Optional Post-Merge Verification
===================================================

This worker is spawned by the orchestrator (optional) to sanity-check already-passing
features against the current main branch and report regressions as "issue-like" features.

Key differences from feature workers:
- No feature assignment/claiming.
- No Gatekeeper merge flow.
- Runs a dedicated prompt (testing_prompt) and exits quickly (default 1 iteration).
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from autocoder.agent import run_autonomous_agent
from autocoder.core.database import get_database
from autocoder.core.file_locks import cleanup_agent_locks

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Regression worker (post-merge verification)")
    parser.add_argument("--project-dir", required=True, help="Main project directory (shared DB location)")
    parser.add_argument("--agent-id", required=True, help="Unique agent identifier")
    parser.add_argument("--worktree-path", required=True, help="Worktree to run verification in")
    parser.add_argument(
        "--model",
        default="sonnet",
        choices=["opus", "sonnet", "haiku"],
        help="Claude model to use",
    )
    parser.add_argument("--max-iterations", type=int, default=1)
    parser.add_argument("--heartbeat-seconds", type=int, default=60)
    parser.add_argument("--api-port", type=int, default=5000, help="Target app API port (default: 5000)")
    parser.add_argument("--web-port", type=int, default=5173, help="Target app web port (default: 5173)")
    args = parser.parse_args()

    # Validate ports are in valid range (1024-65535)
    for port_name, port_value in [("API", args.api_port), ("Web", args.web_port)]:
        if not (1024 <= port_value <= 65535):
            parser.error(f"--{port_name.lower()}-port must be between 1024 and 65535, got {port_value}")

    args.max_iterations = max(1, min(10, int(args.max_iterations)))
    return args


async def heartbeat_loop(database, agent_id: str, interval_seconds: int) -> None:
    while True:
        with contextlib.suppress(Exception):
            database.update_heartbeat(agent_id)
        await asyncio.sleep(max(5, int(interval_seconds)))


async def main() -> int:
    args = parse_args()

    # Identify this agent for hooks/tools (locks, etc.).
    os.environ["AUTOCODER_AGENT_ID"] = str(args.agent_id)
    os.environ["AUTOCODER_AGENT_MODE"] = "testing"

    # Port configuration (for dev servers + Playwright navigation)
    os.environ["AUTOCODER_API_PORT"] = str(args.api_port)
    os.environ["AUTOCODER_WEB_PORT"] = str(args.web_port)
    os.environ["API_PORT"] = str(args.api_port)
    os.environ["WEB_PORT"] = str(args.web_port)
    os.environ["PORT"] = str(args.api_port)
    os.environ["VITE_PORT"] = str(args.web_port)

    project_dir = Path(args.project_dir).resolve()
    worktree_path = Path(args.worktree_path).resolve()

    # Default lock dir to the shared project state directory (not the worktree).
    os.environ.setdefault("AUTOCODER_LOCK_DIR", str((project_dir / ".autocoder" / "locks").resolve()))

    if not project_dir.exists():
        logger.error(f"Project directory does not exist: {project_dir}")
        return 1
    if not worktree_path.exists():
        logger.error(f"Worktree directory does not exist: {worktree_path}")
        return 1

    database = get_database(str(project_dir))

    logger.info("=" * 70)
    logger.info("REGRESSION WORKER - POST-MERGE VERIFICATION")
    logger.info("=" * 70)
    logger.info(f"Agent ID:   {args.agent_id}")
    logger.info(f"Worktree:   {worktree_path}")
    logger.info(f"Model:      {args.model}")
    logger.info(f"Max iters:  {args.max_iterations}")
    logger.info(f"Heartbeat:  {args.heartbeat_seconds}s")
    logger.info(f"API Port:   {args.api_port}")
    logger.info(f"Web Port:   {args.web_port}")
    logger.info("=" * 70)

    start_time = datetime.now()
    heartbeat_task = asyncio.create_task(heartbeat_loop(database, args.agent_id, args.heartbeat_seconds))

    try:
        await run_autonomous_agent(
            project_dir=worktree_path,
            model=args.model,
            max_iterations=int(args.max_iterations),
            yolo_mode=False,  # Regression needs Playwright access.
            features_project_dir=project_dir,
            assigned_feature_id=None,
            agent_id=args.agent_id,
        )
        return 0

    except Exception as e:
        logger.exception("Regression worker failed")
        return 1

    finally:
        heartbeat_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await heartbeat_task

        with contextlib.suppress(Exception):
            database.mark_agent_completed(args.agent_id)

        # Best-effort lock cleanup to avoid stale locks blocking future work.
        if os.environ.get("AUTOCODER_LOCKS_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}:
            lock_dir_raw = str(os.environ.get("AUTOCODER_LOCK_DIR", "")).strip()
            if lock_dir_raw:
                with contextlib.suppress(Exception):
                    cleanup_agent_locks(Path(lock_dir_raw).resolve(), str(args.agent_id))

        duration_s = (datetime.now() - start_time).total_seconds()
        logger.info(f"Regression worker finished in {duration_s:.1f}s")


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        sys.exit(130)


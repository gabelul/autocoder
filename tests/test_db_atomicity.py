from __future__ import annotations

import multiprocessing as mp
from pathlib import Path


def _claim_one(db_dir: str, agent_id: str, out_q) -> None:  # type: ignore[no-untyped-def]
    from autocoder.core.database import get_database

    db = get_database(db_dir)
    claimed = db.claim_next_pending_feature(agent_id)
    out_q.put(int(claimed["id"]) if claimed else None)


def test_claim_next_is_unique_under_multiprocessing(tmp_path: Path) -> None:
    """
    Ensure concurrent claims cannot claim the same feature twice.

    This is a best-effort simulation of orchestrator/worker/MCP concurrent access on Windows
    where multiprocessing uses spawn semantics.
    """
    from autocoder.core.database import get_database

    project_dir = tmp_path
    db = get_database(str(project_dir))

    # Create a small pool of claimable features.
    total_features = 12
    for i in range(total_features):
        db.create_feature(
            name=f"Feature {i}",
            description="test",
            category="test",
            priority=0,
        )

    ctx = mp.get_context("spawn")
    q = ctx.Queue()
    procs: list[mp.Process] = []

    concurrent_claimers = 10
    for i in range(concurrent_claimers):
        p = ctx.Process(target=_claim_one, args=(str(project_dir), f"agent-{i}", q))
        p.start()
        procs.append(p)

    results: list[int | None] = []
    for _ in range(concurrent_claimers):
        results.append(q.get(timeout=30))

    for p in procs:
        p.join(timeout=30)
        assert p.exitcode == 0

    claimed_ids = [r for r in results if r is not None]
    assert len(claimed_ids) == len(set(claimed_ids))
    assert len(claimed_ids) <= total_features

    # Verify assigned agent IDs were recorded.
    for fid in claimed_ids:
        feature = db.get_feature(int(fid))
        assert feature is not None
        assert str(feature.get("assigned_agent_id") or "").strip() != ""


def test_mark_passing_is_idempotent(tmp_path: Path) -> None:
    from autocoder.core.database import get_database

    db = get_database(str(tmp_path))
    feature_id = db.create_feature(
        name="Feature",
        description="test",
        category="test",
        priority=0,
    )

    assert db.mark_feature_passing(int(feature_id)) is True
    assert db.mark_feature_passing(int(feature_id)) is False

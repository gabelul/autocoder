from __future__ import annotations

from autocoder.core.database import Database


def test_blockers_summary_groups_and_recommended(tmp_path):
    db = Database(str(tmp_path / "agent_system.db"))

    # Transient worker-ish error
    a_id = db.create_feature("A", "first", "core")
    assert (
        db.block_feature(
            a_id,
            "Worker failed to produce/apply a patch.\nLast error: Patch did not look like a unified diff",
            preserve_branch=True,
        )
        is True
    )

    # Dependency blocked (should not be recommended)
    b_id = db.create_feature("B", "second", "core")
    c_id = db.create_feature("C", "third", "core", depends_on=[b_id])
    assert db.block_feature(b_id, "Blocked: upstream failure") is True

    # If dependency-blocking health check is called, it should only block cycles now.
    assert db.block_unresolvable_dependencies() == 0

    # Manually block C with a dependency message (simulates legacy state).
    assert db.block_feature(c_id, "Blocked: dependency is BLOCKED (#%d B)" % b_id) is True

    summary = db.get_blockers_summary()
    assert summary["blocked_total"] >= 2
    assert summary["recommended_total"] >= 1
    assert any(g.get("retry_recommended") for g in summary.get("groups", []))


def test_get_blocked_feature_ids_modes(tmp_path):
    db = Database(str(tmp_path / "agent_system.db"))

    a_id = db.create_feature("A", "first", "core")
    assert (
        db.block_feature(
            a_id,
            "Worker failed to produce/apply a patch.\nLast error: Patch did not look like a unified diff",
            preserve_branch=True,
        )
        is True
    )

    b_id = db.create_feature("B", "second", "core")
    assert db.block_feature(b_id, "Blocked: upstream failure") is True

    all_ids = db.get_blocked_feature_ids(mode="all")
    assert a_id in all_ids
    assert b_id in all_ids

    rec_ids = db.get_blocked_feature_ids(mode="recommended")
    assert a_id in rec_ids
    assert b_id not in rec_ids

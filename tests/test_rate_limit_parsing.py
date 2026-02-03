from __future__ import annotations

from datetime import datetime

import pytest


def test_auto_continue_delay_default_when_no_match():
    from autocoder.agent.rate_limit import auto_continue_delay_from_rate_limit

    delay, target = auto_continue_delay_from_rate_limit("", default_delay_s=3)
    assert delay == 3
    assert target is None

    delay, target = auto_continue_delay_from_rate_limit("some other error", default_delay_s=3)
    assert delay == 3
    assert target is None

    delay, target = auto_continue_delay_from_rate_limit("Limit reached but no reset time", default_delay_s=3)
    assert delay == 3
    assert target is None


@pytest.mark.parametrize(
    "now_hour, reset_str, expected_delay_s",
    [
        (16, "Resets 5:30pm (America/Los_Angeles)", 90 * 60),
        (18, "Resets 5pm (America/Los_Angeles)", 23 * 60 * 60),
    ],
)
def test_auto_continue_delay_from_reset_time(now_hour: int, reset_str: str, expected_delay_s: int):
    from autocoder.agent.rate_limit import auto_continue_delay_from_rate_limit
    from zoneinfo import ZoneInfo

    now = datetime(2026, 2, 3, now_hour, 0, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    response = f"Limit reached. {reset_str}"
    delay, target = auto_continue_delay_from_rate_limit(response, default_delay_s=3, now=now)
    assert delay == expected_delay_s
    assert target is not None


def test_auto_continue_delay_caps_to_24h():
    from autocoder.agent.rate_limit import auto_continue_delay_from_rate_limit
    from zoneinfo import ZoneInfo

    # Force a time in the past so we add 1 day, but never exceed 24h cap.
    now = datetime(2026, 2, 3, 12, 0, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    response = "Limit reached. Resets 11am (America/Los_Angeles)"
    delay, _ = auto_continue_delay_from_rate_limit(response, default_delay_s=3, now=now)
    assert 0 <= delay <= 24 * 60 * 60

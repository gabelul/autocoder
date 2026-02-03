from __future__ import annotations

import re
from datetime import datetime, timedelta

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover - very old Python / missing tzdata
    ZoneInfo = None  # type: ignore[assignment]


_RESET_RE = re.compile(r"(?i)\bresets(?:\s+at)?\s+(\d+)(?::(\d+))?\s*(am|pm)\s*\(([^)]+)\)")


def auto_continue_delay_from_rate_limit(
    response: str,
    *,
    default_delay_s: float,
    now: datetime | None = None,
) -> tuple[float, str | None]:
    """
    If a Claude CLI response indicates a rate limit reset time, return a delay (seconds)
    until the reset and a human-readable target time string.

    Expected pattern (Claude CLI):
      "Limit reached ... Resets 5:30pm (America/Los_Angeles)"
    """
    if not response:
        return float(default_delay_s), None
    if "limit reached" not in response.lower():
        return float(default_delay_s), None
    if ZoneInfo is None:
        return float(default_delay_s), None

    match = _RESET_RE.search(response)
    if not match:
        return float(default_delay_s), None

    hour = int(match.group(1))
    minute = int(match.group(2)) if match.group(2) else 0
    period = match.group(3).lower()
    tz_name = match.group(4).strip()

    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0

    try:
        tz = ZoneInfo(tz_name)
        now_tz = now
        if now_tz is None:
            now_tz = datetime.now(tz)
        elif now_tz.tzinfo is None:
            now_tz = now_tz.replace(tzinfo=tz)
        else:
            now_tz = now_tz.astimezone(tz)

        target = now_tz.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now_tz:
            target += timedelta(days=1)
        delay = max(0.0, (target - now_tz).total_seconds())
        delay = min(delay, 24 * 60 * 60)
        return delay, target.strftime("%B %d, %Y at %I:%M %p %Z")
    except Exception:
        return float(default_delay_s), None

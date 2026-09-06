"""Approximate ISO date + epoch resolution from Google Maps relative date strings.

Google Maps captures only render RELATIVE dates in the review card DOM (e.g.
``2 minggu lalu``, ``7 tahun lalu``, ``a month ago``, ``Diedit 3 tahun lalu``).
No absolute timestamp survives into the rendered HTML for this variant (no
``title``/``datetime`` attribute on ``span.rsqaWe``, no JSON-LD). To still
answer "when was this review posted?" we resolve the relative string against
the scrape timestamp (``scraped_at``).

This is an APPROXIMATION: "sebulan lalu" is treated as one calendar month
before the scrape, "3 tahun lalu" as three calendar years. It is deterministic
(a pure function of input text + ``scraped_at``) so downstream delta logic
stays stable across runs. When a string cannot be parsed, both outputs are
``None``.

Evidence for the underlying limitation lives in
``docs/engineering/DOM_AUDIT.md`` (GMBE-PARITY section): all captured listings
show relative-only dates with no absolute attribute, and there are no owner
replies in the served DOM.
"""

from __future__ import annotations

import calendar
import re
from datetime import datetime, timedelta, timezone

_EDIT_PREFIX = re.compile(r"^\s*(?:diedit|edited)\s+", re.IGNORECASE)

# (compiled regex, unit spec) — unit spec is one of 'minute', 'hour', 'day',
# 'week', 'month', 'year'. Singular-text rules return unit value 1.
_RULES: list[tuple[re.Pattern, str, int]] = []


def _add(pattern: str, unit: str, value: int | None = None) -> None:
    _RULES.append((re.compile(rf"^\s*{pattern}\s*$", re.IGNORECASE), unit, value))


# --- Just now -------------------------------------------------------------
_add(r"baru\s+saja", "minute", 0)
_add(r"just\s+now", "minute", 0)

# --- Indonesian -----------------------------------------------------------
_add(r"(\d+)\s+menit\s+lalu", "minute")
_add(r"se?menit\s+lalu", "minute", 1)
_add(r"(\d+)\s+jam\s+lalu", "hour")
_add(r"se?jam\s+lalu", "hour", 1)
_add(r"(\d+)\s+hari\s+lalu", "day")
_add(r"sehari\s+lalu", "day", 1)
_add(r"kemarin", "day", 1)  # Y3 fix: "yesterday" in Indonesian
_add(r"(\d+)\s+minggu\s+lalu", "week")
_add(r"(\d+)\s+bulan\s+lalu", "month")
_add(r"sebulan\s+lalu", "month", 1)
_add(r"(\d+)\s+tahun\s+lalu", "year")
_add(r"setahun\s+lalu", "year", 1)

# --- English --------------------------------------------------------------
_add(r"(\d+)\s+minute?s?\s+ago", "minute")
_add(r"an?\s+minute\s+ago", "minute", 1)
_add(r"(\d+)\s+hours?\s+ago", "hour")
_add(r"an?\s+hour\s+ago", "hour", 1)
_add(r"today", "day", 0)
_add(r"yesterday", "day", 1)
_add(r"(\d+)\s+days?\s+ago", "day")
_add(r"an?\s+day\s+ago", "day", 1)
_add(r"(\d+)\s+weeks?\s+ago", "week")
_add(r"an?\s+week\s+ago", "week", 1)
_add(r"(\d+)\s+months?\s+ago", "month")
_add(r"an?\s+month\s+ago", "month", 1)
_add(r"(\d+)\s+years?\s+ago", "year")
_add(r"an?\s+year\s+ago", "year", 1)


def _sub_months(base: datetime, n: int) -> datetime:
    month_index = base.year * 12 + (base.month - 1) - n
    year, month0 = divmod(month_index, 12)
    month = month0 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return base.replace(year=year, month=month, day=day)


def resolve_relative_date(
    relative: str | None,
    scraped_at: datetime | None = None,
) -> tuple[str | None, float | None]:
    """Approximately resolve a Maps relative date string.

    Returns ``(iso_date, epoch_as_of_scraped_at)``. ``iso_date`` is a
    ``YYYY-MM-DD`` string (the date part of scraped_at minus the delta).
    Returns ``(None, None)`` when the string cannot be parsed.
    """
    if not relative or not relative.strip():
        return None, None

    now = scraped_at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    text = _EDIT_PREFIX.sub("", relative).strip()

    for regex, unit, fixed_value in _RULES:
        m = regex.match(text)
        if not m:
            continue
        value = fixed_value if fixed_value is not None else int(m.group(1))
        if unit == "year":
            base = _sub_months(now, value * 12)
        elif unit == "month":
            base = _sub_months(now, value)
        else:
            base = now - timedelta(**{unit + "s": value})
        return base.strftime("%Y-%m-%d"), base.timestamp()

    return None, None
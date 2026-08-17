#!/usr/bin/env python3
"""Proactive run notifications — webhook POST + optional SMTP email.

Zero-cost per Rule 4 (no paid APIs). The notifier NEVER raises (Rule 7):
any failure (missing config, network error, bad SMTP creds) is logged and
swallowed so a notification problem can never break a scrape run.

Config: `config/notifications.json` (see `config/notifications.example.json`).

    {
      "webhooks": [
        {"name": "slack", "url": "https://hooks.slack.com/services/...", "enabled": true}
      ],
      "email": {
        "enabled": true,
        "host": "smtp.gmail.com",
        "port": 587,
        "starttls": true,
        "username": "monitor@example.com",
        "password": "app-password",
        "to": ["ops@example.com"]
      }
    }

The webhook payload is deliberately generic JSON (`{text, ...}`) so it works
with Slack/Discord/Mattermost/ntfy and most webhook integrations out of the
box. If you need a specific shape, subclass or map the payload.
"""

from __future__ import annotations

import json
import logging
import smtplib
import urllib.request
from datetime import datetime, timezone
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

logger = logging.getLogger("gbp-monitor.notifications")

NOTIFICATIONS_CONFIG_PATH = Path("config/notifications.json")


def _load_config() -> dict[str, Any] | None:
    """Load `config/notifications.json`; None if missing/invalid (no raise)."""
    try:
        if not NOTIFICATIONS_CONFIG_PATH.exists():
            return None
        data = json.loads(NOTIFICATIONS_CONFIG_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            logger.warning("notifications: config is not a JSON object; disabled")
            return None
        return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("notifications: could not read config (%s); disabled", exc)
        return None


def _fmt_ts(iso: str | None) -> str:
    if not iso:
        return "unknown time"
    try:
        dt = datetime.fromisoformat(iso)
    except ValueError:
        return iso
    return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def build_message(summary: dict[str, Any]) -> dict[str, str]:
    """Build a human-readable notification message from a run summary.

    Returns a dict with keys: `subject` and `text` (plain text body).
    """
    mode = summary.get("mode", "?")
    run_id = summary.get("run_id", "")
    started = _fmt_ts(summary.get("started_at"))
    finished = _fmt_ts(summary.get("finished_at"))
    success = summary.get("success", 0)
    failed = summary.get("failed", 0)
    skipped = summary.get("skipped", 0)
    new_reviews = summary.get("new_reviews", 0)
    total_reviews = summary.get("total_reviews", 0)
    total_competitors = summary.get("total_competitors", 0)
    duration_s = summary.get("duration_seconds", 0)

    total = success + failed + skipped
    lines = [
        f"Rother scrape run completed — {mode} mode",
        f"Run ID: {run_id}",
        f"Started: {started}",
        f"Finished: {finished}",
        f"Duration: {duration_s:.1f}s",
        "",
        f"Competitors: {success} succeeded / {failed} failed / {skipped} skipped (of {total_competitors or total})",
        f"New reviews: {new_reviews}",
        f"Total reviews captured this run: {total_reviews}",
    ]

    if summary.get("errors"):
        lines.append("")
        lines.append("Errors:")
        for err in summary["errors"][:10]:
            comp = err.get("competitor_id", "?")
            msg = err.get("error", "")
            lines.append(f"  - {comp}: {msg}")
        if len(summary["errors"]) > 10:
            lines.append(f"  …and {len(summary['errors']) - 10} more")

    if failed >= success and failed > 0:
        lines.append("")
        lines.append("WARNING: failed >= success — likely selector breakage.")

    text = "\n".join(lines)
    subject = (
        f"Rother run {mode}: {new_reviews} new reviews, "
        f"{success} ok / {failed} failed"
    )
    return {"subject": subject, "text": text}


def _send_webhook(webhook: dict[str, Any], payload: dict[str, Any]) -> None:
    """POST a JSON payload to a webhook URL. Raises on transport error."""
    url = webhook.get("url", "")
    if not url:
        raise ValueError("webhook missing 'url'")
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 (user-configured URL)
        if resp.status >= 400:
            raise RuntimeError(f"webhook returned HTTP {resp.status}")


def _send_email(email_cfg: dict[str, Any], subject: str, text: str) -> None:
    """Send an email via SMTP. Raises on any failure."""
    host = email_cfg.get("host", "")
    port = int(email_cfg.get("port", 587))
    username = email_cfg.get("username", "")
    password = email_cfg.get("password", "")
    to = email_cfg.get("to", [])
    if not host or not to:
        raise ValueError("email config missing 'host' or 'to'")
    msg = MIMEText(text, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = username or "rother-monitor@localhost"
    msg["To"] = ", ".join(to)

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if email_cfg.get("starttls", True):
            smtp.starttls()
        if username:
            smtp.login(username, password)
        smtp.sendmail(username or msg["From"], to, msg.as_string())


def send_run_notification(summary: dict[str, Any]) -> None:
    """Send proactive notifications for a completed scrape run. Never raises.

    Reads `config/notifications.json`. If disabled or misconfigured, logs a
    debug line and returns. Each webhook/email is attempted independently —
    one failure does not prevent the others.
    """
    cfg = _load_config()
    if not cfg or not cfg.get("enabled", False):
        return

    message = build_message(summary)

    webhooks = cfg.get("webhooks") or []
    sent_any = False
    for webhook in webhooks:
        if not webhook.get("enabled", False):
            continue
        name = webhook.get("name", webhook.get("url", "?")[:40])
        try:
            # Generic payload: {text} is the common denominator; the full
            # summary is included for integrations that want structured data.
            _send_webhook(
                webhook,
                {
                    "text": f"{message['subject']}\n\n{message['text']}",
                    "subject": message["subject"],
                    "summary": summary,
                },
            )
            sent_any = True
            logger.info("notifications: webhook '%s' sent", name)
        except Exception as exc:  # noqa: BLE001 — Rule 7: never raise
            logger.warning("notifications: webhook '%s' failed: %s", name, exc)

    email_cfg = cfg.get("email") or {}
    if email_cfg.get("enabled", False):
        try:
            _send_email(email_cfg, message["subject"], message["text"])
            sent_any = True
            logger.info("notifications: email sent to %s", email_cfg.get("to"))
        except Exception as exc:  # noqa: BLE001 — Rule 7: never raise
            logger.warning("notifications: email failed: %s", exc)

    if sent_any:
        _structured_log_placeholder(summary)


def _structured_log_placeholder(summary: dict[str, Any]) -> None:
    """Emit a structured-log line for the notification (best-effort).

    The orchestrator already logs `summary_written`; here we only surface the
    notification outcome. Kept separate so this module has no dependency on
    the orchestrator's logging helpers.
    """
    try:
        from orchestration import run_all  # noqa: PLC0415 — lazy import

        run_all._structured_log(
            summary.get("run_id", ""),
            "notification_sent",
            mode=summary.get("mode"),
            new_reviews=summary.get("new_reviews", 0),
        )
    except Exception:  # noqa: BLE001
        pass


if __name__ == "__main__":
    # Manual smoke test: python -m notifications.notifier
    logging.basicConfig(level=logging.INFO)
    demo = {
        "mode": "live",
        "run_id": "20260816T200000Z",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "success": 11,
        "failed": 1,
        "skipped": 0,
        "new_reviews": 3,
        "total_reviews": 5024,
        "total_competitors": 12,
        "duration_seconds": 312.5,
        "errors": [{"competitor_id": "comp-canggu-02", "error": "capture timeout"}],
    }
    msg = build_message(demo)
    print(msg["subject"])
    print(msg["text"])
    print("\n(config enabled? attempting delivery…)")
    send_run_notification(demo)
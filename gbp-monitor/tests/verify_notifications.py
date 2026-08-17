#!/usr/bin/env python3
"""Verification for the proactive-notification notifier (M17).

Tests `notifications/notifier.py` WITHOUT touching the network or production
data:
  - build_message: message shape (subject, text) for success/failure/spike.
  - webhook delivery: spins up a local http.server and asserts the notifier
    POSTs the expected JSON (text + summary) to the configured URL.
  - email delivery: stubs smtplib.SMTP and asserts the message is constructed
    and "sent" to the configured recipients.
  - Rule 7: a broken webhook / broken SMTP config never raises.

Usage:
    python -m tests.verify_notifications

Exit codes: 0 = all passed, 1 = any failure.
"""

from __future__ import annotations

import json
import sys
import threading
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from notifications import notifier  # noqa: E402

PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name}" + (f" -- {detail}" if detail else ""))


SAMPLE_SUMMARY = {
    "mode": "live",
    "run_id": "20260816T200000Z",
    "started_at": "2026-08-16T20:00:00+07:00",
    "finished_at": "2026-08-16T20:05:12+07:00",
    "success": 11,
    "failed": 1,
    "skipped": 0,
    "new_reviews": 3,
    "total_reviews": 5024,
    "total_competitors": 12,
    "duration_seconds": 312.5,
    "errors": [{"competitor_id": "comp-canggu-02", "error": "capture timeout"}],
}


def test_build_message() -> None:
    print("build_message:")
    msg = notifier.build_message(SAMPLE_SUMMARY)
    check("subject includes mode", "live" in msg["subject"])
    check("subject includes new review count", "3 new reviews" in msg["subject"])
    check("subject includes failure count", "1 failed" in msg["subject"])
    check("text includes run id", "20260816T200000Z" in msg["text"])
    check("text includes competitor stats", "11 succeeded / 1 failed" in msg["text"])
    check("text includes new reviews", "New reviews: 3" in msg["text"])
    check("text includes error detail", "comp-canggu-02" in msg["text"])
    check("text includes duration", "312.5s" in msg["text"])
    check(
        "failure >= success warning present",
        "failed >= success" not in msg["text"] or "WARNING" in msg["text"],
    )

    warn_summary = {**SAMPLE_SUMMARY, "success": 1, "failed": 3}
    warn_msg = notifier.build_message(warn_summary)
    check(
        "failure >= success warning included",
        "WARNING" in warn_msg["text"] and "selector breakage" in warn_msg["text"],
    )


def test_webhook_delivery() -> None:
    print("webhook delivery (local HTTP server):")
    received: dict = {}
    received_box: list[dict] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            received_box.append(json.loads(body))
            self.send_response(200)
            self.end_headers()

        def log_message(self, *args) -> None:  # noqa: D401
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()

    cfg = {
        "enabled": True,
        "webhooks": [
            {
                "name": "local",
                "url": f"http://127.0.0.1:{port}/hook",
                "enabled": True,
            }
        ],
        "email": {"enabled": False},
    }
    with patch.object(notifier, "_load_config", return_value=cfg):
        notifier.send_run_notification(SAMPLE_SUMMARY)

    thread.join(timeout=5)
    server.server_close()
    check("webhook received a POST", len(received_box) == 1, str(received_box))
    if received_box:
        payload = received_box[0]
        check("payload has text field", isinstance(payload.get("text"), str))
        check(
            "payload text includes subject",
            "3 new reviews" in payload["text"],
            payload.get("text", "")[:120],
        )
        check("payload has summary", isinstance(payload.get("summary"), dict))
        check(
            "summary passed through",
            payload["summary"].get("new_reviews") == 3,
            str(payload.get("summary")),
        )


def test_disabled_config_noop() -> None:
    print("disabled config:")
    with patch.object(notifier, "_load_config", return_value={"enabled": False}):
        # Should return without raising and without sending.
        try:
            notifier.send_run_notification(SAMPLE_SUMMARY)
        except Exception as exc:  # noqa: BLE001
            check("disabled config does not raise", False, str(exc))
            return
    check("disabled config returns silently", True)


def test_rule7_broken_webhook() -> None:
    print("Rule 7 — broken webhook / broken email never raise:")
    cfg = {
        "enabled": True,
        "webhooks": [
            {"name": "dead", "url": "http://127.0.0.1:1/none", "enabled": True},
            {"name": "no-url", "enabled": True},
        ],
        "email": {
            "enabled": True,
            "host": "127.0.0.1",
            "port": 1,
            "to": ["ops@example.com"],
        },
    }
    try:
        with patch.object(notifier, "_load_config", return_value=cfg):
            notifier.send_run_notification(SAMPLE_SUMMARY)
    except Exception as exc:  # noqa: BLE001
        check("no raise on broken webhook/email", False, str(exc))
        return
    check("no raise on broken webhook/email", True)


def test_email_delivery() -> None:
    print("email delivery (stubbed SMTP):")
    sent: list[tuple] = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            sent.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            sent.append(("starttls",))

        def login(self, user, pwd):
            sent.append(("login", user, pwd))

        def sendmail(self, from_addr, to_addrs, msg):
            sent.append(("sendmail", from_addr, to_addrs, msg))

    cfg = {
        "enabled": True,
        "webhooks": [],
        "email": {
            "enabled": True,
            "host": "smtp.test",
            "port": 587,
            "starttls": True,
            "username": "mon@test",
            "password": "pw",
            "to": ["ops@example.com"],
        },
    }
    with patch.object(notifier, "_load_config", return_value=cfg), patch(
        "notifications.notifier.smtplib.SMTP", FakeSMTP
    ):
        notifier.send_run_notification(SAMPLE_SUMMARY)

    check("smtp connected to host", any(s[0] == "connect" and s[1] == "smtp.test" for s in sent))
    check("starttls used", any(s[0] == "starttls" for s in sent))
    check("login used", any(s[0] == "login" and s[2] == "pw" for s in sent))
    sendmail = next((s for s in sent if s[0] == "sendmail"), None)
    check("sendmail called", sendmail is not None)
    if sendmail:
        check("recipient set", "ops@example.com" in sendmail[2])
        check("message is a string", isinstance(sendmail[3], str))
        check("message contains subject", "3 new reviews" in sendmail[3])
        # MIMEText utf-8 bodies are base64-encoded, so decode before asserting.
        parsed = BytesParser(policy=policy.default).parsebytes(sendmail[3].encode("utf-8"))
        body = parsed.get_body(preferencelist=("plain",)).get_content()
        check("message body contains text", "Rother scrape run completed" in body)


def main() -> int:
    print("=== verify_notifications ===")
    test_build_message()
    test_webhook_delivery()
    test_disabled_config_noop()
    test_rule7_broken_webhook()
    test_email_delivery()
    print(f"\n{PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
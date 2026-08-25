#!/usr/bin/env python3
"""Lightweight baseline verification script.

Runs the scraper in --fixtures mode and validates that all expected output
artifacts are produced with correct content.

Usage:
    python -m tests.verify_baseline

Exit codes:
    0 -- all checks passed
    1 -- one or more checks failed
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
SNAPSHOTS_DIR = DATA_DIR / "snapshots"
REVIEWS_NEW_DIR = DATA_DIR / "reviews_new"
SUMMARY_PATH = DATA_DIR / "run_summary.json"
LOG_PATH = DATA_DIR / "run.log"

EXPECTED_SNAPSHOTS = {"comp-canggu-01", "comp-seminyak-01", "comp-ubud-01"}
EXPECTED_TOTAL_REVIEWS = 20  # ubud=7 (8 items - 1 skip), seminyak=7, canggu=6

PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        msg = f"  [FAIL] {name}"
        if detail:
            msg += f" -- {detail}"
        print(msg)


def check_dependencies() -> bool:
    """Verify that required Python packages are installed."""
    missing = []
    for mod in ["playwright", "parsel", "requests"]:
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        print(f"  [FAIL] Missing dependencies: {', '.join(missing)}")
        print(f"         Run: pip install -r {REPO_ROOT / 'requirements.txt'}")
        return False
    return True


def clean_data() -> None:
    """Remove data artifacts from a previous run."""
    lock_file = DATA_DIR / ".run.lock"
    if lock_file.exists():
        lock_file.unlink()
    if SNAPSHOTS_DIR.exists():
        for entry in SNAPSHOTS_DIR.iterdir():
            if entry.is_dir():
                for f in entry.iterdir():
                    f.unlink()
                entry.rmdir()
            else:
                entry.unlink()
    if REVIEWS_NEW_DIR.exists():
        for f in REVIEWS_NEW_DIR.iterdir():
            f.unlink()
    for f in [SUMMARY_PATH, LOG_PATH]:
        if f.exists():
            f.unlink()


def run_scraper() -> subprocess.CompletedProcess:
    """Execute the scraper in --fixtures mode."""
    return subprocess.run(
        [sys.executable, "-m", "orchestration.run_all", "--fixtures"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )


def verify_artifacts() -> None:
    """Validate all expected output files."""
    check("run_summary.json exists", SUMMARY_PATH.exists())
    if SUMMARY_PATH.exists():
        summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
        check("run_summary is a dict", isinstance(summary, dict))
        check("mode is fixtures", summary.get("mode") == "fixtures")
        check(
            "success count is 3",
            summary.get("success") == 3,
            f"got {summary.get('success')}",
        )
        check(
            "failed count is 0",
            summary.get("failed") == 0,
            f"got {summary.get('failed')}",
        )
        check(
            # Baseline config ships fixtures for every configured competitor,
            # so nothing may be skipped (the old 12-competitor config expected
            # 9 skips; the current minimal 3-competitor set expects 0).
            "skipped count is 0",
            summary.get("skipped") == 0,
            f"got {summary.get('skipped')}",
        )
        check(
            "total_reviews is 20",
            summary.get("total_reviews") == 20,
            f"got {summary.get('total_reviews')}",
        )

    # Versioned snapshot layout: each competitor is a subdirectory with latest.json pointer.
    snapshot_dirs = {p.name for p in SNAPSHOTS_DIR.iterdir() if p.is_dir() and p.name in EXPECTED_SNAPSHOTS}
    missing = EXPECTED_SNAPSHOTS - snapshot_dirs
    check(
        "all expected snapshot directories exist",
        not missing,
        f"missing: {missing}",
    )

    total_reviews = 0
    for comp_id in EXPECTED_SNAPSHOTS:
        comp_dir = SNAPSHOTS_DIR / comp_id
        latest_pointer = comp_dir / "latest.json"
        check(
            f"{comp_id}: latest.json exists",
            latest_pointer.exists(),
        )
        if not latest_pointer.exists():
            continue

        try:
            latest_filename = json.loads(latest_pointer.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            check(f"{comp_id}: could not read latest.json", False)
            continue

        snapshot_path = comp_dir / latest_filename
        check(
            f"{comp_id}: snapshot file {latest_filename} exists",
            snapshot_path.exists(),
        )
        if not snapshot_path.exists():
            continue

        reviews = json.loads(snapshot_path.read_text(encoding="utf-8"))
        total_reviews += len(reviews)
        check(
            f"{comp_id} snapshot is a list",
            isinstance(reviews, list),
        )
        for r in reviews:
            check(
                f"{comp_id}: review has review_id",
                bool(r.get("review_id")),
            )
            rating = r.get("rating")
            if rating is not None:
                check(
                    f"{comp_id}: rating in 1..5",
                    1.0 <= rating <= 5.0,
                    f"invalid rating {rating}",
                )

    check(
        "total review count matches expected",
        total_reviews == EXPECTED_TOTAL_REVIEWS,
        f"got {total_reviews}, expected {EXPECTED_TOTAL_REVIEWS}",
    )

    # HARVEST_FIX_PLAN Phase 2: a fixtures run is always the competitor's
    # FIRST harvest (data/ is wiped) → baseline suppression ⇒ no delta files.
    # The honest assertions are: seen-store unions were written, and the
    # delta-write path still works (exercised directly below).
    seen_files = list((DATA_DIR / "seen").glob("*.json")) if (DATA_DIR / "seen").exists() else []
    check(
        "seen-store union written per competitor",
        len(seen_files) >= 3,
        f"found {len(seen_files)} seen file(s) in data/seen/",
    )
    for sf in seen_files:
        try:
            data = json.loads(sf.read_text(encoding="utf-8"))
            check(
                f"seen {sf.name} has ids",
                isinstance(data.get("review_ids"), list) and len(data["review_ids"]) > 0,
            )
        except Exception as e:
            check(f"seen {sf.name} parseable", False, str(e))

    # Delta-write path: exercise directly (fixtures suppression means the
    # scraper itself no longer writes delta files on a first harvest).
    from storage.seen_store import _seen_path  # noqa: F401  (import sanity)
    from orchestration.run_all import _append_new_reviews

    _append_new_reviews(
        "comp-canggu-01",
        [{"review_id": "baseline-test-1", "rating": 5.0}],
        run_id="verify-baseline-delta-write",
    )
    delta_files = list(REVIEWS_NEW_DIR.glob("*.json"))
    check("at least one delta file exists after direct write", len(delta_files) > 0)
    for df in delta_files:
        reviews = json.loads(df.read_text(encoding="utf-8"))
        check(
            f"delta {df.name} has valid content",
            isinstance(reviews, list) and len(reviews) > 0,
        )

    check("run.log exists", LOG_PATH.exists())
    if LOG_PATH.exists():
        log_content = LOG_PATH.read_text(encoding="utf-8")
        check("run.log has content", len(log_content) > 0)
        check("run.log has INFO lines", "INFO" in log_content)
        check("run.log has Run summary",
              "run_summary" in log_content or "Run summary:" in log_content)


# ── M13B Security regression tests ──────────────────────────────────


def _verify_security() -> None:
    """Run security-specific regression tests.

    Tests the hardening measures implemented in M13B:
    - competitor_id sanitization rejects path traversal attempts
    - config validation detects duplicates and invalid place_ids
    - --validate-config CLI flag works
    """
    print("\n[Phase 4] Security regression tests...")

    # 4a  Import security functions from orchestration (only available after
    #     the scraper run, which guarantees the module is importable).
    try:
        from orchestration.run_all import (
            _sanitize_competitor_id,
            _validate_listings_config,
            _VALID_COMPETITOR_ID_RE,
        )
    except ImportError as e:
        check("security import", False, str(e))
        return

    # 4b  Valid competitor_ids must pass.
    valid_ids = ["comp-canggu-01", "foo", "a", "comp_123", "COMP-SEMINYAK-01"]
    for vid in valid_ids:
        try:
            _sanitize_competitor_id(vid)
            check(f"sec: valid ID {vid!r} accepted", True)
        except ValueError as ve:
            check(f"sec: valid ID {vid!r} accepted", False, str(ve))

    # 4c  Invalid competitor_ids must be rejected.
    invalid_ids = [
        ("../etc/passwd", "path traversal via .."),
        ("foo/bar", "path separator /"),
        ("foo\\bar", "path separator \\"),
        ("a\x00b", "null byte"),
        ("-" * 65, "exceeds max length (65 > 64)"),
        ("", "empty string"),
        ("comp with spaces", "contains space"),
        (".hidden", "starts with dot"),
    ]
    for bad_id, reason in invalid_ids:
        try:
            _sanitize_competitor_id(bad_id)
            check(f"sec: reject {reason} ({bad_id!r})", False, "should have raised ValueError")
        except ValueError:
            check(f"sec: reject {reason}", True)

    # 4d  Config validation rejects duplicate competitor_ids.
    duplicate_config = {
        "branches": [
            {
                "branch_id": "cph-a",
                "branch_name": "Branch A",
                "competitors": [
                    {"competitor_id": "comp-dup", "name": "First", "place_id": None},
                    {"competitor_id": "comp-dup", "name": "Second", "place_id": None},
                ],
            }
        ]
    }
    dup_errors = _validate_listings_config(duplicate_config)
    has_dup_error = any("duplicate" in e for e in dup_errors)
    check("sec: detect duplicate competitor_id", has_dup_error, str(dup_errors))

    # 4e  Config validation rejects invalid place_ids.
    bad_pid_config = {
        "branches": [
            {
                "branch_id": "cph-b",
                "branch_name": "Branch B",
                "competitors": [
                    {"competitor_id": "comp-badpid", "name": "Bad", "place_id": "invalid"},
                    {"competitor_id": "comp-nopid", "name": "None", "place_id": None},
                ],
            }
        ]
    }
    pid_errors = _validate_listings_config(bad_pid_config)
    has_pid_error = any("place_id" in e for e in pid_errors)
    check("sec: reject invalid place_id", has_pid_error, str(pid_errors))

    # 4f  Config validation passes for a valid config.
    valid_config = {
        "branches": [
            {
                "branch_id": "cph-c",
                "branch_name": "Branch C",
                "competitors": [
                    {"competitor_id": "comp-valid", "name": "Valid", "place_id": None},
                    {"competitor_id": "comp-valid2", "name": "Valid 2", "place_id": "ChIJxxxxxxxxxxxxxxxxxxxxxxxxxx"},
                ],
            }
        ]
    }
    valid_errors = _validate_listings_config(valid_config)
    check("sec: valid config passes", len(valid_errors) == 0, str(valid_errors))

    # 4g  --validate-config CLI flag works.
    result = subprocess.run(
        [sys.executable, "-m", "orchestration.run_all", "--validate-config"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    # Our real config may have place_id issues — the important thing is the
    # CLI runs without crashing and returns either 0 or 1.
    check("sec: --validate-config exits cleanly", result.returncode in (0, 1))


# ── M18 First-run polish tests ──────────────────────────────────────


def _verify_first_run_polish() -> None:
    """Verify the first-run/onboarding CLI improvements (M18).

    Tests in an isolated temp cwd so the real repo config is never touched:
    - _load_json_config returns clean errors (no raise) for missing/malformed
      config files
    - --init-config scaffolds missing configs from examples, idempotently
    - --validate-config reports missing files + suggests --init-config
    - run() aborts with a clean summary (no traceback) on a missing config
    """
    import shutil
    import tempfile

    try:
        from orchestration.run_all import _load_json_config
    except ImportError as e:
        check("fr: import run_all", False, str(e))
        return

    with tempfile.TemporaryDirectory(prefix="gbp-fr-") as tmp:
        tmp_path = Path(tmp)
        # Mirror the repo layout the orchestrator expects (cwd-relative paths).
        (tmp_path / "config").mkdir()
        (tmp_path / "orchestration").mkdir()
        (tmp_path / "notifications").mkdir()
        (tmp_path / "data").mkdir()

        shutil.copy(REPO_ROOT / "orchestration" / "run_all.py", tmp_path / "orchestration")
        shutil.copy(REPO_ROOT / "notifications" / "notifier.py", tmp_path / "notifications")
        shutil.copy(
            REPO_ROOT / "config" / "listings.example.json",
            tmp_path / "config",
        )
        shutil.copy(
            REPO_ROOT / "config" / "notifications.example.json",
            tmp_path / "config",
        )

        def cli(*args: str):
            return subprocess.run(
                [sys.executable, "-m", "orchestration.run_all", *args],
                cwd=str(tmp_path),
                capture_output=True,
                text=True,
            )

        # 5a  --validate-config reports missing config files (exit 1).
        r = cli("--validate-config")
        check(
            "fr: validate-config flags missing config",
            r.returncode == 1 and "not found" in r.stdout,
            f"rc={r.returncode} out={r.stdout[:120]!r}",
        )
        check(
            "fr: validate-config suggests --init-config",
            "--init-config" in r.stdout,
        )

        # 5b  --init-config scaffolds both example configs.
        r = cli("--init-config")
        check(
            "fr: init-config scaffolds listings.json",
            (tmp_path / "config" / "listings.json").exists() and r.returncode == 0,
            f"rc={r.returncode}",
        )
        check(
            "fr: init-config scaffolds notifications.json",
            (tmp_path / "config" / "notifications.json").exists(),
        )

        # 5c  --init-config is idempotent (never overwrites existing files).
        listings_json = (tmp_path / "config" / "listings.json")
        original = listings_json.read_text(encoding="utf-8")
        cli("--init-config")
        check(
            "fr: init-config is idempotent (no overwrite)",
            listings_json.read_text(encoding="utf-8") == original,
        )

        # 5d  _load_json_config yields clean errors (no raise) for a
        #     missing file and for malformed JSON.
        missing_path = tmp_path / "config" / "nope.json"
        data, msg = _load_json_config(missing_path, "nope.json")
        check(
            "fr: load_json_config missing -> (None, error)",
            data is None and isinstance(msg, str) and "not found" in msg,
            str(msg),
        )
        malformed = tmp_path / "config" / "bad.json"
        malformed.write_text("{not json", encoding="utf-8")
        data2, msg2 = _load_json_config(malformed, "bad.json")
        check(
            "fr: load_json_config malformed -> (None, error)",
            data2 is None and isinstance(msg2, str) and "not valid JSON" in msg2,
            str(msg2),
        )

        # 5e  run() aborts cleanly (no traceback) when a config file is
        #     missing — the pre-M18 behavior crashed with FileNotFoundError.
        (tmp_path / "config" / "selectors.json").unlink(missing_ok=True)
        r = cli()
        no_traceback = "Traceback" not in r.stderr
        summary = json.loads((tmp_path / "data" / "run_summary.json").read_text(encoding="utf-8"))
        errors = summary.get("errors", [])
        config_err = any(e.get("competitor_id") == "__config__" for e in errors)
        check(
            "fr: run() no traceback on missing selectors.json",
            no_traceback,
            f"stderr={r.stderr[-200:]!r}",
        )
        check(
            "fr: run() records __config__ error in summary",
            config_err,
            f"errors={errors!r}",
        )


# ── M8 Acquisition offline tests ────────────────────────────────────


def _verify_gmbe_parity() -> None:
    """Run offline checks for the GMBE-PARITY field extensions.

    Exercises the pure helpers (no browser):
    - relative_date -> (iso_date, epoch) resolution for ID + EN strings
    - like-count extraction from the like button aria-label
    - Review serialization carries the new optional fields
    """
    print("\n[Phase 6] GMBE-parity parser tests...")

    from datetime import datetime, timezone

    from parser.relative_date import resolve_relative_date
    from parser.schema import Review, review_to_dict

    now = datetime(2026, 8, 13, 12, 0, 0, tzinfo=timezone.utc)

    # Resolver: Indonesian.
    iso, ep = resolve_relative_date("7 tahun lalu", now)
    check("gmbe: 7 tahun lalu resolves to ISO", iso == "2019-08-13", f"got {iso}")
    check("gmbe: 7 tahun lalu resolves to epoch", ep is not None and ep < now.timestamp(), f"got {ep}")

    iso, _ = resolve_relative_date("sebulan lalu", now)
    check("gmbe: sebulan lalu -> YYYY-MM-DD", iso is not None and len(iso) == 10 and iso.endswith("-13"), f"got {iso}")

    iso, _ = resolve_relative_date("2 minggu lalu", now)
    check("gmbe: 2 minggu lalu resolves", iso is not None, f"got {iso}")

    iso, _ = resolve_relative_date("Diedit 6 tahun lalu", now)
    check("gmbe: 'Diedit N tahun lalu' strips prefix", iso == "2020-08-13", f"got {iso}")

    iso, _ = resolve_relative_date("baru saja", now)
    check("gmbe: baru saja resolves to scraped date", iso == now.strftime("%Y-%m-%d"), f"got {iso}")

    # Resolver: English.
    iso, _ = resolve_relative_date("a month ago", now)
    check("gmbe: 'a month ago' resolves", iso == "2026-07-13", f"got {iso}")

    iso, _ = resolve_relative_date("5 days ago", now)
    check("gmbe: '5 days ago' resolves", iso == "2026-08-08", f"got {iso}")

    iso, _ = resolve_relative_date("yesterday", now)
    check("gmbe: 'yesterday' resolves", iso == "2026-08-12", f"got {iso}")

    iso, ep = resolve_relative_date("nonsense text here", now)
    check("gmbe: unparseable -> (None, None)", iso is None and ep is None, f"got {(iso, ep)}")

    iso, ep = resolve_relative_date("", now)
    check("gmbe: empty -> (None, None)", iso is None and ep is None, f"got {(iso, ep)}")

    # Like count extraction via the real parser path.
    from parser.review_parser import parse_reviews

    like_html = """<html><body>
<div class="jftiEf fontBodyMedium" data-review-id="abc123">
  <button aria-label="Suka" class="gllhef"><span class="NlVald"><span>Suka</span></span></button>
  <span class="rsqaWe">3 days ago</span>
  <span class="wiI7pd">Great service</span>
  <span class="kvMYJc" role="img" aria-label="4 bintang"></span>
</div>
<div class="jftiEf fontBodyMedium" data-review-id="def456">
  <button aria-label="12 suka" class="gllhef"><span class="NlVald"><span>12</span></span></button>
  <span class="rsqaWe">a month ago</span>
  <span class="wiI7pd">Nice food</span>
  <span class="kvMYJc" role="img" aria-label="5 bintang"></span>
</div>
</body></html>"""
    like_selectors = {
        "review_item": "div.jftiEf.fontBodyMedium",
        "review_id_attr": "data-review-id",
        "review_text_selector": "span.wiI7pd",
        "rating_selector": "span.kvMYJc",
        "rating_attr": "aria-label",
        "relative_date_selector": "span.rsqaWe",
    }
    parsed = parse_reviews(like_html, "comp-x", "b", like_selectors)
    by_id = {r.review_id: r for r in parsed}
    check("gmbe: like=0 when button shows no count",
          by_id.get("abc123") and by_id["abc123"].review_like_count == 0,
          f"got {by_id.get('abc123').review_like_count if 'abc123' in by_id else None}")
    check("gmbe: like=12 when aria-label has count",
          by_id.get("def456") and by_id["def456"].review_like_count == 12,
          f"got {by_id.get('def456').review_like_count if 'def456' in by_id else None}")

    # Serialization carries the new fields.
    rev = Review(
        review_id="r1", competitor_id="c", branch_id="b", reviewer_name="n",
        rating=5.0, text="t", relative_date="a month ago", scraped_at="x",
        review_date="2026-07-13", review_date_epoch=1783911330.0, review_like_count=7,
    )
    d = review_to_dict(rev)
    check("gmbe: review_to_dict includes review_date",
          d.get("review_date") == "2026-07-13", str(d))
    check("gmbe: review_to_dict includes review_like_count",
          d.get("review_like_count") == 7, str(d))

    # Decay: successful fixture run must still yield date+epoch on real data.
    import json
    import subprocess
    from pathlib import Path

    repo_root = Path(__file__).resolve().parent.parent
    selectors = json.loads(
        (repo_root / "config" / "selectors.json").read_text(encoding="utf-8")
    )
    fixture = repo_root / "tests" / "fixtures" / "comp-canggu-01.html"
    fixture_reviews = parse_reviews(
        fixture.read_text(encoding="utf-8"), "comp-canggu-01", "x", selectors
    )
    dated = [r for r in fixture_reviews if r.review_date is not None and r.review_date_epoch is not None]
    check("gmbe: fixture reviews get resolved dates",
          len(fixture_reviews) > 0 and len(dated) == len(fixture_reviews),
          f"{len(dated)}/{len(fixture_reviews)} dated")


def _verify_acquisition() -> None:
    """Run offline checks for the M8 NID acquisition module.

    Only pure helpers are tested (no browser/network). The warm-up and
    storage-state reuse paths are exercised by a live run; these checks pin
    the cookie-inspection and storage_state-validation logic.
    """
    print("\n[Phase 5] M8 acquisition offline tests...")

    from harness.acquisition import (
        has_nid_cookie,
        valid_storage_state_path,
        NID_COOKIE_NAME,
    )

    nid_cookie = {
        "name": NID_COOKIE_NAME,
        "value": "abc123",
        "domain": ".google.com",
        "path": "/",
        "httpOnly": True,
        "secure": True,
        "sameSite": "None",
    }
    other_cookie = {"name": "AEC", "value": "x", "domain": ".google.com"}
    blank_cookie = {"name": NID_COOKIE_NAME, "value": "", "domain": ".google.com"}

    check("acq: NID cookie detected", has_nid_cookie([nid_cookie]))
    check("acq: non-NID cookie not detected", not has_nid_cookie([other_cookie]))
    check("acq: empty NID value rejected", not has_nid_cookie([blank_cookie]))
    check("acq: empty jar has no NID", not has_nid_cookie([]))

    # valid_storage_state_path against a temp dir.
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        good = Path(td) / "good.json"
        good.write_text(
            '{"cookies": [{"name": "NID", "value": "abc", "domain": ".google.com"}]}',
            encoding="utf-8",
        )
        check(
            "acq: valid storage_state accepted",
            valid_storage_state_path(good) == good,
        )

        no_nid = Path(td) / "no_nid.json"
        no_nid.write_text(
            '{"cookies": [{"name": "AEC", "value": "x", "domain": ".google.com"}]}',
            encoding="utf-8",
        )
        check(
            "acq: storage_state without NID rejected",
            valid_storage_state_path(no_nid) is None,
        )

        broken = Path(td) / "broken.json"
        broken.write_text("not json", encoding="utf-8")
        check(
            "acq: unreadable storage_state rejected",
            valid_storage_state_path(broken) is None,
        )

        missing = Path(td) / "missing.json"
        check(
            "acq: missing storage_state rejected",
            valid_storage_state_path(missing) is None,
        )


def _verify_stale_nid_guard() -> None:
    """Offline checks for the M16 stale-NID variant guard.

    Only the pure helpers are tested (classification + count parsing); the
    DOM probe itself needs a live browser and is exercised by a real run.
    """
    print("\n[Phase 6] M16 stale-NID guard offline tests...")

    from harness.capture import _classify_variant, _parse_aggregate_count

    # Aggregate review-count parsing.
    check("guard: parses '3.243'", _parse_aggregate_count("3.243") == 3243)
    check("guard: parses '1,024'", _parse_aggregate_count("1,024") == 1024)
    check("guard: parses '8'", _parse_aggregate_count("8") == 8)
    check("guard: parses nbsp thousand", _parse_aggregate_count("5\u00a0000") == 5000)
    check("guard: rejects junk", _parse_aggregate_count("abc") is None)
    check("guard: rejects empty", _parse_aggregate_count("") is None)
    check("guard: rejects None", _parse_aggregate_count(None) is None)

    # FULL variant: hundreds of mounted cards.
    v, _ = _classify_variant(cards=350, aggregate=3467)
    check("guard: 350 cards + big aggregate => full", v == "full")
    v, _ = _classify_variant(cards=600, aggregate=5021)
    check("guard: 600 cards + big aggregate => full", v == "full")

    # REDUCED variant: ~5 cards despite a large aggregate (07:54 evidence).
    v, _ = _classify_variant(cards=5, aggregate=3467)
    check("guard: 5 cards + 3467 aggregate => reduced", v == "reduced")
    v, _ = _classify_variant(cards=0, aggregate=5021)
    check("guard: 0 cards + big aggregate => reduced", v == "reduced")

    # Genuinely small business: few cards AND small aggregate => unknown (not reduced).
    v, _ = _classify_variant(cards=8, aggregate=8)
    check("guard: 8 cards + 8 aggregate => unknown (small business)", v == "unknown")
    v, _ = _classify_variant(cards=5, aggregate=5)
    check("guard: 5 cards + 5 aggregate => unknown (small business)", v == "unknown")

    # Ambiguous: low cards with no readable aggregate => unknown (Rule 7: proceed).
    v, _ = _classify_variant(cards=5, aggregate=None)
    check("guard: 5 cards + no aggregate => unknown", v == "unknown")
    v, _ = _classify_variant(cards=30, aggregate=50)
    check("guard: 30 cards + 50 aggregate => unknown", v == "unknown")


def _verify_harvest_classification() -> None:
    """Offline checks for harvest-completeness classification (HARVEST_FIX_PLAN Phase 1).

    classify_harvest answers "how much of the listing's true total did this
    capture window reach" — distinct from the stale-NID variant guard above.
    """
    print("\n[Phase 7] Harvest classification offline tests...")

    from harness.capture import classify_harvest

    # Google count unavailable => unknown (probe degraded — the 2026-08-24
    # symptom this phase fixes).
    v, _ = classify_harvest(510, None)
    check("harvest: no aggregate => unknown", v == "unknown")
    v, _ = classify_harvest(510, 0)
    check("harvest: zero aggregate => unknown", v == "unknown")

    # Full: harvested >= 90% of Google's count.
    v, _ = classify_harvest(500, 509)
    check("harvest: 500 of 509 => full", v == "full")
    v, _ = classify_harvest(8, 8)
    check("harvest: small listing fully harvested => full", v == "full")
    v, _ = classify_harvest(600, 5021)
    check("harvest: 600 of 5021 => reduced", v == "reduced")

    # Reduced: partial newest window (the Crate Cafe ~510-of-5009 case).
    v, d = classify_harvest(510, 5009)
    check("harvest: 510 of 5009 => reduced", v == "reduced")
    check("harvest: reduced detail carries both numbers", "510" in d and "5009" in d)

    # Boundary: exactly at the 90% threshold => full.
    v, _ = classify_harvest(90, 100)
    check("harvest: 90 of 100 (at threshold) => full", v == "full")
    v, _ = classify_harvest(89, 100)
    check("harvest: 89 of 100 (below threshold) => reduced", v == "reduced")


def _verify_seen_store() -> None:
    """Offline checks for the variance-proof delta base (HARVEST_FIX_PLAN Phase 2).

    Scenario numbers mirror Phase 0 evidence: 410-ID union, deeper 510-render
    with 100 never-seen OLD-date IDs must yield 0 posted / 100 backfill.
    """
    print("\n[Phase 8] Seen-store (variance-proof delta) offline tests...")

    import tempfile
    from datetime import datetime, timedelta, timezone
    from pathlib import Path

    from storage.seen_store import (
        is_first_harvest,
        is_recently_posted,
        load_seen,
        merge_seen,
        save_seen,
        split_candidates,
    )

    now = datetime.now(timezone.utc)
    recent_iso = (now - timedelta(days=2)).strftime("%Y-%m-%d")
    old_iso = (now - timedelta(days=400)).strftime("%Y-%m-%d")

    def rev(rid: str, date: str | None) -> dict:
        return {"review_id": rid, "review_date": date, "relative_date": None}

    # Pure union merge.
    seen = merge_seen({"a"}, [{"review_id": "b"}, {"review_id": None}, {}])
    check("seen: merge adds ids, skips id-less", seen == {"a", "b"})

    # Variance scenario (Phase 0 numbers): deeper render, old-date backfill.
    seen410 = {f"old{i}" for i in range(410)}
    render510 = [rev(f"old{i}", old_iso) for i in range(410)] + [
        rev(f"backfill{i}", old_iso) for i in range(100)
    ]
    posted, backfill = split_candidates(render510, seen410, now=now)
    check("seen: variance 410->510 old-date => 0 posted", len(posted) == 0)
    check("seen: variance 410->510 old-date => 100 backfill", len(backfill) == 100)

    # Genuinely-new: recent-date never-seen ID => posted.
    posted, backfill = split_candidates(
        [rev("fresh1", recent_iso)], seen410, now=now
    )
    check("seen: recent never-seen => 1 posted", len(posted) == 1)
    check("seen: recent never-seen => 0 backfill", len(backfill) == 0)

    # Conservative default: unparseable/missing date => posted (never missed).
    posted, _ = split_candidates([rev("nodate", None)], seen410, now=now)
    check("seen: missing date => posted (conservative)", len(posted) == 1)
    r = {"review_id": "x", "review_date": None, "relative_date": "2 hari lalu"}
    check("seen: relative_date resolves for recency gate",
          is_recently_posted(r, now=now) is True)

    # Recency boundary: 29 days posted / 31 days backfill.
    d29 = (now - timedelta(days=29)).strftime("%Y-%m-%d")
    d31 = (now - timedelta(days=31)).strftime("%Y-%m-%d")
    posted, backfill = split_candidates(
        [rev("d29", d29), rev("d31", d31)], set(), now=now
    )
    check("seen: 29-day-old => posted", len(posted) == 1 and posted[0]["review_id"] == "d29")
    check("seen: 31-day-old => backfill", len(backfill) == 1 and backfill[0]["review_id"] == "d31")

    # Already-seen IDs never re-fire.
    posted, backfill = split_candidates([rev("old0", old_iso)], seen410, now=now)
    check("seen: seen id never re-fires", len(posted) == 0 and len(backfill) == 0)

    # First-harvest detection.
    check("seen: first harvest (no union, no snapshot)", is_first_harvest(set(), []) is True)
    check("seen: migration (no union, snapshot exists) => not first",
          is_first_harvest(set(), [rev("old0", old_iso)]) is False)
    check("seen: union exists => not first", is_first_harvest({"a"}, []) is False)

    # Save/load roundtrip in an isolated dir.
    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        save_seen("comp-x", {"r1", "r2"}, base_dir=base)
        loaded = load_seen("comp-x", base_dir=base)
        check("seen: save/load roundtrip", loaded == {"r1", "r2"})
        # Corrupt file => tolerant empty (Rule 7).
        (base / "comp-broken.json").write_text("{not json", encoding="utf-8")
        check("seen: corrupt file => tolerant empty",
              load_seen("comp-broken", base_dir=base) == set())
        check("seen: missing file => empty", load_seen("comp-missing", base_dir=base) == set())


def main() -> int:
    print("=" * 60)
    print("GBP Monitor -- Baseline Verification")
    print("=" * 60)

    print("\n[Phase 0] Checking dependencies...")
    if not check_dependencies():
        return 1

    print("\n[Phase 1] Cleaning prior data...")
    clean_data()

    print("\n[Phase 2] Running scraper (--fixtures)...")
    result = run_scraper()
    check("scraper exit code is 0", result.returncode == 0, f"exit code {result.returncode}")
    last_lines = result.stderr.strip().splitlines()[-3:]
    for line in last_lines:
        print(f"         {line}")

    print("\n[Phase 3] Verifying artifacts...")
    verify_artifacts()

    # M13B: Security regression tests.
    _verify_security()

    # M18: First-run / onboarding CLI polish tests.
    _verify_first_run_polish()

    # M8: NID acquisition offline tests.
    _verify_acquisition()

    # GMBE-PARITY: relative-date/like-count offline tests.
    _verify_gmbe_parity()

    # M16: stale-NID guard offline tests.
    _verify_stale_nid_guard()
    _verify_harvest_classification()
    _verify_seen_store()

    print("\n" + "=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed")
    print("=" * 60)

    return 1 if FAIL > 0 else 0


if __name__ == "__main__":
    sys.exit(main())

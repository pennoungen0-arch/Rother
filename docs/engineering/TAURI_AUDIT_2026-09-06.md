# Rother Tauri — Scraping & Monitoring Audit (2026-09-06)

**Auditor:** opencode (mimo-v2.5-pro) · **Date:** 2026-09-06
**Scope:** Full scraping/monitoring pipeline, Node.js sidecar, Tauri shell, dashboard
**Reference:** All Phase 1-3 fixes verified present in code.

**Build state:** vitest 119/119 · verify_baseline 163/163 · tsc 0 · eslint 0 · Playwright 20/20

---

## RED — Critical (silent failures or wrong results)

### R1. `--session` CLI argument from Node.js sidecar silently ignored by Python orchestrator
- **Files:** `src/lib/gbp/scrape-runner.ts:382-391`, `gbp-monitor/orchestration/run_all.py:2013-2092`
- **Issue:** `scrape-runner.ts` builds `args.push("--session", session)` whenever `GBP_MONITOR_STORAGE_STATE` or `GBP_MONITOR_COOKIES_FILE` is set. Python's `_parse_args()` does NOT define a `--session` argument — argparse silently drops unknown flags.
- **Impact:** Multiple tenants share one global NID jar (`data/storage_state.json`), defeating the rationale for the env var.
- **Fix:** Delete the dead `--session` push from `scrape-runner.ts`.

### R2. Persistent TopBar indicator cannot retrieve the active `runId`
- **Files:** `src/components/shell/app-shell.tsx:39-99`, `src/app/api/scrape/status/route.ts:7-37`
- **Issue:** `useScrapeStatus()` polls `/api/scrape/status?active=1` which returns `{ok: true, active: bool}` but no `runId`. When `state.runId` is null, the fallback `fetch("/api/scrape/status")` returns `400 Missing runId query parameter`.
- **Impact:** Per-competitor progress never shows when navigating or after a server restart while a run is in flight.
- **Fix:** Add `runId` to the `?active=1` response.

### R3. `_parse_aggregate_count` treats every dot/comma as a thousands separator
- **Files:** `gbp-monitor/harness/capture.py:1099-1107`, mirrored in `run_all.py:1426-1430`
- **Issue:** `cleaned = raw.replace("\u00a0", "").replace(",", "").replace(".", "")` then `int(cleaned)`. Wrong for "1.234,56" (Indonesian thousands+decimal) → 123456 instead of 1234.
- **Impact:** `classify_harvest()` can mis-classify a FULL harvest as REDUCED or vice-versa.
- **Fix:** Strip only one consistent separator type based on locale detection or last-separator heuristic.

---

## YELLOW — Important (edge cases that degrade experience)

### Y3/Y17. Indonesian "kemarin" (yesterday) missing from relative-date parser
- **Files:** `gbp-monitor/parser/relative_date.py:40-70` and `src/lib/gbp/format.ts:71-105`
- **Issue:** Both parsers handle English `yesterday` but NOT Indonesian `kemarin`. Google Maps Indonesian variant emits `kemarin`.
- **Impact:** Unparseable → conservative recency default → false-positive alert.
- **Fix:** Add `kemarin` to both parsers + add contract tests to prevent drift.

### Y5. `backfill_discovered` count never reaches the dashboard
- **Files:** `gbp-monitor/orchestration/run_all.py:1353-1360`, `src/app/api/new-reviews/route.ts`
- **Issue:** Backfill merged silently into seen-store but no `reviews_backfill/` file written.
- **Impact:** Users see `0 new reviews` and assume nothing happened.
- **Fix:** Write a separate `reviews_backfill/` or extend `new-reviews` with `kind` discriminator.

### Y7. Tauri `kill_process_on_port` kills only the parent (no `/T`)
- **File:** `src-tauri/src/main.rs:188-216`
- **Issue:** Uses `taskkill /F /PID` without `/T`. Orphaned children survive close.
- **Fix:** Use `taskkill /T /F /PID` (or call `killProcessTreeByPid`).

### Y10. `PageCrashError` is retried instead of fast-failed
- **Files:** `gbp-monitor/orchestration/run_all.py:1586-1609`
- **Issue:** `_capture_with_retries` retries everything except `SelectorNotFoundError` and `CaptureTimeoutError`. Design intent was to avoid retrying crashes.
- **Fix:** Add `except PageCrashError: raise`.

### Y11. First-harvest 0-review run counted as `success`
- **File:** `gbp-monitor/orchestration/run_all.py:1339-1372`
- **Issue:** `summary["success"] += 1` happens unconditionally, including `first_harvest_skip` branch.
- **Fix:** Only increment success when `len(parsed_dicts) > 0` OR log it as skipped.

### Y14. `_first_probe_url` falls back to `None` silently
- **File:** `gbp-monitor/orchestration/run_all.py:815-836`
- **Issue:** When no resolvable URL exists, stale-NID guard is skipped without warning.
- **Fix:** Log a WARNING.

### Y17. Two divergent implementations of relative-date parser
- **Files:** `src/lib/gbp/format.ts:55-120` vs `gbp-monitor/parser/relative_date.py:81-112`
- **Issue:** TypeScript and Python implementations of the same grammar can drift.
- **Fix:** Add contract tests.

---

## GREEN — Confirmed Working

| ID | System | Evidence |
|----|--------|----------|
| G1 | Variance-proof delta via seen-store + recency gate | `seen_store.py:121-164` |
| G2 | Anti-bot hardening (3-layer Client Hints) | `browser.py:99-184` |
| G3 | Stale-NID detection using self URL first | `run_all.py:815-836` |
| G4 | Click-nearest-newest avoids nav rail | `capture.py:581-608` |
| G5 | Incremental harvest across scroll iterations | `scroll.py:506-513` |
| G6 | Atomic snapshot + summary save | `snapshot_store.py:191-205` |
| G7 | Tenant scoping via `businessDataDir` | `paths.ts:46-49` |
| G8 | `process.kill(pid, 0)` liveness check | `scrape-runner.ts:292-300` |
| G9 | Self-monitoring fallback with `unscrapeable: true` | `self-target.ts:46-72` |
| G10 | `sort_applied` propagation to dashboard | `capture.py:940` → API → UI |
| G11 | First-harvest 0-review skip preserves baseline | `run_all.py:1339-1348` |
| G12 | `validate_listing` content check | `validate_listing.py:38-50` |
| G13 | Panel collapse re-open via multi-candidate | `scroll.py:386-405` |
| G14 | Seen-store migration from old snapshot | `run_all.py:1313-1318` |
| G15 | `--competitors` filter sanitization | `scrape-runner.ts:176-185` |
| G16 | Initial-viewport harvest (newest-first) | `scroll.py:430-469` |
| G17 | Harvest honesty classification | `capture.py:1137-1155` |
| G18 | Lock file with stale-detection | `run_all.py:572-639` |
| G19 | First-run detection | `seen_store.py:166-170` |
| G20 | Conservative recency default | `seen_store.py:121-138` |

---

## Recommendations (prioritized fix list)

### Must-fix (RED)
1. **R1** — Delete dead `--session` push from `scrape-runner.ts`
2. **R2** — Add `runId` to `?active=1` response
3. **R3** — Make `_parse_aggregate_count` locale-aware

### Should-fix (YELLOW)
4. **Y3/Y17** — Add `kemarin` to both parsers + contract tests
5. **Y5** — Write `reviews_backfill/` for backfill visibility
6. **Y7** — Use `taskkill /T /F` in `kill_process_on_port`
7. **Y10** — Add `except PageCrashError: raise`
8. **Y11** — Don't count `first_harvest_skip` as `success`

---

## Test Impact

None of the RED or YELLOW findings break the current offline test suites. The RED findings only surface in:
- **R1** — Tauri production with `GBP_MONITOR_STORAGE_STATE` env
- **R2** — Multi-session or server-restart-during-scrape
- **R3** — Live scrape with non-round review counts (rare)

Recommended new tests: contract test for `kemarin`/`setahun`, unit test for `_parse_aggregate_count`.

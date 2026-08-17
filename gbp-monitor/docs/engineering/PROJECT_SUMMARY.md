# Rother (GBP Monitor) — Project Summary

> Authoritative "everything done so far" reference.
> **As of:** 2026-08-17 (latest commit `f7fbdec`, branch `test/m15-1-validation`)
> Companion docs: `CHANGELOG.md` (per-change memory), `CURRENT_STATE_2026-08-13.md`
> (technical as-of snapshot), `/AGENTS.md` (agent-facing state summary).

---

## 1. What this is

**Rother** is a self-hosted, zero-cost competitor review monitor for Google
Business Profiles (GBP). It watches the review listings of your competitors,
captures new reviews automatically, and surfaces them in a dashboard with
proactive alerts.

Two subsystems:

| Subsystem | Tech | Role |
|---|---|---|
| `gbp-monitor/` | Python 3.12+ (Playwright + Parsel) | Live scraper: NID session → capture → parse → delta → store |
| `src/` | Next.js 16 (App Router, shadcn/ui, Recharts) | Dashboard: overview, branches, compare, reviews, new reviews, alerts, config |

**Constraints** (from `EXECUTION_RULES.md`):
- Rule 1 — every change is tested/proven.
- Rule 2 — every change is logged in `CHANGELOG.md`.
- Rule 3 — no fabricated selectors; verified against real DOM.
- Rule 4 — zero cost: no paid APIs, no new dependencies unless necessary.
- Rule 7 — a broken listing/selector never crashes the whole run.

---

## 2. Goals

1. **Acquire** real Google Maps review data using a real browser session
   (`NID` cookie), with no paid Places API.
2. **Capture** the *FULL* review variant (hundreds of cards), not the ~3 cards
   embedded on the initial page.
3. **Parse** review cards into a structured `Review` record (text, rating,
   reviewer, dates, like counts).
4. **Track** per-competitor deltas (new reviews) run over run.
5. **Verify** every capture with live `--verify` evidence + a selector-health
   report.
6. **Surface** results in a dashboard and notify proactively (webhook/email).
7. Be a **generic, self-hosted tool** for any chain/location — not
   Copenhagen-Bali-specific.

---

## 3. What has been done — milestone history

### M1–M5 (2026-07-20 → 2026-08-13) — core pipeline + production hardening

| Milestone | Outcome |
|---|---|
| **M1 (Initial commit, 2026-07-20)** | Repo scaffolding, initial plan. |
| **M2 (2026-07-23)** | Cross-platform scraping pipeline; Playwright-native timeout architecture (replaced threaded capture timeout). |
| **M3 (2026-07-26)** | "Phase 1 production hardening"; product identity + async update workflow (M15.1 Wave A+B1). |
| **M4 (2026-08-13)** | Live acquisition pipeline + variant investigation framework (`M8`); dashboard hardening released as **v0.2.0**; session-state reference docs. |
| **M5 (2026-08-13)** | FULL-variant acquisition + GMBE-PARITY extension (relative dates → ISO/epoch, like counts); `business_metadata` (address, category, review breakdown); incremental review-card harvest (fixes the ~350-card virtualized-DOM cap). |

### M6+ roadmap (2026-08-16 → 2026-08-17) — the dashboard + productization milestones

| # | Milestone | Status | When |
|---|---|---|---|
| 1 | **Persist `business_metadata` sidecars** (`{ts}.metadata.json`) | DONE | 2026-08-16 (`86bbe72`) |
| 2 | **Wire new `Review` fields + metadata into the dashboard** (likes column, metadata in leaderboard/overview/branches) | DONE | 2026-08-16 (`86bbe72`) |
| 3 | **Stale-NID guard** — probe a reused session jar at bootstrap; detect the REDUCED (~5-card) variant; invalidate + re-warm a stale `NID` | DONE | 2026-08-16 (`48512a3`) |
| 4 | **Surface new-review content in the dashboard** (`/api/new-reviews` + "New Reviews" tab with run selector, "+N" badge) | DONE | 2026-08-16 (`48512a3`) |
| 5 | **Genericize Copenhagen-Bali coupling** — `shortBranchName`/`shortBranchId`, word-cloud stopwords derived from listings, generic `listings.example.json`, README first-run section | DONE | 2026-08-16 (`48512a3`) |
| 6 | **Proactive alerts** — webhook (Slack/Discord/ntfy) + SMTP email after every run via `notifications/notifier.py` | DONE | 2026-08-17 (`fef1f85`) |
| 7 | **SELECTOR_CERTIFICATION re-run** — re-certify schema-v5 selectors against the 12-business set (live probe) + **fix the phone/website extraction bug** + add `opening_hours`/`hours_status` | DONE | 2026-08-17 (`476c613`) |
| 8 | **Generic first-run polish** — guarded config loading (no tracebacks), extended `--validate-config`, new `--init-config` onboarding | DONE | 2026-08-17 (`f7fbdec`) |

**All 8 roadmap items are complete.** The full feature set of the original
monitoring plan is implemented and verified.

---

## 4. Key changes & fixes (highlights)

- **`--init-config` + guarded config loading (2026-08-17, `f7fbdec`)** — A
  missing/malformed `config/listings.json` or `selectors.json` previously
  crashed `run()` with a raw `FileNotFoundError` traceback (exactly what a
  first-run user hits). Now: `_load_json_config` never raises, `run()` aborts
  with a clean failed `run_summary.json` (`competitor_id: __config__`) and
  releases the lock; `--validate-config` checks both config files; `--init-config`
  scaffolds configs from the `.example.json` templates (never overwrites).
- **Phone/website extraction bug fixed (2026-08-17, `476c613`)** — The
  M10-era probe selectors `[data-item-id="telephone"]` and
  `[data-item-id="website"] a` matched **nothing** in this Maps variant, so
  every business reported empty phone/website even though the served DOM
  carries them. A live DOM audit proved the real nodes: `a[href^="tel:"]`
  (phone) and `a[data-item-id="authority"]` (website). Added weekly
  `opening_hours` (`table.eK4R0e`) and `hours_status` extraction.
- **Incremental review-card harvest (2026-08-13)** — Google virtualizes the
  review list (distinct `data-review-id` cards cap at ~350 in the DOM while
  `scrollHeight` keeps growing; old cards unmount as new ones mount). A single
  end-of-run `page.content()` can only ever contain the last ~350 cards. The
  scroll harness now snapshots every distinct card's `outerHTML` each iteration
  and unions them — live result went from ~350 to **200–580 cards/listing**.
- **Stale-NID guard (2026-08-16)** — A reused `storage_state.json` jar whose
  `NID` has gone stale is served the REDUCED variant (~5 cards regardless of
  true count). `probe_review_variant` probes at bootstrap, classifies
  (`_classify_variant`: ≥50 cards → full; ≤20 cards + aggregate ≥100 →
  reduced; else unknown), and on REDUCED renames the jar aside, relaunches a
  fresh context, re-warms, and re-persists. Never raises.
- **`/api/scrape/trigger` default `"live"` (2026-08-13)** — synthetic fixtures
  can no longer be written into production snapshots unless `?mode=fixtures`
  is explicitly requested.
- **Playwright-native timeout architecture (2026-07-23)** — replaced a
  threaded capture timeout with Playwright-native deadlines.
- **Dashboard "Run Now" defaults to live mode; production snapshots restored
  (2026-08-13, `101f016`)**.

---

## 5. Summary of results (as of 2026-08-17)

### Test suites — all green

| Suite | Result |
|---|---|
| `tests/verify_baseline.py` (Python, end-to-end fixtures) | **132/132** (123 prior + 9 first-run checks) |
| `tests/verify_notifications.py` (webhook + SMTP, stubbed) | **25/25** |
| `tests/verify_variant_framework.py` | **32/32** |
| Vitest (frontend) | **77/77** (4 files) |
| `tsc --noEmit` | **0 errors** in `src/` (pre-existing errors only in excluded `rother02/`) |
| `eslint src` | exit 0 |

### Live verification evidence

| Run | Result |
|---|---|
| `data/verify/20260812T073304Z/` | 12/12 PASS (pre-GMBE-PARITY) |
| `data/verify/20260813T061112Z/` | 12/12 PASS (post-GMBE-PARITY; 350-card DOM cap observed) |
| `data/verify/20260813T083706Z/` | 12/12 PASS (incremental-harvest scroll; 200–580 cards/listing, 100% parse, 0 missing) |
| **Production live scrape** `20260813T090503Z` | **12/12 success, 5,021 reviews** |
| `data/verify/20260817T150808Z/selector_cert/evidence.json` | M18-20260817 12-competitor selector certification probe |

### M18-20260817 selector certification (supersedes M10 for schema-v5)

| Selector | Result |
|---|---|
| `reviews_tab_button` | 12/12 stable |
| `review_like_selector` | 11/12 stable (0 on `comp-uluwatu-02` — real negative) |
| `review_list_container` | 12/12 stable |
| phone (`a[href^="tel:"]`) | 10/12 positive, 2 negative |
| website (`a[data-item-id="authority"]`) | 11/12 positive, 1 negative |
| `opening_hours` (weekly table) | 9/12 positive, 3 negative |
| `hours_status` | ~5/12 (semi-stable; weekly `opening_hours` table is canonical) |

### Production data (committed Aug-13 snapshots)

- **12 competitors** across 6 branches, **5,021 reviews** total.
- All 12 `{ts}.metadata.json` sidecars updated (M18) with live-probed
  phone/website/opening_hours/hours_status.
- All `latest.json` pointers valid.

### Repo scale

- **31 commits** (28 with file stats: 920 files changed, ~262k insertions, ~25k deletions).
- `gbp-monitor/`: 51 Python files; `src/`: Next.js app (app/, components/, hooks/, lib/).
- 43 engineering/docs files across audit/architecture/deployment/engineering/management/validation.

---

## 6. Current known limits / UNPROVEN items

These are either impossible in this Maps variant or environment-specific —
**not** open roadmap items:

| Item | State |
|---|---|
| **Owner replies** | Structurally unavailable in this Maps variant (0 hits across ~170 pages + 10 probes). Schema deliberately has no reply field. |
| **Absolute review timestamps** | DOM provides relative dates only (`span.rsqaWe`); dates are approximated to ISO/epoch. |
| **`hours_status`** | Renders for only ~5/12 businesses; weekly `opening_hours` table is the canonical source. |
| **GitHub Actions** | Workflows verified by construction only — cannot execute in this environment. |
| **External webhook/email delivery** | Not exercised against a real target (no credentials configured); transport layer verified with local server + stubbed SMTP. |
| **Phone/website** | Conditional — populated only when the DOM provides them (negative cases are real absences, not failures). |

---

## 7. How to run (cheat sheet)

```powershell
# Dashboard (repo root)
npm install
npx prisma db push
npm run dev                      # http://localhost:3000

# Scraper (gbp-monitor/)
cd gbp-monitor
pip install -r requirements.txt
playwright install chromium
python -m orchestration.run_all --init-config      # first-run scaffold (optional)
python -m orchestration.run_all --validate-config  # config check
python -m orchestration.run_all --fixtures         # offline end-to-end
python -m orchestration.run_all                    # live scrape
python -m orchestration.run_all --verify           # live verification w/ evidence

# Tests
python -m tests.verify_baseline        # CAUTION: wipes data/ — back up first
python -m tests.verify_notifications
npx vitest run
npx tsc --noEmit && npx eslint src
```

> **CAUTION:** `tests/verify_baseline.py` wipes `data/` during its run. Always
> back up `data/` (e.g. `Copy-Item data C:\Users\HP\AppData\Local\Temp\opencode\`)
> before running it, and restore afterwards.

---

## 8. Provenance

- `CHANGELOG.md` — per-change record (timestamp, files, reason, PROVEN/UNPROVEN). Newest at top.
- `docs/engineering/CURRENT_STATE_2026-08-13.md` — technical state snapshot.
- `docs/engineering/DOM_AUDIT.md` — DOM evidence appendices A–D.
- `docs/engineering/SELECTOR_CERTIFICATION.md` / `SELECTOR_CHANGELOG.md` / `SELECTOR_INVENTORY.md` — selector truth + history.
- `docs/engineering/PLACE_ID_REGISTRY.md` / `PRODUCTION_DATASET_CERTIFICATION.md` / `DATASET_INTEGRITY_REPORT.md` — data provenance.
- `/AGENTS.md` — agent-facing "state as of now" reference.
- `docs/validation/` — acquisition/parser/variant investigation reports.
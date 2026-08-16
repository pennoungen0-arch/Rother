# Current State of the Project (2026-08-13)

> Snapshot of the gbp-monitor scraper as of **2026-08-13T11:15:00+07:00**.
> Source: this session's work (Milestones M7/M8/M10/M13B + GMBE-PARITY extension
> + incremental review harvest), the `CHANGELOG.md`, live `--verify` runs, and
> offline test suites.
> This file is the "as of now" reference — read it before extending the scraper.

---

## 1. What this project is

`gbp-monitor` is a zero-cost Google Business Profile monitor. It:

1. **Acquires** a real Google Maps session (`NID` cookie) — no paid APIs (Rule 4).
2. **Captures** the FULL variant of Google Maps listings (Indonesia, en-US locale).
3. **Parses** review cards into a structured `Review` record.
4. **Tracks** per-competitor delta (new reviews) and optionally **exports** them.
5. **Verifies** every capture (live `--verify`) and ships a selector-health report.

It lives at the repo root `gbp-monitor/`; the parent repo also contains a
Next.js dashboard (`src/`) for future UI work.

### Current capture pipeline (per listing)

```
navigation → reviews_dialog_verify → [overview metadata] → open_reviews_tab
→ scroll (JS-hunt container) → expand → html_capture → business_metadata → parse
```

All steps are best-effort and deadline-bounded (`_CAPTURE_TOTAL_TIMEOUT_S = 90`);
a broken selector degrades gracefully and never kills the run (Rule 7: listing
failure isolation).

---

## 2. Proven capabilities (as of now)

| Capability | Status | Evidence |
|------------|--------|----------|
| FULL-variant acquisition via `NID` cookie | **PROVEN** | M7; live runs serve FULL variant w/ 12/12 success |
| Warm-up + `data/storage_state.json` reuse | **PROVEN** | M8 acquisition tests (8 offline checks) |
| Real `place_id` for all 12 competitors | **PROVEN** | CHANGELOG 13:40; hex→ChIJ round-trip validators |
| Live scraping of FULL listings | **PROVEN** | live `--verify` 12/12 PASS (20260812T073304Z) |
| Reviews-tab full-list capture | **PROVEN** | GMBE-PARITY; 100–410 reviews/listing vs 3 embedded |
| Relative-date → ISO + epoch resolution | **PROVEN** | GMBE-PARITY Phase 6 tests (16 checks) |
| Like-count extraction | **PROVEN** | parser tests + live HTML (0/None correctly assigned) |
| Business address/category/per-star breakdown | **PROVEN** | live probes (Anomali, KAFE Ubud) |
| Selector health reporting | **PROVEN** | `selector_report.json` healthy=2 degraded=0 |
| Phase-stack instrumentation (no spurious warnings) | **PROVEN** | live run 20260812T072806Z |
| Traversal-safe competitor IDs | **PROVEN** | M13B security tests |
| Offline suites | **PROVEN** | verify_baseline 108/108, verify_variant_framework 32/32 |

---

## 3. Current data model — `Review`

`parser/schema.py` is the single source of truth. Serialization goes through
`review_to_dict()` (`dataclasses.asdict`), so adding fields is backward-safe.

```python
@dataclass
class Review:
    review_id: str
    competitor_id: str
    branch_id: str
    reviewer_name: str | None
    rating: float | None
    text: str | None
    relative_date: str | None          # e.g. "2 minggu lalu", "a month ago"
    scraped_at: str                    # ISO 8601, UTC
    # GMBE-PARITY fields (all optional; added 2026-08-13)
    review_date: str | None            # ISO date, approximated from relative_date
    review_date_epoch: float | None    # UTC epoch seconds, approximated
    review_like_count: int | None      # 0 when like button shows no number; None when absent
```

`Review` is used across parser, storage, delta, and orchestration layers.

---

## 4. Selector configuration (current)

`config/selectors.json` — **schema version 5**.

| Key | Value | Notes |
|-----|-------|-------|
| `review_container` | `div.m6QErb[role='region']`,+ tier | RESOLVED via **JS hunt** first (see §5) |
| `review_item` | `div.jftiEf.fontBodyMedium` | review card seed |
| `review_id_attr` | `data-review-id` | unique ID (dedup target) |
| `reviewer_name_attr` | `aria-label` | reviewer display name |
| `review_text_selector` | `span.wiI7pd` | review text |
| `rating_selector` / `rating_attr` | `span.kvMYJc` / `aria-label` | star rating |
| `relative_date_selector` | `span.rsqaWe` | relative date text |
| `expand_text_button` | `button.w8nwRe.kyuRq`,+ `button:has-text('More')` | expand truncated |
| `reviews_tab_button` | `button[role='tab'][aria-label^='Ulasan']`,+ `...^='Reviews']` | **NEW** — opens full list |
| `review_like_selector` | `button.gllhef` | **NEW** — like count |
| `review_list_container` | `div.m6QErb.XiKgde` | **NEW** — documented tab list (JS-hunt used) |

Full inventory + health tiers: `docs/engineering/SELECTOR_INVENTORY.md`,
`SELECTOR_CERTIFICATION.md`, `SELECTOR_CHANGELOG.md`.

---

## 5. The Reviews-tab capture logic (GMBE-PARITY)

The initial page embeds only **3** review cards. Clicking the Reviews tab
(`reviews_tab_button`) loads a virtualized list (230+ for Crate Cafe).

- `harness/capture.py` `_open_reviews_tab()` opens the tab **best-effort** —
  on failure it logs and proceeds with the embedded reviews.
- `harness/scroll.py` `_resolve_container_with_fallback()` first runs a
  **JS hunt** (`_hunt_review_container`): finds the `div.m6QErb` with the most
  distinct `data-review-id`, builds a validated CSS path, and returns it. Only
  if the hunt fails does it fall back to the configured CSS tiers.
  → This is why scroll now targets the *real* list container in both views.
- Live result: 100–410 reviews/listing captured (was 3).

### Incremental card harvest (fixes the ~350 virtualized-DOM cap)

Google **virtualizes** the review list: distinct `data-review-id` count in the
DOM caps at ~350 (20, 30, …, 350) while `scrollHeight` keeps growing
(11,644 → 202,056 px for Crate Cafe) — old cards are unmounted as new ones
mount. So a single end-of-run `page.content()` can only ever contain the last
~350 rendered cards; that was the hard ceiling pre-harvest.

`harness/scroll.py` now snapshots every distinct review card's `outerHTML` on
each scroll iteration (`_harvest_review_cards` / `_JS_HARVEST_REVIEW_CARDS`),
accumulates by `data-review-id`, and returns the union
(`harvested_reviews` / `harvested_count`). `capture.py` reconstructs a full
synthetic document from the harvested cards for the parser (raw final DOM is
still saved as `page.html`; harvested doc as `harvested_reviews.html`). The
parser now sees the FULL set seen across all scrolls, not the tail window.

Supporting knobs (raised 2026-08-13 so 5k-review listings can finish):
`MAX_SCROLLS` 40 → 400, `SCROLL_WAIT_MS` 2500 → 1200,
`_CAPTURE_TOTAL_TIMEOUT_S` 90 → 360 (run_all.py). Offline suites stay green
(108/108 + 32/32). Full live re-verification still pending.

---

## 6. Business metadata (current)

`_capture_business_metadata()` in `harness/capture.py` extracts:

| Field | Source | Notes |
|-------|--------|-------|
| `business_name` | JSON-LD → h1 → title fallback | |
| `google_rating` / `google_review_count` | JSON-LD → body regex | |
| `address` | `button[data-item-id="address"]` (aria-label/`.Io6YTe`) | **NEW** — captured *before* tab opens |
| `category` | `button[jsaction*="category"]` | **NEW** |
| `phone` / `website` | `[data-item-id="telephone"]` / `...website] a` | **NEW** — conditional (Crate has neither) |
| `review_breakdown` | `tr.BHOKXe` `aria-label="Bintang 5,3.242 ulasan"` | **NEW** — per-star, tab view only |

**Persistence (2026-08-16):** metadata is now persisted alongside each snapshot
as a `{ts}.metadata.json` sidecar (`storage/snapshot_store.py`) — the scraper
passes `instrument.business_metadata` through `save_snapshot`. Dashboard reads
it via `readLatestBusinessMetadata`/`readAllBusinessMetadata`
(`src/lib/gbp/server-data.ts`) and surfaces address/category in the competitor
leaderboard and metadata per-competitor in `/api/overview` + `/api/branches`.
The 12 production snapshots were backfilled from the `20260813T083706Z` verify
evidence. Note: `phone`/`website` were absent in that verify capture (conditional
DOM), so those fields are null until a live capture renders them.

Evidence + exact DOM: `docs/engineering/DOM_AUDIT.md` Appendix C.

### 6a. Stale-NID guard (2026-08-16)

Google serves the FULL review variant only when the context holds a valid `NID`
cookie; a reused `storage_state` jar whose `NID` has gone stale is served the
REDUCED variant (~5 cards regardless of the true count). To stop a stale jar
from silently wasting a full run, the orchestrator now:

1. **Probes** the first competitor URL at bootstrap (`probe_review_variant` in
   `harness/capture.py`): navigate → verify reviews dialog → open Reviews tab →
   bounded incremental container scroll (`_PROBE_MAX_SCROLLS`=12) → count distinct
   `data-review-id` cards; the page's aggregate review count is parsed from the
   header so a genuinely small listing is not misread as REDUCED.
2. **Classifies** via `_classify_variant`: ≥50 distinct cards → `full`; ≤20 cards
   with aggregate ≥100 → `reduced`; otherwise `unknown` (Rule 7 — proceed).
3. **Recovers** on `reduced` (`_ensure_full_variant` in `orchestration/run_all.py`):
   `invalidate_stale_storage_state` renames the jar to
   `storage_state.stale-<ts>.json`, the context is torn down, a fresh context is
   launched with no storage_state, `warm_up` issues a new NID, and the new jar is
   persisted. Structured events: `acquisition_probe`, `acquisition_stale_nid_detected`,
   `acquisition_re_warm`.

Wired into both `run()` (live bootstrap) and `run_verify()` bootstrap. Never
raises — probe failures degrade to `unknown` and the run proceeds.

---

## 7. Confirmed NOT available in this Maps variant

Per **Rule 3** (verify the DOM; no fabricated selectors) — do NOT re-attempt these:

| Feature | Evidence |
|---------|----------|
| **Owner replies** | 0 hits across ~170 pages + 10 probes (incl. lowest-rating sort, AYANA search+tab, 230-review deep scroll). Variant does not render replies in DOM. |
| **Absolute review timestamps** | `span.rsqaWe` relative-only; no `title`/`datetime` attr. Dates must be approximated (see `parser/relative_date.py`). |
| **JSON-LD structured data** | 0 `application/ld+json` blocks in any captured page. |
| **Absolute business hours / busy times** | not present in captured DOM. |

Full table: `docs/engineering/DOM_AUDIT.md` Appendix D.

---

## 8. Verification & quality gates

### Offline suites (must stay green)
- `tests/verify_baseline.py` — **108/108** (Phase 0–6: artifacts, security, acquisition, GMBE-parity)
- `tests/verify_variant_framework.py` — **32/32**
- `--validate-config` — PASSED

Run both suites and `--validate-config` before and after any change, per Rule 1.

### Live verification
```bash
python -m orchestration.run_all --verify      # 12 listings, writes data/verify/<ts>/
```
Writes `report.json`, `selector_report.json`, and per-listing evidence
(4 PNGs, `page.html`, review_stats, scroll_progress, business_metadata,
pipeline_summary).

### Latest live evidence
- `data/verify/20260812T073304Z/` — 12/12 PASS (**pre-GMBE-PARITY**)
- `data/verify/20260813T032822Z/` — **partial** (aborted): 5 listings passed with
  100–340 reviews each; comp-ubud-02 failed once on transient 30s nav timeout
  (degraded page), retested clean via probe.
- `data/verify/20260813T061112Z/` — **12/12 PASS** (clean post-GMBE-PARITY);
  350-review DOM cap observed on Crate Cafe (comp-canggu-01: dom_nodes 20→350
  while scrollHeight grew 11,644→202,056) — this is the virtualization
  evidence that motivated the incremental-harvest fix (see §5).
- `data/verify/20260813T083706Z/` — **12/12 PASS** (incremental-harvest scroll);
  harvest fix proven live: 200–580 cards/listing (dom grew past 350 to 480–580
  with bottom=stable_scroll, 100% parse efficiency, 0 missing). Note: this
  `--verify` run needs a fresh NID; a stale `storage_state` NID served the
  REDUCED 5-card variant (07:54 run), so the stale jar must be replaced before
  live runs (see §8 onboarding).
- **Production live scrape** `data/run_summary.json` (20260813T090503Z, mode=live,
  run_id 20260813T090503Z): **12/12 success, 5,021 reviews** (570 Crate Cafe,
  620 Nusa Dua, 560 Sanur, etc.), snapshots under `data/snapshots/*/2026-08-13T09-*.json`.
- Single-listing probes: Anomali Coffee 410 reviews, KAFE Ubud 8 (small listing).

---

## 9. Current gaps / UNPROVEN items

1. ~~**Live `--verify` with incremental harvest**~~ — **NOW PROVEN**: the 12/12
   `data/verify/20260813T083706Z/` run confirms 200–580 cards/listing (dom past
   350, bottom=stable_scroll, 100% parse, 0 missing) and the production live
   scrape (5,021 reviews) confirms the whole pipeline end-to-end.
2. **Owner replies** — structurally unavailable in this variant (see §7); the
   schema deliberately does NOT carry a reply field until a variant renders one.
3. **Absolute review dates** — approximated only; no absolute source in DOM.
4. **GitHub Actions** — cannot execute in this environment; workflows verified
   by construction only.
5. **Phone/website** — vary by business; only populated when the DOM provides
   them (conditional extraction).
6. **Dashboard mode default** — `/api/scrape/trigger` now defaults to `"live"`
   (fixed 2026-08-13T16:30+07:00); synthetic fixtures can no longer be written
   into production snapshots unless `?mode=fixtures` is explicitly requested.

---

## 10. Next logical steps (when you pick this back up)

1. ~~**Persist `business_metadata` into snapshot storage**~~ — **DONE 2026-08-16**:
   sidecar `{ts}.metadata.json` files written by `save_snapshot`; dashboard
   reads + surfaces them.
2. ~~**Wire the new `Review` fields + metadata into the Next.js dashboard**~~ —
   **DONE 2026-08-16**: `Review` now carries `review_date`/`review_date_epoch`/
   `review_like_count`; "Likes" column in the reviews table; metadata shown in
   the competitor leaderboard + `/api/overview` + `/api/branches`.
3. Re-run `SELECTOR_CERTIFICATION` for the new selectors against a larger
   business set (phone/website positive and negative cases).
4. ~~**Add a stale-NID guard**~~ — **DONE 2026-08-16**: `probe_review_variant`
   probes a reused jar at bootstrap (navigate → reviews tab → bounded scroll →
   count distinct `data-review-id` cards vs the page's aggregate review count);
   on REDUCED detection the stale jar is invalidated (renamed aside), the
   context relaunched fresh, re-warmed, and re-persisted. Structured events
   `acquisition_probe` / `acquisition_stale_nid_detected` / `acquisition_re_warm`.
5. ~~**Surfacing delta content (new reviews) in the dashboard**~~ — **DONE
   2026-08-16**: `/api/new-reviews` groups delta files by run and returns the
   full new-review objects (text, rating, reviewer, dates, likes); new "New
   Reviews" tab renders per-competitor review cards with a run selector and a
   "+N" tab badge. Deltas were previously count-only in the UI.
6. ~~**Genericize Copenhagen Bali coupling**~~ — **DONE 2026-08-16**: branch
   names are shortened by a generic chain-prefix stripper
   (`shortBranchName`/`shortBranchId` in `format.ts`) instead of hardcoded
   `Copenhagen Bali`/`cph-` regexes (7 call sites); the word cloud derives its
   brand/location stopwords from the configured listings instead of hardcoded
   Bali place names; `config/listings.example.json` is a generic template;
   README has a first-run "Configuration" section. Remaining from the
   productization item: proactive alerts (webhook/email on new reviews) +
   generic first-run polish.
7. **Productization (self-hosted tool):** proactive alerts (webhook/email on
   new reviews), generic README/first-run flow polish.

---

## 11. Provenance pointers

- `CHANGELOG.md` — every change with timestamp, files, reason, PROVEN/UNPROVEN.
- `EXECUTION_RULES.md` — Rule 1 (test/prove), Rule 2 (changelog), Rule 3 (no
  fabricated selectors), Rule 4 (zero cost), Rule 7 (listing failure isolation).
- `docs/engineering/DOM_AUDIT.md` — Appendices A–D (GMBE-PARITY evidence).
- `docs/engineering/SELECTOR_CHANGELOG.md` — selector additions/removals.
- `docs/validation/M7_FULL_ACQUISITION.md`, `M7_VARIANT_INVESTIGATION_FRAMEWORK.md`
  — FULL-variant acquisition + variant classifier.
- `data/storage_state.json` (gitignored) — reusable NID jar. Never commit.
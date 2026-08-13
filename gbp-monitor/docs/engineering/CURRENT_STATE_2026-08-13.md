# Current State of the Project (2026-08-13)

> Snapshot of the gbp-monitor scraper as of **2026-08-13T10:40:00+07:00**.
> Source: this session's work (Milestones M7/M8/M10/M13B + GMBE-PARITY extension),
> the `CHANGELOG.md`, live `--verify` runs, and offline test suites.
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

Evidence + exact DOM: `docs/engineering/DOM_AUDIT.md` Appendix C.

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
- Single-listing probes: Anomali Coffee 410 reviews, KAFE Ubud 8 (small listing).

---

## 9. Current gaps / UNPROVEN items

1. **Full 12/12 `--verify` after GMBE-PARITY** — the 20260813T032822Z run was
   aborted mid-way; a clean 12/12 live pass has not been recorded since the
   tab/scroll change. (Multi-listing timing/deadline impact untested end-to-end.)
2. **Owner replies** — structurally unavailable in this variant (see §7); the
   schema deliberately does NOT carry a reply field until a variant renders one.
3. **Absolute review dates** — approximated only; no absolute source in DOM.
4. **GitHub Actions** — cannot execute in this environment; workflows verified
   by construction only.
5. **Phone/website** — vary by business; only populated when the DOM provides
   them (conditional extraction).

---

## 10. Next logical steps (when you pick this back up)

1. Record a clean 12/12 `--verify` (fix any transient-listing fragility first —
   e.g. retry degraded pages, tighten nav timeout on ubud-02).
2. Consider persisting `business_metadata` into snapshot storage (currently
   emitted via instrumentation only).
3. Wire the new `Review` fields + metadata into the Next.js dashboard (`src/`).
4. Re-run `SELECTOR_CERTIFICATION` for the new selectors against a larger
   business set (phone/website positive and negative cases).

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
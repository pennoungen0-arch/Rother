# Harvest Completeness & Delta-Noise Audit — 2026-08-24

**Trigger:** user observation — "Crate Cafe has 5,000+ reviews on Google
Maps, but Rother retrieves only ~500–650. Same for competitors. Is there a
cap? Does retrieval just take minutes?"

**Scope:** scraper harvest depth (S3/S4), delta/new-review correctness (S5),
honesty of completeness signals (S6). Tauri desktop effort is explicitly
GATED behind this audit's fixes (see HARVEST_FIX_PLAN.md).

---

## 1. Is there a cap? — No Rother cap; a Google rendering ceiling

Verified in code:

- `MAX_SCROLLS = 400` (harness/scroll.py:11) — up to 400 scroll iterations;
  **no review-count limit exists anywhere**.
- The loop stops early when `_detect_bottom()` (scroll.py:285) confirms
  bottom — primary signal `stable_scroll`: container scrollHeight AND DOM
  node count both unchanged between iterations.
- Live evidence: crate-cafe stopped at 510 cards (56 iterations,
  `bottom=stable_scroll`, height 306,481px); revolver at 580 (60 iterations).
  Google's review panel **stopped appending cards** — the panel virtualizes
  and in practice ceases serving new cards somewhere in the ~500–1,000 range
  for large listings, regardless of the true total.
- The codebase already knows this: run_all.py parser-efficiency comment —
  *"Pre-harvest this was max_visible (the virtualization cap, ~350); with
  incremental harvest it is the full list seen across all scrolls."*

**Verdict:** the ~500–650 ceiling is a **platform limitation**, not a Rother
bug. Rother honestly harvests everything the browser will render.

## 2. Timing — minutes per business is by design

Per listing: goto ~1–8s → open reviews tab ~3–8s → scroll 88–98s (56–60 ×
~1.5s, physically scrolling a lazy-loaded list) → expand ~35s (300+ "More"
button clicks) → parse <1s. Total ~2–4 min/business. This is real browser
work against an infinite-scroll UI, not a loading defect.

## 3. Honesty gap — the "how complete was this harvest?" signal is degraded

- `google_review_count` IS extracted (capture.py:301–347: aggregateRating
  LD-JSON + regex fallback) and stored in `parser_efficiency`.
- The M16 stale-NID guard classifies harvests FULL / reduced / unknown by
  comparing harvested cards vs that aggregate (tests: "350 cards + big
  aggregate ⇒ reduced"; "600 cards + big aggregate ⇒ full").
- **BUT** in the user's live runs `BUSINESS_META[crate-cafe] rating=?
  reviews=?` — the metadata probe was DEGRADED (also flagged in
  selector_report `healthy=1, degraded=1` on 2026-08-22). With
  `google_count=None`, harvest status lands on "unknown" instead of the
  honest "reduced: 510 of ~5,009".
- None of this surfaces on the dashboard: a snapshot that captured 10% of
  the listing looks identical to a 100% one.

## 4. Delta noise — render variance produces phantom "new reviews"

`compute_new_reviews()` (storage/delta.py) is a pure ID-set diff: new IDs
not in the previous snapshot. The snapshot is **overwritten** each run
("complete recent baseline" semantics).

Consequence: when Google renders a different subset across runs (observed:
crate-cafe 650 reviews ~16:00 vs 510 ~21:30 — same day, same selectors),
the ID-set diff counts the not-re-rendered old reviews as NEW:

- 2026-08-24 21:30 run: `new_reviews=240` — overwhelmingly render variance,
  not genuinely new reviews. These flow into notifications and the
  new-reviews feed → alert fatigue + distrust.
- The variance also means the "baseline" is unstable: any two consecutive
  runs of the same listing can differ by 10–25% in rendered IDs.

## 5. What this means for the product

- For **monitoring** (detect new reviews), a ~500-deep "newest window" is
  functionally sufficient — new reviews appear at the TOP of the list.
- For **lifetime analytics**, current distributions/trends are computed from
  the ~500-most-recent sample and skew recent; that is acceptable IF labeled
  honestly (see fix plan Phase 3).
- Deep backfill (all 5,009) is NOT realistically achievable against Google's
  virtualized panel (they deliberately fight it); chasing it is a tar pit.
  Explicitly out of scope.

## 6. Verdict

The user is right on strategy: **harden the localhost core before any Tauri
packaging.** Specifically: (1) make harvest completeness honest and visible,
(2) make deltas variance-proof. Both are well-scoped; see HARVEST_FIX_PLAN.md.

# Rother Improvement Plan — September 2026

> **Goal:** Systematically close the presentation-layer gap between Rother and GMB Everywhere, while preserving Rother's monitoring/data-ownership moat.
>
> **Source:** `discussion_history/GMB-Everywhere-Overview.md` + `discussion_history/info_gmbeverywhere_googleaimode.txt` + `GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md` + current codebase audit.

---

## 1. Current State Snapshot

### Rother is Ahead On:
- **Persistent monitoring** (scheduled scrapes → snapshots → delta detection)
- **Historical data** (versioned snapshots with metadata sidecars)
- **New-review detection** (ever-seen ID union with 30-day recency gate)
- **Self-hosting** (zero recurring cost, full data export)
- **Anti-bot hardening** (Fix A: client-hints spoofing, NID jar warming)

### Rother Lags On (Presentation Layer):
- **No "Showing X of Y" indicator** on reviews page (GMB Everywhere shows total count prominently)
- **No keyword badges** on reviews (GMB Everywhere does keyword discovery)
- **Limited comparison** (radar chart only — no categories, services, hours comparison table)
- **No startup feedback** in Tauri (extension is instant; Tauri launches Python silently)
- **No harvest completeness bar** on competitor cards (metadata exists but isn't surfaced)

---

## 2. Prioritized Improvement Roadmap

### Phase 1: Data Presentation Fixes (High Priority)
**Goal:** Surface data that Rother already collects but doesn't display.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 1.1 | "Showing {captured} of {google_count} reviews" header on Reviews page | `reviews-section.tsx`, `server-data.ts` | Small | Yes — `readHarvestInfo` returns `google_review_count` |
| 1.2 | Harvest completeness mini-bar on competitor cards | `branches-section.tsx` | Small | Yes — `harvest_status` + `google_review_count` in `CompetitorStats` |
| 1.3 | Sort status badge on competitor cards | `branches-section.tsx` | Small | Yes — `sort_applied` in `CompetitorStats` |
| 1.4 | Keyword search badge count (matches in current window) | `reviews-section.tsx` | Medium | Partial — `q` param exists; add keyword match highlighting |
| 1.5 | "New review" badges in review table | `reviews-section.tsx` | Medium | Yes — delta data exists via `/api/new-reviews` |

**Verification:** vitest (new test cases) + Playwright e2e assertions on Reviews page.

### Phase 2: Comparison Table Enhancement (Medium Priority)
**Goal:** Build GMB Everywhere's Local Scan comparison table for our competitors.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 2.1 | Categories comparison column in comparison table | `c-comparison.tsx` | Medium | Requires scraper extraction of categories from GPB page |
| 2.2 | Hours comparison column in comparison table | `c-comparison.tsx` | Medium | Yes — `hours_status` in snapshot metadata |
| 2.3 | Services comparison (if extractable) | Requires new scraper | Large | Partial — categories exist, services may need new selectors |
| 2.4 | Distance/proximity column (geo-grid data) | `c-comparison.tsx` | Medium | Yes — `lat`/`lng` on competitor configs |

**Verification:** vitest + Playwright on comparison feature.

### Phase 3: Tauri Experience (Medium Priority)
**Goal:** Close the "extension is instant" gap for desktop users.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 3.1 | Startup progress indicator (Python warm-up, NID check) | `run-screen.tsx`, `setup/detect` API | Medium | Partial — `/api/scrape/status` exposes progress |
| 3.2 | Copy logs button in RunScreen | Already exists, verify in Tauri webview | Small | Done |
| 3.3 | Error recovery cards with copy-paste commands | `run-screen.tsx` | Medium | Partial — error info available from API responses |
| 3.4 | GBP_ROOT path writability validation | `main.rs` first_run_scaffold | Small | Already added in v0.4.2 |

**Verification:** Manual Tauri build + test.

### Phase 4: Web Deployment (High Priority — Already in Progress)
**Goal:** Zero-command client access via Fly.io/Docker.

| # | Improvement | Where | Effort |
|---|---|---|---|
| 4.1 | Docker deployment (multi-stage Dockerfile) | `Dockerfile` | Done ✅ |
| 4.2 | Fly.io config (fly.toml) | `fly.toml` | Done ✅ |
| 4.3 | Chromium memory optimization (M15) | `browser.py`, env vars | Done ✅ |
| 4.4 | Deployment guide | `DEPLOYMENT_OPTIONS.md` | Done ✅ |
| 4.5 | Add `GBP_MONITOR_TIGHT_MEMORY` to fly.io secrets | fly.toml | Done ✅ |

### Phase 5: Monitoring Data Enrichment (Low Priority — Future)
**Goal:** Expand beyond reviews to match GMB Everywhere's "Basic Audit."

| # | Feature | Where | Effort |
|---|---|---|---|
| 5.1 | Categories extraction in scraper | `capture.py`, `schema.py` | Large |
| 5.2 | Services extraction in scraper | `capture.py`, `schema.py` | Large |
| 5.3 | Post Audit (GBP posts) | New scraper module + parser | Large |
| 5.4 | Website Audit (external site fetch + analysis) | New pipeline | Large |
| 5.5 | Local Scan (geo-rank heatmap) | `c-geo-grid.tsx` | Medium |

**All explicitly deferred** per AGENTS.md and the GMB Everywhere analysis: "the architecture is a reasonable foundation" for these phases.

---

## 3. Implementation Order

**Week 1:**
1. Phase 1.1 — "Showing X of Y" header in reviews page
2. Phase 1.2 — Harvest completeness bar on competitor cards  
3. Phase 1.3 — Sort status badge on competitor cards (ensure already implemented)

**Week 2:**
4. Phase 1.4 — Keyword search highlights + match count
5. Phase 1.5 — New review badges in review table

**Week 3:**
6. Phase 2.2 — Hours comparison column
7. Phase 2.4 — Distance/proximity column
8. Phase 2.1 — Categories comparison (if data available from snapshots)

**Week 4:**
9. Phase 3.1 — Tauri startup progress indicator
10. Phase 3.3 — Error recovery cards

---

## 4. Rules Compliance Checklist

- [x] **Rule 1:** Every change will be tested before and after.
- [x] **Rule 2:** Every change will be logged in `gbp-monitor/CHANGELOG.md`.
- [x] **Rule 3:** No fabricated selectors — all new selectors verified against real DOM or existing snapshot data.
- [x] **Rule 4:** Zero cost — all improvements use existing data infrastructure + open-source libraries already in the project.
- [x] **Rule 7:** Error states degrade gracefully — no UI crashes from missing data.

---

## 5. Success Criteria

- [ ] `npx vitest run` ≥ 134/134 tests green (new test cases added)
- [ ] `npx playwright test` 20/20+ green (new e2e assertions)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint src` — 0 errors, 0 warnings
- [ ] `npm run build` — successful production build
- [ ] Fly.io deployment tested and serving dashboard on URL
- [ ] Tauri build tested with startup progress indicator

---

## 6. What We Deliberately Do NOT Build (Yet)

Per the GMB Everywhere analysis and AGENTS.md:

| GMB Everywhere Feature | Why We Skip (This Phase) |
|---|---|
| Teleport/Rank Check | Requires geo-spoofing infrastructure — different product scope |
| AI Review Response Generator | Forbidden by Rule 4 (no paid APIs, zero cost) |
| Category Finder (SEO research) | Different product scope (research vs monitoring) |
| Website Audit | External site fetch + analysis = new data pipeline |
| AI tools (Post Generator, etc.) | Explicitly forbidden in current scope |

The current Rother architecture (data acquisition layer) is the hardest part and is already solid. These features can be added as product layers once the foundation is proven.

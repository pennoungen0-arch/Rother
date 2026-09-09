# Rother Improvement Plan — September 2026

> **Goal:** Systematically close the presentation-layer gap between Rother and GMB Everywhere, while preserving Rother's monitoring/data-ownership moat.
>
> **Source:** `discussion_history/GMB-Everywhere-Overview.md` + `discussion_history/info_gmbeverywhere_googleaimode.txt` + `GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md` + current codebase audit.

---

## 1. Current State Snapshot (Codebase Audit — 2026-09-09)

### Already Implemented (from CORE_SYSTEMS_FIX_PLAN.md + branches-section.tsx)
- ✅ Sort status badge on competitor cards (green "Sorted newest" / yellow "Default order")
- ✅ Harvest completeness bar on competitor cards (mini-progress bar with %)
- ✅ "Showing X of Y" pattern in sheet view (CompetitorReviewList shows "Harvested {total_reviews} of ~{google_review_count}")
- ✅ Partial window badge on competitor cards
- ✅ New review badges (+N new) on competitor cards
- ✅ Self-monitoring status indicator (unscrapeable badge)
- ✅ Verified/unverified badges

### Still Missing (GMB Everywhere-inspired gaps)
- ❌ **Keyword highlight in reviews table** — search matches are found but not highlighted in the text
- ❌ **Keyword match count indicator** (e.g., "3 matches for 'staff'")
- ❌ **New review markers in review table** — new reviews (from delta) aren't visually marked in the table
- ❌ **Categories comparison column** — snapshot metadata has `category` field but not surfaced in comparison table
- ❌ **Hours comparison column** — `opening_hours` + `hours_status` in metadata not surfaced in comparison
- ❌ **Hours status in competitor cards** — metadata has `hours_status` but not shown on card
- ❌ **Business metadata (phone, website, address) in sheet view** — available in snapshots but not displayed

### Rother's Moat (What We Do Better Than GMB Everywhere)
- ✅ Automated monitoring (scheduled scrapes, not manual session)
- ✅ New-review detection + alerts (GMB Everywhere is session-scoped)
- ✅ Full data export (GMB Everywhere explicitly does NOT allow export)
- ✅ Self-hosted (zero recurring cost)

---

## 2. Prioritized Improvement Roadmap

### Phase 1: Reviews Table UX (High Priority)
**Goal:** Make the ~500 captured reviews more useful through better presentation.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 1.1 | Keyword match highlighting in review text | `reviews-section.tsx` | Small | ✅ Search param exists, just highlight matches |
| 1.2 | Match count indicator ("3 matches for 'staff'") | `reviews-section.tsx` | Small | ✅ Same, count matches per row |
| 1.3 | New review markers in table (from delta) | `reviews-section.tsx` | Medium | Partial — need API to return which reviews are "new" |
| 1.4 | "Showing X of Y" in reviews header | `reviews-section.tsx` | Small | ✅ `google_review_count` in harvest info |

**Verification:** vitest (new test cases) + Playwright e2e assertions.

### Phase 2: Comparison Table Enhancement (Medium Priority)
**Goal:** Enrich the competitor comparison table with business metadata.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 2.1 | Hours comparison column | `c-comparison.tsx` | Medium | ✅ `hours_status` in snapshot metadata |
| 2.2 | Category comparison column | `c-comparison.tsx` | Medium | ✅ `category` in snapshot metadata |
| 2.3 | Phone/website comparison | `c-comparison.tsx` | Medium | ✅ In snapshot metadata |
| 2.4 | Distance/proximity column (already have geo-grid) | `c-comparison.tsx` | Medium | ✅ `lat`/`lng` on configs |

**Verification:** vitest + Playwright on comparison feature.

### Phase 3: Business Metadata Exposure (Medium Priority)
**Goal:** Show business metadata (phone, website, hours, category) in sheet view.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 3.1 | Show hours_status on competitor cards | `branches-section.tsx` | Small | ✅ In `CompetitorStats` metadata |
| 3.2 | Show business metadata in review sheet header | `branches-section.tsx` | Medium | ✅ In snapshot metadata, need to join |
| 3.3 | Show phone/website links in sheet view | `branches-section.tsx` | Medium | ✅ In snapshot metadata |

### Phase 4: Tauri Experience (Medium Priority)
**Goal:** Close the "extension is instant" gap for desktop users.

| # | Improvement | Where | Effort | Data Available? |
|---|---|---|---|---|
| 4.1 | Startup progress indicator (Python warm-up, NID check) | `run-screen.tsx` | Medium | Partial — `/api/scrape/status` exposes progress |
| 4.2 | Error recovery cards with copy-paste commands | `run-screen.tsx` | Medium | Partial — error info from API responses |

### Phase 5: Web Deployment (Already Complete)
All Docker/Fly.io work done (v0.4.4).

### Phase 6: Data Enrichment (Future — Low Priority)
Categories/services extraction, Posts monitoring, Website Audit — explicitly deferred.

---

## 3. Implementation Order

**Week 1 — Reviews Table UX (High Priority):**
1. Phase 1.1 — Keyword match highlighting in review text
2. Phase 1.2 — Match count indicator
3. Phase 1.4 — "Showing X of Y" in reviews header

**Week 2 — Business Metadata Exposure:**
4. Phase 3.1 — Show hours_status on competitor cards
5. Phase 3.2 — Show business metadata in sheet view (category, phone, website)

**Week 3 — Comparison Table:**
6. Phase 2.1 — Hours comparison column
7. Phase 2.2 — Category comparison column

**Week 4 — Tauri Experience:**
8. Phase 4.1 — Startup progress indicator
9. Phase 4.2 — Error recovery cards

**Ongoing:**
- Full test suite after each change: `npx vitest run && npx tsc --noEmit && npx eslint src`

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

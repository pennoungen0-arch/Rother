# Rother — Comprehensive Fix Plan

**Last updated:** 2026-08-21  
**Branch:** `test/m15-1-validation`  
**Status:** In Progress

---

## Executive Summary

This plan addresses all known issues discovered during testing. Issues are prioritized by impact on user experience and development velocity.

| Priority | Count |
|----------|-------|
| 🔴 Critical (blocks core functionality) | 2 |
| 🟠 High (blocks good UX) | 4 |
| 🟡 Medium (performance/quality) | 4 |
| 🟢 Low (nice to have) | 1 |

---

## 🔴 Critical Fixes (Do First)

### Fix 1: Install Playwright Chromium for Live Scraping
**Impact:** Live scraping completely fails without it  
**Status:** Not done  
**Effort:** 2 min

```bash
cd gbp-monitor
python -m playwright install chromium
# Or with system deps:
python -m playwright install chromium --with-deps
```

**Verification:**
```bash
cd gbp-monitor
python -m orchestration.run_all --validate-config
# Should show: "All 3 competitors have real place_ids — ready for live scrape"
```

---

### Fix 2: Add Dashboard Scrape Status UI (Progress, Loading States)
**Impact:** Users think feature is broken when dashboard shows empty data after "Start Monitoring"  
**Status:** Not done  
**Effort:** 2-3 hours  
**Files to modify:**
- `src/components/dashboard/*.tsx` (KPI, Leaderboard, Branches)
- `src/lib/gbp/use-api-query.ts` (add polling for `/api/scrape/status`)
- New component: `src/components/dashboard/ScrapeStatus.tsx`

**Requirements:**
1. Show "Scrape in progress..." banner when `/api/scrape/status` returns `"running"`
2. Show progress: "Scraping competitor 2 of 3: Revolver Seminyak..."
3. Auto-refresh dashboard when status changes to "completed"
4. Show toast notification when scrape completes
5. Disable "Run" button while scrape in progress

---

## 🟠 High Priority (Good UX)

### Fix 3: Add Scrape Progress UI to Dashboard (Tools Hub)
**Impact:** Users can't monitor scrape progress  
**Status:** Not done  
**Effort:** 1-2 hours  
**Files:**
- `src/features/t-scheduler.tsx` (extend with live status)
- `src/app/api/scrape/status/route.ts` (ensure it returns progress)

**Requirements:**
- Show current competitor being scraped
- Show reviews found so far
- Show elapsed time
- "Run Now" button disabled during active scrape

---

### Fix 4: Add Toast Notification on Scrape Completion
**Impact:** Users don't know when scrape finishes  
**Status:** Not done  
**Effort:** 30 min  
**Files:**
- `src/components/shell/RunScreen.tsx` (poll status, show toast)
- Use existing `toast` from sonner

```typescript
// In RunScreen or a useScrapeStatus hook
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch('/api/scrape/status');
    const data = await res.json();
    if (data.status === 'completed' && !notified) {
      toast.success('Scrape completed', { description: `Found ${data.newReviews} new reviews` });
      notified = true;
      refreshDashboard();
    }
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

---

### Fix 5: Optimize Review Container Selector Fallback (10s delay)
**Impact:** comp-seminyak and comp-ubud each lose 10s waiting for fallback  
**Status:** Not done  
**Effort:** 1 hour  
**File:** `gbp-monitor/harness/capture.py` (function `resolve_review_container`)

**Problem:** Selector `div.m6QErb[role='region']` times out (10s) then falls back to JS hunt. Happens for comp-seminyak and comp-ubud.

**Solution:** Add the JS hunt as primary selector for these variants, or detect variant earlier.

```python
# In resolve_review_container, try JS hunt first for known problematic variants
# Or increase the timeout for the primary selector
```

---

### Fix 8: Add Toast for Scrape Completion
**Impact:** Users don't know when scrape finishes  
**Status:** Not done  
**Effort:** 30 min  
**See Fix 4** - Combined with scrape completion toast.

---

## 🟡 Medium Priority (Performance/Quality)

### Fix 2: Optimize Scraper Performance (Reduce Delays)
**Impact:** Live scrape takes 6+ minutes (Crate Cafe 2.5min, Seminyak 30s, Ubud 3min)  
**Status:** Not done  
**Effort:** 2-3 hours  
**Files:**
- `gbp-monitor/harness/scroll.py` (reduce `SCROLL_PAUSE_S`, `SCROLL_STABLE_THRESHOLD`)
- `gbp-monitor/harness/capture.py` (reduce expand click delay)

**Current delays:**
| Operation | Current | Target |
|-----------|---------|--------|
| Scroll pause | 1.3-1.5s | 0.8-1.0s |
| Stable threshold | 3 stable | 2 stable |
| Polite delay | 5-10s | 2-5s |
| Expand click | 0.15s/button | 0.05s/button |

**Estimated savings:** ~40% time reduction (6 min → 3.5 min)

---

### Fix 4: Optimize Scraper Performance (Parallelize)
**Impact:** Sequential scraping wastes time  
**Status:** Not done  
**Effort:** 4-6 hours (major refactor)  
**Approach:**
- Run competitors in parallel (max 2 concurrent to avoid rate limits)
- Requires: separate browser contexts, separate storage states
- Risk: Higher chance of rate limiting/bot detection

**Decision:** Defer until after v1.0 unless critical.

---

### Fix 6: Fix verify_baseline Skipped Count Assertion
**Impact:** Test suite shows 1 failure (expected when using competitor filter)  
**Status:** Not done  
**Effort:** 30 min  
**File:** `gbp-monitor/tests/verify_baseline.py`

**Problem:** Test expects `skipped=9` when running full suite, but competitor filter runs only 2 competitors → 0 skipped.

**Fix:** Make assertion conditional on filter:
```python
expected_skipped = 9 if not competitor_filter else 0
assert summary["skipped"] == expected_skipped
```

---

### Fix 6: Optimize Review Container Selector Fallback (10s delay)
**Impact:** comp-seminyak and comp-ubud each lose 10s waiting for fallback  
**Status:** Not done  
**Effort:** 1 hour  
**File:** `gbp-monitor/harness/capture.py` (function `resolve_review_container`)

**Problem:** Selector `div.m6QErb[role='region']` times out (10s) then falls back to JS hunt. Happens for comp-seminyak and comp-ubud.

**Solution:** Add the JS hunt as primary selector for these variants, or detect variant earlier.

```python
# In resolve_review_container, try JS hunt first for known problematic variants
# Or increase the timeout for the primary selector
```

---

## 🟢 Low Priority (Nice to Have)

### Fix 6: Fix verify_baseline Skipped Count Assertion
**Impact:** Test suite shows 1 failure (expected when using competitor filter)  
**Status:** Not done  
**Effort:** 30 min  
**File:** `gbp-monitor/tests/verify_baseline.py`

**Problem:** Test expects `skipped=9` when running full suite, but competitor filter runs only 2 competitors → 0 skipped.

**Fix:** Make assertion conditional on filter:
```python
expected_skipped = 9 if not competitor_filter else 0
assert summary["skipped"] == expected_skipped
```

---

## 📋 Implementation Order

### Week 1: Critical + High UX
1. ✅ Install Playwright Chromium (`python -m playwright install chromium`)
2. Fix 1: Add Dashboard Scrape Status UI (progress, loading states)
3. Fix 3: Add Scrape Progress UI to Dashboard (Tools Hub)
4. Fix 4: Add Toast Notification on Scrape Completion

### Week 2: Performance + Polish
5. Fix 5: Optimize Review Container Selector Fallback (10s delay)
6. Fix 2: Optimize Scraper Performance (Reduce Delays)
6. Fix 6: Fix verify_baseline Skipped Count Assertion

### Week 3: Advanced (Optional)
7. Fix 4: Optimize Scraper Performance (Parallelize) - if needed
8. Fix 6: Fix verify_baseline Skipped Count Assertion

---

## 🧪 Test Plan After Each Fix

```bash
# After each fix, run:
# Dashboard tests
npx vitest run && npx tsc --noEmit && npx eslint src && npm run build
npx playwright test e2e/smoke.spec.ts

# Scraper tests
cd gbp-monitor
python -m orchestration.run_all --fixtures
python -m orchestration.run_all --validate-config
python -m tests.verify_baseline
python -m tests.verify_notifications
python -m tests.verify_variant_framework

# Live test (after Playwright install)
python -m orchestration.run_all --schedule
python -m orchestration.run_all --competitors comp-canggu-01
```

---

## 📋 Definition of Done

| Feature | Criteria |
|---------|----------|
| Playwright installed | `python -m orchestration.run_all --validate-config` shows "ready for live scrape" |
| Scrape status UI | Dashboard shows progress banner, auto-refreshes on completion |
| Scrape toast | Toast appears with "Scrape completed, found X new reviews" |
| Selector fallback | No 10s timeout warnings for comp-seminyak/ubud |
| Scraper speed | Total live scrape < 4 minutes (currently ~6 min) |
| verify_baseline | 132/132 pass (no skipped count failure) |
| E2E tests | 10/10 pass (Desktop + Mobile) |

---

## 📝 Notes

- **Playwright install is the blocker** - do this first
- **Dashboard UX fixes are highest value** - users currently think the app is broken
- **Performance optimizations are iterative** - measure after each change
- **Parallel scraping is risky** - defer unless users complain about 6min wait
- **All fixes are backward compatible** - no breaking changes to APIs
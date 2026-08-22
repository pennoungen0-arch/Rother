# Live Scraping Fix Plan — Indonesian Google Maps Variant

**Created:** 2026-08-20  
**Status:** Ready to execute  
**Priority Order:** Critical → High → Medium → Low

---

## Phase 1: Foundation — Real Place IDs (CRITICAL)

**Why first:** Without real place_ids, you can't reach the actual business pages to discover the correct selectors.

### 1.1 Extract Real Place IDs
```powershell
cd gbp-monitor

# For each target competitor, get the real place_id:
# Method A: Google Maps web
#   1. Open https://maps.google.com
#   2. Search business name
#   3. Click Share → Copy link
#   4. Extract place_id from URL (format: ChIJ...)

# Method B: Google Places API (if you have API key)
#   GET https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={name}&inputtype=textquery&fields=place_id&key={API_KEY}

# Method C: Browser DevTools on business page
#   Network tab → filter "place" → look for place_id in requests
```

### 1.2 Update listings.json
```json
{
  "branches": [
    {
      "branch_id": "myco-downtown",
      "competitors": [
        {
          "competitor_id": "comp-downtown-01",
          "name": "Crate Cafe Canggu",  // <-- UPDATE: your actual competitor name
          "place_id": "ChIJXXXXXXXXXXXXXXXXXXXXXXXX"  // <-- REAL place_id here
        }
      ]
    }
  ]
}
```

**Validation:**
```powershell
python -m orchestration.run_all --validate-config
# Should pass with "All X competitors have real place_ids — ready for live scrape"
```

**Acceptance Criteria:** All 3 competitors have real `ChIJ...` place_ids (≥25 chars), validation passes.

---

## Phase 2: Selector Discovery & Certification (CRITICAL)

**Why second:** This is the root cause of 0 reviews. Must discover the actual reviews tab selector for your Indonesian variant.

### 2.1 Run Verification to Capture DOM Evidence
```powershell
cd gbp-monitor
python -m orchestration.run_all --verify
```
Creates: `data/verify/20260820T{HHMMSS}Z/`

### 2.2 Inspect Evidence for Reviews Tab Selector
```powershell
# Check screenshots (visual)
data/verify/<ts>/comp-downtown-01/01-business-loaded.png
data/verify/<ts>/comp-downtown-02/01-business-loaded.png
data/verify/<ts>/comp-northside-01/01-business-loaded.png

# Check page.html for actual DOM
# Search for: role="tab", aria-label, Ulasan, Reviews
```

**What to look for:**
- The reviews tab button element
- Its `aria-label` attribute value
- Any other identifying attributes (class, data-testid, etc.)

### 2.3 Determine Working Selector

**Option A: Substring match (recommended if "Ulasan" appears anywhere)**
```json
"reviews_tab_button": [
  "button[role='tab'][aria-label*='Ulasan']",
  "button[role='tab'][aria-label*='Reviews']"
]
```

**Option B: Exact match (if you know exact text)**
```json
"reviews_tab_button": [
  "button[role='tab'][aria-label='Ulasan (123)']",
  "button[role='tab'][aria-label='Reviews']"
]
```

**Option C: Different attribute (if aria-label varies)**
```json
"reviews_tab_button": [
  "button[role='tab'][data-tab-index='1']",
  "button[role='tab'][aria-label*='Ulasan']"
]
```

### 2.4 Update selectors.json
```powershell
# Edit gbp-monitor/config/selectors.json
# Replace the reviews_tab_button array with your working selector(s)
```

**Validation:**
```powershell
python -m orchestration.run_all --validate-config
# Should pass
```

---

## Phase 3: Live Test & Iteration (HIGH)

### 3.1 Quick Fixture Test (Sanity Check)
```powershell
python -m orchestration.run_all --fixtures
# Should complete quickly, proves pipeline works
```

### 3.2 Live Test (First Real Run)
```powershell
python -m orchestration.run_all
```

**Watch for:**
- `open_reviews_tab` phase: `"tab opened — full review list loaded"`
- Scroll phase: `height > 1000`, `visible_cards > 0`, `dom_nodes > 0`
- Parse phase: `tier X matched`, `parsed > 0`
- Verdict: `PASS` with `reviews > 0`

### 3.3 If Still Failing — Iterate
| Failure | Action |
|---------|--------|
| Tab still not opening | Re-check selector in DevTools, try different attribute |
| Tab opens but 0 reviews | Check `review_item` / `review_container` selectors |
| Partial reviews | Check `expand_text_button` selector |
| Some competitors work, others don't | May need per-competitor fallback selectors |

---

## Phase 4: Dashboard Integration (HIGH)

### 4.1 Start Dashboard
```powershell
# From repo root
npm run dev
```

### 4.2 Test Dashboard Scrape Trigger
1. Open http://localhost:3000
2. Sign in with Google
3. Click **Run** → **Fixed competitor list**
4. Verify run completes and hubs populate

### 4.3 Verify Data in Dashboard
- **Insights → KPIs**: Shows review counts
- **Reputation → All Reviews**: Lists captured reviews
- **Competitors → Leaderboard**: Shows competitor rankings

---

## Phase 5: Session Refresh (MEDIUM)

**If login issues arise:**
```powershell
cd gbp-monitor
Remove-Item data\storage_state.json -ErrorAction SilentlyContinue
python -m orchestration.run_all
# Browser opens → manual Google sign-in → new session saved
```

---

## Phase 6: Documentation & Certification (LOW)

### 6.1 Document New Variant
Update `gbp-monitor/docs/engineering/SELECTOR_CERTIFICATION.md`:
- Add section for "Indonesian Variant (User Locations)"
- Document working selectors
- Note any differences from Bali variant

### 6.2 Update AGENTS.md / README.md
- Note the new variant works
- Reference the certification

### 6.3 Commit Changes
```powershell
git add gbp-monitor/config/listings.json gbp-monitor/config/selectors.json
git commit -m "feat: certify selectors for Indonesian variant + real place_ids"
```

---

## Execution Checklist

| Step | Command | Done |
|------|---------|------|
| 1.1 | Get real place_ids for 3 competitors | ☐ |
| 1.2 | Update listings.json with real place_ids | ☐ |
| 1.3 | `python -m orchestration.run_all --validate-config` passes | ☐ |
| 2.1 | `python -m orchestration.run_all --verify` runs | ☐ |
| 2.2 | Inspect evidence for reviews tab `aria-label` | ☐ |
| 2.3 | Determine working selector | ☐ |
| 2.4 | Update selectors.json | ☐ |
| 2.5 | `python -m orchestration.run_all --validate-config` passes | ☐ |
| 3.1 | `python -m orchestration.run_all --fixtures` passes | ☐ |
| 3.2 | `python -m orchestration.run_all` → reviews > 0 | ☐ |
| 3.3 | Iterate if needed | ☐ |
| 4.1 | `npm run dev` starts | ☐ |
| 4.2 | Dashboard scrape trigger works | ☐ |
| 4.3 | Data visible in hubs | ☐ |
| 5 | Session refresh (if needed) | ☐ |
| 6.1 | Document variant in SELECTOR_CERTIFICATION.md | ☐ |
| 6.2 | Update docs | ☐ |
| 6.3 | Commit | ☐ |

---

## Rollback Plan

If anything breaks production data:
```powershell
# Backup is at: C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup
Remove-Item gbp-monitor\data -Recurse -Force
Copy-Item C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup gbp-monitor\data -Recurse
```

---

## Time Estimates

| Phase | Estimate |
|-------|----------|
| 1: Place IDs | 15-30 min |
| 2: Selector discovery | 30-60 min |
| 3: Live test & iterate | 30-60 min |
| 4: Dashboard test | 15 min |
| 5: Session refresh | 5 min |
| 6: Documentation | 15 min |
| **Total** | **~2-3 hours** |

---

## Success Criteria

✅ All 3 competitors have real place_ids  
✅ `reviews_tab_button` selector works for your variant  
✅ Live scrape captures > 0 reviews per competitor  
✅ Dashboard shows live data after scrape  
✅ Selectors documented for future reference
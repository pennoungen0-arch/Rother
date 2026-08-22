# Live Scraping Audit — 2026-08-20

## Executive Summary

**Live scraping is failing** for the user's new locations. Root cause: **selector mismatch** — the certified `reviews_tab_button` selectors in `config/selectors.json` do not match the Indonesian Google Maps variant DOM for the user's target locations. The reviews tab never opens → embedded reviews only (max 3-5 cards) → parser finds 0 review items → 0 reviews captured.

---

## Audit Findings

### 1. Selector Mismatch (PRIMARY ROOT CAUSE)

| Selector | Certified For | Actual Result |
|----------|---------------|---------------|
| `button[role='tab'][aria-label^='Ulasan']` | Bali competitors (Indonesian locale) | **TIMEOUT** — not found in user's variant |
| `button[role='tab'][aria-label^='Reviews']` | English locale fallback | **TIMEOUT** — not found |

**Evidence from verify run (20260820T042619Z):**
- `reviews_tab_button` status: `not_evaluated` (never exercised)
- Both selector tiers timed out (4000ms each)
- Phase `open_reviews_tab`: `"tab not opened — using embedded reviews"`
- Scroll height: 116px, 0 visible cards, 0 DOM nodes
- Business name: `"Area ini"` (Indonesian "This area")

**Why:** The M18 certification (2026-08-17) validated selectors against **12 Bali competitors**. The user's new locations serve a **different Indonesian variant** with different `aria-label` text for the reviews tab.

### 2. Place ID Issues

**User was using placeholder place_ids:**
```
ChIJREPLACEWITHAREALPLACEID...
ChIJREPLACEWITHAREALPLACEID2...
ChIJREPLACEWITHAREALPLACEID3...
```

These are **not valid Google place_ids** (must be `ChIJ` + ≥25 chars of actual encoded data). The scraper navigates to `https://www.google.com/maps/place/?q=place_id:ChIJREPLACE...` which loads a generic page, not the target business.

### 3. Session State (NID Cookie)

- `storage_state.json` from **2026-08-13** (7 days old)
- NID cookie expires **2027** — still valid
- Cookies present: `NID`, `__Secure-STRP`, `AEC`, `SEARCH_SAMESITE`
- **Not a current blocker**, but should be refreshed if login issues arise

### 4. Parser Failure (CASCADING EFFECT)

Since reviews tab never opens:
- Only embedded reviews loaded (max ~5 cards, height 116px)
- All 3 parser locator tiers fail:
  - Tier 0: `[data-review-id]` — 0 matches
  - Tier 1: `[data-review-id][aria-label]` — 0 matches  
  - Tier 2: `div.jftiEf.fontBodyMedium` — 0 matches
- Parser returns 0 reviews → verdict: `FAIL`

### 5. Expand Button

- `button.w8nwRe.kyuRq` — not found (expected_missing=true in embedded mode)
- `button:has-text('More')` — not found

### 6. Browser/Playwright Versions

| Component | Version | Status |
|-----------|---------|--------|
| Playwright (Python) | 1.61.0 | OK (matches scraper requirements) |
| Chromium | 1228 (Chrome for Testing 149.0.7827.55) | OK |
| Dashboard Playwright | 1.62.1 | Separate environment, no conflict |

---

## Root Cause Chain

```
Invalid place_ids → Generic page loads
    ↓
Reviews tab selector mismatch (Indonesian variant) → Tab never opens
    ↓
Only embedded reviews loaded (3-5 cards, height 116px)
    ↓
Parser finds 0 review items (all 3 tiers fail)
    ↓
0 reviews captured → FAIL verdict
```

---

## Remediation Steps

### Step 1: Fix Place IDs (REQUIRED)

```powershell
cd gbp-monitor

# 1. Get real place_ids for your target locations
# Use Google Maps: search business → Share → Copy link → extract place_id
# Or use Google Places API / place_id finder tools

# 2. Update config/listings.json with real place_ids
# Format: "place_id": "ChIJXXXXXXXXXXXXXXXXXXXXXXXX" (starts with ChIJ, ≥25 chars)

# 3. Validate
python -m orchestration.run_all --validate-config
```

### Step 2: Re-certify Selectors for Your Variant

```powershell
cd gbp-monitor

# 1. Run verification to capture DOM evidence
python -m orchestration.run_all --verify
# Creates data/verify/<ts>/ with screenshots, page.html, selector_report.json

# 2. Inspect the actual reviews tab button in the DOM
# Option A: Check screenshots
#   data/verify/<ts>/comp-*/01-business-loaded.png
# Option B: Inspect page.html
#   Search for: role="tab", aria-label, Ulasan, Reviews

# 3. Update config/selectors.json with working selector
# Example - if actual aria-label contains "Ulasan" anywhere:
# "reviews_tab_button": [
#   "button[role='tab'][aria-label*='Ulasan']",
#   "button[role='tab'][aria-label*='Reviews']"
# ]
# Or use exact selector from Chrome DevTools

# 4. Validate and test
python -m orchestration.run_all --validate-config
python -m orchestration.run_all --fixtures  # quick test
python -m orchestration.run_all             # live test
```

### Step 3: Refresh Session (if needed)

```powershell
cd gbp-monitor
Remove-Item data\storage_state.json -ErrorAction SilentlyContinue
python -m orchestration.run_all  # Will prompt for fresh login
```

---

## Prevention Checklist

- [ ] Use real `place_id` values (not placeholders) in `listings.json`
- [ ] Run `--verify` before first live scrape on new locations
- [ ] Re-certify selectors for each new Google Maps variant/locale
- [ ] Keep `storage_state.json` fresh (delete if login fails)
- [ ] Run `--validate-config` after any config change
- [ ] Document variant-specific selectors in `SELECTOR_CERTIFICATION.md`

---

## Files to Review/Update

| File | Action |
|------|--------|
| `gbp-monitor/config/listings.json` | Add real place_ids |
| `gbp-monitor/config/selectors.json` | Update `reviews_tab_button` for your variant |
| `gbp-monitor/data/verify/<latest_ts>/` | Inspect evidence for selector discovery |
| `gbp-monitor/docs/engineering/SELECTOR_CERTIFICATION.md` | Document new variant |
| `gbp-monitor/data/storage_state.json` | Delete to force fresh login if needed |

---

## Status

- [ ] Place IDs fixed
- [ ] Selectors re-certified for user's variant
- [ ] Live scrape test passing (reviews > 0)
- [ ] Dashboard showing live data
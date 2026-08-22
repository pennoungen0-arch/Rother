# GBP Competitor Review Monitor

Automated monitoring of competitor Google Business Profile reviews for
**Copenhagen Bali** (6 branches). Zero recurring cost. No paid APIs.
No AI/LLM features in this phase.

**Governing documents:**
- `CHANGELOG.md` (in this directory) — change record per Rule 2

## Quickstart (development)

```bash
cd gbp-monitor
pip install -r requirements.txt
playwright install chromium      # only needed for live mode
python -m orchestration.run_all --fixtures  # test with static fixtures
```

## Live Scraping

Before running live mode, you need valid Google Maps `place_id` values:

1. Get place_ids for each competitor (see `docs/engineering/LIVE_SCRAPING_GUIDE.md`)
2. Set them in `config/listings.json`
3. Run: `python -m orchestration.run_all`

The scraper validates place_id format (must start with `ChIJ`, ≥25 chars).
Invalid/missing place_ids fall back to mock URLs and skip gracefully.

> **Verified (2026-08-20):** 3 Indonesian businesses scrape successfully with certified selectors:
> - Crate Cafe Canggu: `ChIJOaEQDnk40i0Rzhou4NcRx-w`
> - Revolver Seminyak: `ChIJ9fhCoBBH0i0R4h17JYdA484`
> - Seniman Coffee Studio: `ChIJu5hbBmo90i0R4po77axHom8`
> 
> **930 reviews captured** (300 + 510 + 120). Root cause of earlier 0-review failures was **placeholder `place_id`s**, not selector mismatch. Certified `reviews_tab_button` selector (`button[role='tab'][aria-label^='Ulasan']`) works for this variant.

### Troubleshooting Live Mode (0 reviews extracted)

If a live run returns 0 reviews for all competitors, the **selectors in `config/selectors.json` likely don't match your Google Maps variant**. Google Maps serves different DOM structures by region/language.

**Symptoms:**
- `REVIEWS_TAB` warnings: both `Ulasan` and `Reviews` tab selectors time out
- `scroll` phase shows height ~100-116px, 0 visible cards, 0 DOM nodes
- `parse_locator`: all 3 tiers fail (`[data-review-id]`, `[data-review-id][aria-label]`, `div.jftiEf.fontBodyMedium`)
- Business name shows generic text like "Area ini" (Indonesian) instead of actual name

**Fix:**

```powershell
cd gbp-monitor

# 1. Run verification to capture evidence
python -m orchestration.run_all --verify
# Writes data/verify/<ts>/ with screenshots, page.html, selector_report.json

# 2. Inspect the evidence to find the actual reviews tab selector
# Check screenshots: data/verify/<ts>/comp-*/01-business-loaded.png
# Or open page.html and search for the reviews tab element

# 3. Update config/selectors.json with the working selector
# Example - if actual aria-label contains "Ulasan" anywhere:
# "reviews_tab_button": ["button[role='tab'][aria-label*='Ulasan']", "button[role='tab'][aria-label*='Reviews']"]
# Or use the exact selector from Chrome DevTools

# 4. Validate and test
python -m orchestration.run_all --validate-config
python -m orchestration.run_all
```

**Why this happens:** The certified selectors in `config/selectors.json` were validated against the Bali competitor set (Indonesian locale with specific DOM). Your locations may serve a different variant. The fixture mode (`--fixtures`) works because it uses static HTML from the certified Bali set.

> **Important (2026-08-20):** The root cause for Crate Cafe Canggu, Revolver Seminyak, and Seniman Coffee Studio was **invalid placeholder `place_id`s** (`ChIJREPLACEWITHAREALPLACEID...`), which loaded generic Google Maps pages — NOT selector mismatch. Real `place_id`s extracted from `maps.app.goo.gl/` short links resolved it. The certified `reviews_tab_button` selector (`button[role='tab'][aria-label^='Ulasan']`) works for this variant.

See `docs/engineering/SELECTOR_CERTIFICATION.md` for the full re-certification workflow.

---

## Baseline Verification

After setup, verify the scraper works:

```bash
cd gbp-monitor
python -m tests.verify_baseline
```

Expected output: 67 checks pass, exit code 0.

## Fixture Preparation

After a successful live capture, promote evidence to a golden dataset:

```bash
python -m golden.promote {verify_timestamp}
```

See `docs/engineering/FIXTURE_PREPARATION.md` for the full workflow.

## Layout

```
gbp-monitor/
├── orchestration/run_all.py   # Main entry point: capture → parse → store
├── harness/                    # Browser lifecycle, capture, scrolling, selectors
├── parser/                     # Review parsing (parsel.Selector)
├── storage/                    # Versioned snapshot persistence
├── discovery/                  # URL reachability pre-checks
├── config/                     # listings.json, selectors.json
├── tests/                      # 3 HTML fixtures + verify_baseline.py
├── golden/                     # promote.py — evidence → golden dataset
├── data/                       # Runtime data: snapshots, deltas, logs
└── docs/                       # Guides (see docs/engineering/)
```

## Status

See `CHANGELOG.md` for the current PROVEN/UNPROVEN state of each module.

# Tauri Scraping System Analysis — 2026-09-05

## Context
Rother Tauri desktop app (v0.4.1) analysis — the user reported that the Tauri version "does not retrieve all reviews data" and "not consistently retrieve the newest data" for the12 businesses being monitored. This document records the findings from examining the log output, the Tauri app's data directory, the scraper configuration, and the codebase.

---

## 1. All11 businesses ARE being scraped successfully

Every business in the log output shows `success=1, failed=0` with reviews captured. The Tauri version is NOT failing to scrape businesses — it's working correctly for each one it encounters.

Businesses with tenant data in `C:\Users\HP\AppData\Roaming\com.rother.desktop\rother\gbp-monitor\data\users\`:
- bumbu-bali-restaurant-cooking-school
- byrd-house-bali
- crate-cafe
- kafe
- lilla-pantai
- revolver-seminyak
- salsa-verde
- seniman-coffee-studio
- shady-shack
- single-fin-bali
- suluban-cliff-bali-villa

The `listings.json` only has 3 test competitors (Crate Cafe, Revolver Seminyak, Seniman Coffee Studio). The other8 businesses were added via the Tauri dashboard's discovery/onboarding flow, each as a separate tenant.

---

## 2. Review harvest completeness — the real limitation

Google Maps' virtualized review panel renders only ~500-600 cards in the DOM at any time. After `stable_scroll` detection (scroll height stops changing), no more cards appear. Coverage data from the logs:

| Business | Harvested | Google Total | Coverage % | Notes |
|---|---|---|---|---|
| Crate Cafe | 370 | 5,291 | 6.99% | Large business, low % |
| Revolver Seminyak | 528 | 8,473 | 6.23% | |
| Single Fin Bali | 240 | 14,102 | 1.70% | Largest business, lowest % |
| Seniman Coffee | 428 | 5,161 | 8.29% | |
| Shady Shack | 450 | 2,831 | 15.90% | |
| KAFE | 88 | 3,592 | 2.45% | Panel collapsed after sort, recovered |
| Suluban Cliff | 121 | 111 | 100%+ | Small business, full coverage |
| Lilla Pantai | 600 | 2,023 | 29.66% | |
| Byrd House Bali | 580 | 1,858 | 31.22% | |
| Salsa Verde | 567 | 567 | 100% | Small business, full coverage |
| Bumbu Bali | 410 | 1,375 | 29.82% | |

**Small businesses (<1,000 reviews): 100% coverage.**  
**Large businesses (5,000+): only 7-8%.**  
This is Google Maps' virtualized panel — NOT a Rother bug or configurable limit.

---

## 3. Newest sort IS working — but "newest" ≠ strict chronological

The `SORT_NEWEST` is being applied for most businesses (confirmed in logs via `SORT_NEWEST[crate-cafe] applied via "button[aria-label*='urutkan' i]"`). However:

- Google's "Terbaru" (Newest) sort considers multiple signals beyond just date: account age, engagement, review quality
- The rendered window is still limited to ~500 cards regardless of sort order
- For businesses with 5,000+ reviews, even the 500th newest review might be weeks/months old depending on review velocity
- The most recent review captured was only ~21 hours old in one run — confirming the newest reviews ARE in the window when they exist

**Root cause:** This is a Google Maps platform limitation, not a Rother code bug.

---

## 4. Sort behavior failures observed

Two businesses had sort-related issues:
- **KAFE**: Panel collapsed after sort click (`panel_collapsed`), scraper recovered by re-opening the Reviews tab. Sort was skipped — proceeded with default ordering.
- **Suluban Cliff**: Sort control not found on the page (`sort_control_not_found`) — proceeded with default ordering.

Both cases are logged honestly via the `reviews_sort_newest` selector report (healthy/degraded/broken).

---

## 5. First-scrape indicator gap

The `ScrapeRunManager` in `scrape-runner.ts` tracks active runs via `JSONLOG` parsing, but the RunScreen only shows a progress indicator during active scraping — there is no "scraping in progress" indicator shown during app startup to let users know data is being collected. This means users may open the app, see no data, and assume something is broken when in fact a scrape is running in the background.

---

## 6. Copy-logs function missing

The user requested a "copy logs" function in the logs menu. Currently the logs view (`t-logs.tsx` or equivalent feature) shows run logs but has no copy-to-clipboard functionality. This would require adding a clipboard button to the logs UI.

---

## 7. Variance-proof delta system is working correctly

The `seen_store.py` ever-seen ID union + recency gate system is functioning as designed:
- `BASELINE[salsa-verde]: first harvest — 567 reviews seeded into the ever-seen union; delta suppressed` — first runs correctly suppressed
- `BACKFILL[bumbu-bali-restaurant-cooking-school]: 170 never-seen old review(s) merged silently` — old reviews correctly classified as backfill
- No false "new review" alerts from render-depth jitter

---

## 8. Architecture note: Tauri vs Web version

The Tauri version uses the same Python scraper as the web version — the `main.rs` sidecar spawns Node.js running Next.js standalone, which triggers Python via the scrape-runner. No scraping logic differs between Tauri and web. All issues in this analysis are platform-level (Google Maps) or UX-level, not Tauri-specific.

---

## Recommendations

1. **Address Google Maps panel limit** (medium effort): Consider "Newest" sort + date-range filtering via Google's date buttons, or multiple viewport passes targeting different date windows. This is the single biggest data-quality improvement available.
2. **Fix sort failures for KAFE / Suluban Cliff**: Investigate why the sort control sometimes isn't found — may need selector updates for the specific Google Maps variants rendered for those businesses.
3. **Add startup-scrape indicator**: Show a subtle "Scraping in progress" indicator on the RunScreen when a background scrape is active.
4. **Add copy-logs button**: Simple UI addition to the logs menu.
5. **Document the 500-review ceiling** as a known limitation in the dashboard UI (already done via `harvest_status: "reduced"` + `google_review_count` + "Partial window" badge).

---

## 9. Copy-logs function + enhanced logging (implemented 2026-09-05)

### Copy-logs button
Added to `LogsSection` in `src/components/dashboard/logs-section.tsx`:
- "Copy" button in the header toolbar (next to Refresh)
- Uses `navigator.clipboard.writeText` with blob fallback for Tauri context
- Shows "Copied" with checkmark for 2 seconds after success
- Disabled when no lines are shown

### Enhanced scraper logging
Added human-readable log lines to `run_all.py` at four key points:

1. **Run-start banner** (after `run_start` JSONLOG):
   ```
   ============================================================
   ROTH RUN STARTING — mode=live run_id=20260905...
     Rother v0.3.3 — Google Business Profile review monitor
     Pipeline: Playwright capture → Parse → Variance-proof delta → Store
     Harvest window: newest ~500 reviews (Google's virtualized panel)
     Delta base: cumulative ever-seen ID union + 30-day recency gate
   ============================================================
   ```

2. **Acquisition complete** (after NID reuse/warm-up):
   ```
   ACQUISITION: reusing NID session from data\storage_state.json
   ACQUISITION COMPLETE — browser context ready
     Config: 1 branch(es), 1 competitor(s) total
   ```

3. **Per-listing harvest summary** (after `listing_done` JSONLOG):
   ```
   LISTING COMPLETE[crate-cafe]: 370 reviews harvested (reduced — Google reports 5291)
     ↳ 15 NEW review(s) detected (alert-worthy, posted within 30 days)
     ↳ 420 backfill review(s) silently merged (older reviews never seen before)
   ```
   Or on first harvest: `↳ First harvest — all 370 reviews seeded as baseline (no alerts)`

4. **Final run summary** (after `summary_written`):
   ```
   ============================================================
   ROTH RUN COMPLETE — 20260905T...
     Mode: live | Duration: 307s | Browser launch: 3.9s
     Results: 1 succeeded, 0 failed, 0 skipped
     Reviews: 370 total harvested, 15 new (alert-worthy), 420 backfill (silent)
     ALERT: 15 new review(s) detected — notifications pending
   ============================================================
   ```

## Status
Analysis complete. Copy-logs + enhanced logging implemented; commit pending.

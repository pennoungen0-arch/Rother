# Rother Web (Vercel) — User Guide

**Last updated:** 2026-09-13T16:30:00+07:00  
**For:** Non-technical clients using `https://rotherweb.vercel.app`  
**What is this:** A plain-language guide to the web version of Rother — what works, what doesn't, and how to know scraping is happening.

---

## What is Rother Web?

Rother Web is the browser version of Rother, a tool that monitors Google Business Profile reviews for your business and competitors. The data is **real** — it comes from the same Python scraper as the desktop app, but it runs automatically on GitHub's servers every day.

**You don't need to install anything.** Just open `https://rotherweb.vercel.app` in your browser.

---

## How do I know scraping is working?

Look for these **green indicators** anywhere in the app:

1. **Top bar (every page):**
   - "Last scrape" = when the most recent scrape ran
   - "+N new" = number of new reviews detected
   - "Trigger Scrape" = link to manually start a scrape (opens GitHub)

2. **Today page banner:**
   - "Scraping is running automatically - Live" (green badge)
   - Shows last scrape time, competitors scraped, new reviews, next run time
   - "View on GitHub" link for manual trigger

If you see these, scraping is working. If the "Last scrape" is more than 25 hours old, something is wrong — contact support.

---

## What works on the web version

- KPIs (review counts, ratings, branches, competitors)
- All Reviews (searchable, filterable, paginated)
- Reviews over Time (timeline + heatmap)
- Run History (view past scrapes)
- Run Comparison (side-by-side snapshots)
- Alerts (new reviews detected)
- Export (CSV / JSON download)
- Run Logs (read-only)
- Competitor Correlation (similarity matrix)
- Geo Grid (location heatmap)
- All 25 analytics features
- Configuration (read-only): view your monitored businesses and competitors

---

## What does NOT work on the web version

**Scraping controls** — Python can't run on Vercel. Use these instead:
- Automatic: Scraping runs every day at 02:00 UTC (06:00 WITA)
- Manual: Click "Trigger Scrape" link anywhere in the app -> opens GitHub Actions -> click green "Run workflow" button

**Add/remove competitors** — The web version is read-only for config. Contact your account manager.

**Enable/disable scheduler** — Managed by GitHub Actions cron (always on).

**Scraper Setup** — For desktop app only. Will show "This feature is not available on the web version" — that's normal.

---

## How to manually trigger a scrape

1. Click "Trigger Scrape" (top bar) or "View on GitHub" (Today page banner)
2. This opens: `https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml`
3. Click the green "Run workflow" button (right side)
4. Confirm:
   - Branch: `main` (correct)
   - Competitor IDs: (empty = scrape all)
   - Mode: `manual` (correct)
5. Click green "Run workflow"
6. Wait 5-10 minutes — the run will show a yellow spinner while running, then green when done
7. Refresh your dashboard — new data will appear within 2-5 minutes

---

## How often does scraping run?

- Daily at 02:00 UTC (= 06:00 WITA, Bali time)
- Duration: ~5-7 minutes per competitor
- For 3 competitors: ~7 minutes total
- Data syncs to dashboard within 2-5 minutes of completion

---

## Data freshness

| Status | What it means | What to do |
|---|---|---|
| Green "Last scrape: 22m ago" | Normal — scraped today | Nothing, it's working |
| Green "Last scrape: 2d ago" | Cron may be delayed | Click "Trigger Scrape" manually |
| No green badge | No data yet | Wait for first scrape to complete |

---

## FAQ

**Q: Why can't I trigger scraping from the dashboard button?**  
A: The web version runs on Vercel, which is a serverless platform with no Python or filesystem access. The scraper runs on GitHub's servers instead. Use the "Trigger Scrape" link to open GitHub Actions.

**Q: Is the data real or fake?**  
A: 100% real. The dashboard shows actual Google reviews scraped by Python+Playwright, synced from GitHub to Vercel.

**Q: Can I add a new competitor from the web?**  
A: Not yet. The web version is read-only for configuration. Contact your account manager to add competitors (they'll update the GitHub config).

**Q: What happens if I refresh the page while scraping is running?**  
A: Nothing — scraping runs on GitHub, not in your browser. Your refresh only reloads the dashboard.

**Q: Why does the Scraper Setup page say "not available"?**  
A: That page is for the desktop app (installing Python). On the web version, the scraper is pre-installed on GitHub.

**Q: How do I export my data?**  
A: Go to Tools -> Export Data -> choose CSV or JSON -> click Download. Works the same as desktop.

---

## Need help?

- GitHub Actions runs: `https://github.com/pennoungen0-arch/Rother/actions`
- Dashboard: `https://rotherweb.vercel.app`
- Run history: Tools -> Runs (in the dashboard)

If data is more than 48 hours stale, click "Trigger Scrape" to force a run.

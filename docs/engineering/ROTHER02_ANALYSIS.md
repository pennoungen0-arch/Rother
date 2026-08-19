# Rother Versions Analysis — Current (v1) vs `rother02` (v2)

> Reference doc capturing the condition of **both** versions of Rother as of
> **2026-08-17**. Companion: `gbp-monitor/docs/engineering/PROJECT_SUMMARY.md`
> (v1 "everything done" report), `/AGENTS.md` (agent-facing state).

---

## 1. The two versions at a glance

| | **v1 — current repo** (`./src`, `./gbp-monitor`) | **v2 — `rother02/`** |
|---|---|---|
| **Product model** | Multi-competitor monitoring: watch a fixed list of competitors (Copenhagen Bali set: 6 branches × 12 competitors) | **Single-business**: user onboards *their own* business; competitors are discovered automatically |
| **Scraper maturity** | Proven, certified (M18-20260817), 12/12 live PASS, 5,021 reviews in production snapshots | Stale copy — predates v1's certification work; its KNOWN_LIMITATIONS still lists selectors as UNPROVEN |
| **Dashboard UX** | Single-page tabbed dashboard (Overview / Branches / Compare / Reviews / New Reviews / Alerts / Config) | **Hub-based app**: login → onboarding → run gate → 4 hubs (Insights / Reputation / Competitors / Tools) → 28 lazy-loaded features + Cmd+K palette |
| **Desktop** | none | Tauri scaffold (`src-tauri/`) present |
| **Tracking in git** | tracked (branch `test/m15-1-validation`) | **untracked** — kept in-repo but excluded from commits |

Bottom line: **v1 has the proven data pipeline; v2 has the superior UI/UX.**
They complement each other — nothing in v2 invalidates v1's scraper work, and
v2's ambition (arbitrary-business monitoring) depends on backend work that its
own docs mark as pending (RISK-023/024/028).

---

## 2. v2 (`rother02`) UI/UX architecture

### Gated app flow (`src/components/shell/app-shell.tsx`)

```
LoginScreen → Onboarding (2 steps) → RunScreen (run gate) → Hub → SectionView → FeaturePage
```

- **LoginScreen** — mock "Sign in with Gmail" (localStorage-only user; real OAuth
  is a documented TODO). Copy: "Your data stays on this device."
- **Onboarding** — step 1: find *your* business via OpenStreetMap autocomplete,
  "Paste a Google Maps link instead" (PasteFromMapsParser), or manual entry,
  plus a category picker (`src/lib/categories.ts`). Step 2: optionally add your
  own branch locations (place or address autocomplete), each anchored to a real
  place with geocoords + `gmaps_place_id` resolution.
- **RunScreen (run gate)** — hubs stay hidden until the user triggers a live
  scrape of their own business (`runStarted` in `src/lib/app-state.tsx`).
  **Failure never blocks navigation** — a failed scrape still reveals the hubs.
- **Hub** — 4 large cards: **Insights**, **Reputation**, **Competitors**, **Tools**.
- **SectionView** — per-hub feature grid (staggered framer-motion entrance);
  picking a feature opens a **FeaturePage** (fixed header + back + internal
  scroll; the document body never scrolls).

### Feature registry (`src/lib/features.tsx`)

28 features across the 4 hubs, each a thin lazy-loaded wrapper
(`src/features/i-*.tsx`, `r-*.tsx`, `c-*.tsx`, `t-*.tsx`):

- **Insights:** KPIs, Run Health, Rating Distribution, New Reviews per Branch,
  Run Comparison, Run History
- **Reputation:** All Reviews, Reviews over Time, Review Lengths, Word Cloud,
  Review Language, Review Recency (heatmap), Top Reviewers, Alerts
- **Competitors:** Branches & Competitors, Branch Comparison, Leaderboard,
  Competitor Comparison (radar, top 3), Growth Rate, Correlation,
  **Competitive Health**, **Discover competitors**, **Geo grid**,
  Rating Distribution Compare
- **Tools:** Configuration, Run Logs, Export Data, Scrape Schedule

### Command palette (`command-palette.tsx`)

Global **Cmd/Ctrl+K** fuzzy search over all hubs + features, arrow-key
navigation, Enter to open, Esc to close. Also reachable via the top-bar search
button (mobile icon variant included).

### Design system

- shadcn/ui (18 components) + Tailwind v3 + framer-motion + tailwindcss-animate.
- **Bali-inspired oklch palette** (`globals.css`): warm cream background, deep
  emerald primary, amber accent, terracotta/chart palette; dark mode = "deep
  jungle night." Geist Sans/Mono fonts.
- Sonner toasts (bottom-right, richColors); offline/online toasts via
  `OnlineStatusProvider` (back-online invalidates the React Query cache).

### Data + state

- **TanStack Query** via a single hook `useApiQuery` (`src/lib/gbp/use-api-query.ts`):
  live endpoints 15s staleTime + `no-store`; static endpoints 5min cache.
- **App state** (`src/lib/app-state.tsx`) backed by localStorage through
  `useSyncExternalStore` — no hydration flash, no set-state-in-effect.
  `user` / `business` / `runStarted` persist; hub/feature navigation is
  in-memory only.
- **Single-business invariant** at the data layer: once `user-business.json`
  exists, `readListings()` returns `[]` so the seeded Copenhagen Bali demo can
  never surface in the UI (`src/lib/gbp/paths.ts`, `GBP_USER_BUSINESS_PATH`).
  Tenant data would live under `data/users/{businessId}/`.

### New UI/UX features (not in v1)

| Feature | Notes |
|---|---|
| **Geo grid** | Leaflet + OSM map (no API key); color-coded business/branch/competitor markers; competitive-density grid overlay; lists points with unresolvable coordinates |
| **Competitive Health** | Auto OSM competitor discovery (no scraping) + KPIs (competitors found, nearest distance, density/km², % Google-linked) + run-health badge |
| **Discover competitors** | Category scan UI with fixtures/cached/live modes; live gated by `/api/health` `browserAvailable` probe; add candidates to monitoring |
| **Competitor correlation** | Which competitor traits track with review volume |
| **Review recency heatmap / language distribution / top reviewers / review lengths** | New analytics widgets |
| **Scrape Schedule, Run Logs, Export dialog, Shortcuts help, Live clock, Freshness badge, Health sparkline, Auto-refresh toggle, Competitor detail dialog** | Operational UI depth |

### UX quality signals (strengths)

- Progressive disclosure (28 features behind 4 hubs vs one dense page)
- Keyboard-first (palette + shortcuts-help dialog)
- Loading discipline — skeletons mirror final layout; lazy feature modules
- Reduced-motion respected everywhere (`useReducedMotion`)
- Empty states themed as a "gentle pause," not errors
- One-viewport-locked screens; aria labels, `aria-busy`, focus rings

### Rough edges / gaps

- Login **mocked**; onboarding persistence is fire-and-forget
- Run gate admits failure silently (by design) — users may land on empty states
- `KNOWN_LIMITATIONS.md` is stale (still claims selectors UNPROVEN / mock URLs)
- Its `gbp-monitor/` copy predates v1's M16–M18 work (no stale-NID guard, old
  phone/website probe selectors, no notifications module)
- GMBE-style discovery/geo features depend on backend acquisition of arbitrary
  businesses — marked pending in its own docs (RISK-023/024/028)

---

## 3. Shared core — the scraping + monitoring engine (v1)

Both versions conceptually rely on the same pipeline; only v1's copy is current:

- **Capture:** Playwright Chromium with a real `NID` session
  (`data/storage_state.json`), Reviews-tab full-list capture, **incremental
  harvest** (unions every distinct card per scroll — beats the ~350-card
  virtualized-DOM cap; live: 200–580 cards/listing).
- **Parse:** structured `Review` (text, rating, reviewer, relative date +
  approximated ISO, like count) + business metadata (name, rating, count,
  address, category, phone, website, weekly opening hours, star breakdown).
- **Monitor:** per-competitor delta tracking (`data/reviews_new/`), run summary
  (`data/run_summary.json`), selector-health report, stale-NID guard
  (probe → classify → re-warm on REDUCED variant).
- **Live monitoring loop:** GitHub Actions daily cron (05:00 WITA, `scrape.yml`)
  commits data back; proactive **webhook + SMTP email** alerts after every run;
  dashboard Run Now button (`POST /api/scrape/trigger`), alerts tab, run
  history/comparison, freshness badges.

## 4. GMB-Everywhere-style feature coverage

| GMBE-ish capability | v1 | v2 |
|---|---|---|
| Review telemetrics (counts over time, rating dist, star breakdown, lengths, recency, word cloud, language, top reviewers) | partial | richer (adds recency heatmap, language, top reviewers, lengths) |
| Competitor comparison (leaderboard, side-by-side, radar, growth rate, correlation) | leaderboard/compare | + radar, correlation, growth rate |
| Competitor discovery (category scan, OSM auto-discovery) | — | UI complete; backend pending (RISK-024) |
| Geo-grid map | — | UI complete (Leaflet/OSM) |
| Business profile audit (metadata panel) | yes (M18) | yes |
| Owner replies / absolute timestamps / Q&A / posts / SERP rank tracking | not possible in this Maps variant (v1 docs §7) | same constraint |

## 5. How to run v2 (`rother02`)

```powershell
cd "D:\Documents (D)\Softwares\Rother\Rother - 0.0.1\rother02"
npm install        # Windows fix: lightningcss-linux-x64-gnu moved to optionalDependencies
npx prisma db push # optional (scaffold only; app reads JSON files, not SQLite)
npm run dev        # http://localhost:3000
```

Notes: port 3000 conflicts with v1's dev server; its `gbp-monitor/` has no
`data/` so features show empty states after onboarding; point
`GBP_ROOT=<outer>\gbp-monitor` to reuse v1's production data.
Windows install fix committed in v2's package.json (2026-08-17).

## 6. Relationship / strategy

v1 = proven scraper + monitoring + tabbed dashboard, all roadmap milestones
DONE (2026-08-17). v2 = UX-first rewrite toward a **single-business product**
(login, onboarding, run gate, hubs, palette, geo/discovery). The obvious
convergence path is **port v2's shell + new features onto v1's certified
pipeline** (or evolve v2's scraper copy forward), deciding the product model
question first: fixed competitor list (v1) vs user's own business + auto
discovery (v2).
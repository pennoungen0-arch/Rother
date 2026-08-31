# Tauri Revival Plan — Rother Desktop (v0.4.1)

**Created:** 2026-08-25 · **Updated:** 2026-08-31T04:42:10Z
**Status:** PLANNED (Phase A scaffold copied from `rother02-archive/src-tauri/`)

**Changes from v0.4.0 plan:**
- Sealed core now v0.4.1 (`b6e2228`, panel collapse fix + safety system)
- `src-tauri/` scaffold copied from archive + updated for Tauri v2 stable API
- Added `ROTHER_DATA_DIR` env for scraper data isolation
- Added `closeOnLastWindow: false` + tray-aware close behavior
- Updated CSP to allow `127.0.0.1:*` (dynamic port)
- Updated capabilities schema for Tauri v2 (`localAccess` vs `windows`)
- Reference: `docs/engineering/SAFETY_SYSTEM_2026-08-29.md`, `docs/engineering/PANEL_COLLAPSE_INVESTIGATION_2026-08-29.md`
**Inputs:** `TAURI_COMPATIBILITY_RESEARCH_2026-08-25.md` (audit + framework
decision + stale-plan corrections) · archived scaffold
`rother02-archive/src-tauri/` · current sealed core: `v0.4.1` (`b6e2228`, 2026-08-29T14:54:13+07:00)
**Targets:** Windows + Linux first; macOS second (signing-gated).
**Framework decision:** Tauri v2 (re-affirmed — see research doc §3).

---

## 0. Architecture (one paragraph)

The Tauri window loads `http://127.0.0.1:<port>` served by a **Node
sidecar** running the Next.js standalone build (all 29 API routes need a
server — static export is impossible). The sidecar spawns the **Python
scraper** exactly as today (`scrape-runner.ts` is platform-agnostic and
already env-driven). Tauri's job: window, lifecycle (spawn/poll/kill
sidecar), tray, and path/env wiring. No application rewrite — the sealed
web core ships as-is.

**Key enabler already in the codebase:** `GBP_ROOT` (dashboard) and
`ROTHER_DATA_DIR` (scraper) are env-overridable. Desktop = pointing those
envs at OS app-data dirs. Zero code changes for data relocation.

---

## 1. Resolved decisions

| Decision | Choice | Rationale |
|---|---|---|
| UI server | Next standalone + Node sidecar (archived-plan approach) | API routes require a server; static export impossible ||
| Data location | Tauri `app_data_dir()`, wired via `GBP_ROOT` + `ROTHER_DATA_DIR` envs | Existing env plumbing = zero app changes; proper installed-app behavior. Optional `--portable` later |
| Scraper data | `ROTHER_DATA_DIR` points to `app_data_dir/rother-data` for scraper snapshots/deltas/run_summary | Preserves per-business tenant isolation; lock file + NID jar stay at GBP_ROOT 
| First-run config | Scaffold `config/` templates into app-data on first launch (mirrors `--init-config`) | User never touches the install dir |
| Python runtime (MVP) | **Detect + guided setup wizard** (detect `python`/`python3`, offer `pip install -r requirements.txt` + `playwright install chromium` with progress UI) | Proves architecture fastest; embedded runtime is a later optimization |
| Python runtime (later) | Embedded python-build-standalone + wheels (~40–80 MB) | Only if non-dev distribution demands it |
| Playwright Chromium | Download at first scrape to app-data cache (`PLAYWRIGHT_BROWSERS_PATH` env) | Archived-plan approach; never block first launch |
| Scraper UA fingerprint | Keep Windows UA on all host OSes | Certified-variant consistency (research doc §1b) |
| Build matrix | win-x64 + linux-x64 first; macos-x64/arm64 after signing account | Research doc §1d |
| CI | GitHub Actions matrix (ubuntu-22.04, windows-latest, macos-later) | Also retires the long-standing "GHA execution UNPROVEN" item |
| Auto-update | Stubbed (tauri updater plugin configured, disabled) | Out of scope for v0.4.0 |

---

## 2. Phases

### Phase A — Scaffold revival (Windows) · ~1 session
- [x] Copy `src-tauri/` from archive (Cargo.toml, build.rs, icons, capabilities)
- [x] Update `Cargo.toml` version to 0.4.1
- [x] Update `tauri.conf.json` for Tauri v2 stable schema (closeOnLastWindow, CSP wildcards, frontendDist path)
- [x] Update `main.rs` for current Tauri v2 API (Child/Child type, Event, set_url, close-requested listener)
- [x] Update `capabilities/default.json` for Tauri v2 schema (localAccess, process:allow-exit)
- [ ] Install Rust toolchain + `tauri-cli`; `cargo check` green.
- [ ] Window launches loading a hard-coded external URL (proof of shell).
- Exit: empty Tauri window on Windows renders any URL.

### Phase B — Sidecar wiring (Windows) · ~1–2 sessions
- [ ] Build step: `next build` standalone → copy `.next/standalone` +
      static assets + `node` sidecar binary into Tauri resources
      (extend `.zscripts/build.mjs` pattern into `src-tauri/build.mjs`).
- [ ] `main.rs`: spawn sidecar with envs (`PORT`, `GBP_ROOT`,
      `ROTHER_DATA_DIR`), poll health endpoint, set webview URL on ready,
      kill process tree on close (mirror scrape-runner's win/posix logic).
- [ ] Port strategy: random free port → passed to sidecar + webview.
- Exit: full dashboard (login → onboarding → hubs) usable INSIDE the
  Tauri window; closing the window leaves no orphan processes.

### Phase C — Data & config relocation · ~1 session
- [ ] App-data dirs via Tauri path API; first-run scaffold of `config/`
      templates + empty `data/` tree.
- [ ] Optional one-click "import existing data" (copy from a chosen
      folder) for migrating the dev setup.
- [ ] Verify: onboarding → fixtures run → snapshots land in app-data
      tenant dir; rate limiter + seen-store + snapshot sidecars all
      functional from the new location.
- Exit: full v0.4.1 feature set (self-monitoring, harvest honesty,
  variance-proof deltas, STALE-NID guard, panel collapse recovery,
  sort outcome logging) working from app-data.

### Phase D — Scraper bootstrap wizard · ~1–2 sessions
- [ ] Detection screen: Python present? version? `requirements.txt`
      installed? Chromium present? (`playwright install --check` pattern
      already exists in run_all preflight.)
- [ ] Guided actions with streamed progress (sidecar executes, Tauri
      window shows output).
- [ ] First live scrape from the desktop app end-to-end.
- Exit: non-dev user can go from installer → live scrape without a terminal.

### Phase E — Windows packaging · ~1 session
- [ ] `tauri build` → NSIS/MSI; measure size (budget: < 250 MB without
      Chromium; document with-Chromium footprint).
- [ ] SmartScreen reality check (unsigned → warn-through documented).
- [ ] Install/uninstall/clean-reinstall test on a clean Windows VM.
- Exit: installer proven on clean Windows; size recorded.

### Phase F — Linux packaging · ~1 session
- [ ] `.deb` + AppImage; webkit2gtk-4.1 dependency documented/checked.
- [ ] Clean-VM test (Ubuntu 22.04/24.04).
- Exit: installers proven; per-OS quirks list updated.

### Phase G — CI matrix · ~1 session
- [ ] GitHub Actions: build Windows + Linux artifacts on tag; size gate
      fails build over budget. (Retires the "GHA UNPROVEN" item.)
- Exit: tag push produces installers automatically.

### Phase H — macOS (gated) · ~1–2 sessions
- [ ] Blocked on Apple Developer account ($99/yr) for signing/notarization.
- [ ] WKWebView UI pass (Tailwind/shadcn generally fine; verify).
- Exit: .dmg installs and runs on Intel + Apple Silicon.

### Phase I — Polish & release v0.4.1
- [ ] Tray icon + "monitoring active" state
- [ ] Auto-update stub (disabled, configured for future use)
- [ ] Docs: `docs/engineering/DESKTOP_GUIDE.md`; CHANGELOG; AGENTS.md sync
- [ ] Tag `v0.4.1` + GitHub Release with installers (Windows + Linux)
- Exit: v0.4.1 desktop released

---

## 3. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Rust toolchain learning curve | Medium | Shell is minimal (window+sidecar); archive scaffold + tauri-cli do the heavy lifting |
| Sidecar port collision / orphan processes | Medium | Random free port; kill-process-tree on close (pattern already proven in scrape-runner) |
| Playwright Chromium path wrong in packaged app | Medium | Explicit `PLAYWRIGHT_BROWSERS_PATH` env into app-data; preflight check exists |
| SmartScreen/Gatekeeper blocking unsigned builds | High (cosmetic) | Documented warn-through; signing in Phase G/H |
| WKWebView rendering quirks | Low-Med | Standard Tailwind/shadcn; Phase H test pass |
| Python detection misses installs (py launcher, venvs) | Medium | Probe `py`/`python`/`python3`; wizard offers manual path entry |
| Scope creep toward embedded Python | Medium | Explicitly Phase-later; wizard proves demand first |
| Antivirus flags scraper child-process spawning | Low-Med | Document; signed builds reduce false positives |
| Tauri v2 API drift (2.x → later 2.x) | Low | Pin Tauri version in Cargo.toml; use `tauri.conf.json` `$schema` for validation |
| NID warm-up fails in packaged environment | Medium | STALE-NID guard already handles retry + re-warm; wizard can re-trigger |
| `freezePrototype: true` breaks dashboard JS | Low | CSP already hardened; test Phase B before proceeding |

## 4. Effort estimate

Phases A–G ≈ **6–9 working sessions** (Windows+Linux shippable).
Phase H adds ~1–2 (signing-dependent). Phase I ~1.

## 5. Status

PLANNED — Phase A scaffold copied + Tauri v2 API updated (awaiting Rust install + cargo check).

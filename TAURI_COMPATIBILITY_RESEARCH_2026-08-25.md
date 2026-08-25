# Tauri Pre-Plan Research — Compatibility Audit & Framework Decision
**Date:** 2026-08-25 · **Status:** RESEARCH COMPLETE (plan drafting next)
**Context:** Rother core is harvest-honest and stable (v0.3.2 + HARVEST_FIX_PLAN,
commits `769e5e7..d562b86`). Tauri gate SATISFIED. This doc captures the
compatibility audit and Electron-vs-Tauri decision analysis that must feed
the fresh Tauri revival plan.

---

## 1. Cross-platform compatibility audit of current Rother (evidence-based)

### 1a. Already platform-neutral (verified in code)

| Component | Evidence |
|---|---|
| Dashboard paths | `path.join` everywhere; no drive letters; `GBP_ROOT` env-overridable (`src/lib/gbp/paths.ts:15-21`); cwd-relative |
| Process management | `scrape-runner.ts:15-48` branches explicitly: `taskkill /T /F` on win32 vs SIGTERM→SIGKILL grace on POSIX |
| Python scraper | stdlib + Playwright (cross-platform); subprocess via list-argv (`sys.executable`, no `shell=True`); graceful SIGINT/SIGTERM shutdown (`run_all.py:630`) |
| Linux build deps | `lightningcss-linux-x64-gnu` in optionalDependencies (added during convergence) |
| Data layer | pathlib / path.join throughout; tenant dirs (`data/users/<id>`) platform-neutral |
| Rate limiting / middleware | platform-neutral |

### 1b. Deliberate platform "non-neutrality" — keep it

The scraper **hardcodes a Windows UA fingerprint**
(`browser.py:118-173`: `sec-ch-ua-platform: "Windows"`, platformVersion 15).
This is intentional and MUST be kept on all host OSes: certified selectors
were validated against the Windows-Chrome Google variant. A uniform UA means
uniform Google rendering regardless of host — i.e., consistent harvests on
Windows/Linux/macOS hosts. Document in the Tauri plan as a feature.

### 1c. Packaging-level considerations only (no app-code changes needed)

1. **Node sidecar per target triple**: archive had linux-x86_64 only;
   need win-x64, linux-x64, macos-x64 AND macos-arm64 (Apple Silicon).
2. **Python runtime + Playwright Chromium per OS** (~40–80 MB + ~150–300 MB
   first-run download): heaviest cost; archived plan's deferral strategy
   (download Chromium at first scrape, never bundle) still holds.
3. **macOS**: code signing + notarization (Apple Developer account);
   WKWebView = Safari engine ⇒ one UI test pass needed.
4. **Linux**: webkit2gtk-4.1 system dependency for the Tauri webview.
5. **Dev-only quirks do NOT ship**: Windows Turbopack EBUSY, cp1252 console
   encoding, Unix-only `.zscripts`.

### 1d. Recommended target order

**Windows + Linux first, macOS second.** Windows = dev platform (fastest
feedback); Linux = cheapest Tauri target (deps already present). macOS adds
signing/notarization cost + untested webview engine — prove the architecture
on two targets before adding it.

---

## 2. One codebase, not three — how cross-platform actually works

Neither "three versions" nor "reprogramming per OS". ONE source codebase;
`tauri build` compiles per-target outputs:

```
ONE codebase → tauri build (Windows) → Rother.exe installer
            → tauri build (Linux)   → .deb / AppImage
            → tauri build (macOS)   → .app / .dmg
```

Per-OS work is build configuration only:

| Item | Effort |
|---|---|
| Build machine/CI per OS (GitHub Actions provides all three) | config |
| Sidecar binaries per triple | download step |
| Python/Chromium strategy | one shared decision |
| macOS signing cert | account + config |
| Icons | already exist in archive scaffold |

Genuine per-OS differences the user *notices*: webview engine quirks
(WebView2 / WKWebView / WebKitGTK) needing one test pass each; app-data
paths (handled by Tauri path APIs; our code already joins paths).

Precedent: VS Code, Discord — one product, three installers, ~99%
identical behavior.

---

## 3. Electron vs Tauri — framework decision

| | Electron | Tauri |
|---|---|---|
| Rendering | Bundles full Chromium in EVERY installer (~85–150 MB min) | OS-native webview (WebView2 / WKWebView / WebKitGTK) |
| Backend | Node.js | Rust shell (+ our Node sidecar) |
| Installer | ~85–150 MB base | ~5–15 MB + sidecars |
| Idle RAM | ~150–300 MB (per-app private Chromium) | ~50–100 MB |
| Maturity | 12+ yrs (VS Code, Discord, Slack) | ~4 yrs, v2 stable |
| Consistency | Pixel-perfect (bundled Chromium everywhere) | Per-webview quirk pass needed |
| Language | All JavaScript/Node | Rust shell (thin) + JS |

Electron benefits acknowledged: bundled-Chromium consistency (no quirk
passes), all-JS stack (our dashboard/API are already Node), largest
ecosystem + docs, no Rust toolchain needed.

### Decision: TAURI (re-affirmed; archived plan reached the same verdict)

Rother-specific reasoning:
1. Playwright downloads its OWN managed Chromium to a cache either way —
   Electron's bundled browser does not serve the scraper.
2. The real backend is Python+Playwright with a thin Node sidecar —
   Electron's all-JS advantage barely applies.
3. Long-running background monitor ⇒ Tauri's lower RAM matters daily.
4. <500 MB budget: trivial with Tauri; Electron starts ~100 MB overhead.
5. Scaffold already exists (archived src-tauri: Cargo.toml,
   tauri.conf.json, icons, capabilities).
6. Cost accepted: Rust shell is harder to customize — but our shell's job
   is minimal (window → spawn sidecar → load URL → cleanup).

---

## 4. What the fresh revival plan must address (stale-plan corrections)

The archived 2026-08-13 plan is NOT directly reusable:
- Assumed Node-sidecar-only with data shipped as resources; current Rother's
  core is LIVE scraping via Python+Playwright (the product IS the scraper).
- Tenant data now lives in `gbp-monitor/data/users/{businessId}/` +
  `config/user-business.json`; needs relocation strategy to app-data dirs
  (or documented portable-data mode).
- `DESKTOP_PACKAGING.md` references dead CLI flags (`--business`,
  `--max-reviews` removed in v0.3.0).
- New since then: seen-store + snapshot metadata files (must move with the
  data dir); rate limiter; scheduler.

## 5. Status

Research complete. Next step: draft fresh `TAURI_PLAN_*.md` against the
current architecture using this document as input.

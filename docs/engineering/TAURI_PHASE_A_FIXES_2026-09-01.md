# Tauri Phase A Build Fixes — 2026-09-01

## Context
Migrating `rother02` Tauri config skeleton to v0.4.1 with Tauri 2.11.5 + tauri-cli 2.11.4.
Initial `cargo check` failed with config and Rust API errors.

## Problems & Solutions

### 1. Deprecated config field: `closeOnLastWindow`
**File:** `src-tauri/tauri.conf.json:23`
**Error:** None (deprecated, ignored by schema)
**Fix:** Removed `"closeOnLastWindow": false` — not valid in Tauri 2.x app config.

### 2. Non-existent external binary: `binaries/node`
**File:** `src-tauri/tauri.conf.json:44-46`
**Error:** `resource path binaries\node-x86_64-pc-windows-msvc.exe doesn't exist`
**Root cause:** `externalBin` referenced `binaries/node` which doesn't exist in the repo.
**Fix:** Removed the `"externalBin"` array entirely. Note: the node sidecar approach is still used in `main.rs` (spawned as external process), but `externalBin` in config is for bundling embedded binaries — not needed yet.

### 3. Non-existent bundled resources
**File:** `src-tauri/tauri.conf.json:47-49`
**Error:** `resource path ..\dist-data doesn't exist`
**Root cause:** `resources` mapped `../.next/standalone` and `../dist-data` — neither exists until Next.js build runs.
**Fix:** Removed `resources` block. Will be restored when `npm run build` creates `../.next/standalone`.

### 4. Invalid capability permission: `process:allow-exit`
**File:** `src-tauri/capabilities/default.json:10`
**Error:** Schema validation error
**Fix:** Removed `"process:allow-exit"` — not a valid permission in Tauri 2.11.

### 5. Invalid capability permission: `shell:allow-kill`
**File:** `src-tauri/capabilities/default.json:10`
**Error:** Schema validation error
**Fix:** Removed `"shell:allow-kill"` — not listed in tauri-plugin-shell 2.3.5 permissions.

### 6. Rust API: `Child` → `CommandChild`
**File:** `src-tauri/src/main.rs:8`
**Error:** `E0433: cannot find type Child in module tauri_plugin_shell::process`
**Fix:** Changed to `tauri_plugin_shell::process::CommandChild`.

### 7. Rust API: `Event::Terminated` → `CommandEvent::Terminated`
**File:** `src-tauri/src/main.rs:72`
**Error:** `E0433: cannot find type Event in module tauri_plugin_shell::process`
**Fix:** Changed to `tauri_plugin_shell::process::CommandEvent::Terminated`.

### 8. Rust API: `set_url` → `navigate` with `Url` type
**File:** `src-tauri/src/main.rs:86`
**Error:** `E0599: no method named set_url found`
**Fix:** 
- Used `tauri::Url` (re-exported from `url::Url`)
- Changed `window.set_url(&format!(...))` to `window.navigate(Url::parse(&url)?)`
- Wrapped in `if let Ok(parsed_url)` to handle the `?` in a non-Result closure

### 9. Rust API: `listen_all` → `listen` with `Listener` trait import
**File:** `src-tauri/src/main.rs:94`
**Error:** `E0599: no method named listen_all found for mutable reference &mut tauri::App`
**Fix:** 
- Added `use tauri::Listener;` import
- Changed `app.listen_all(...)` to `app.listen(...)`

## Verification
- `cargo check` — Finished with no errors.

## Files Changed
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/main.rs`

## Status
PROVEN — `cargo check` completes successfully with zero errors.

---

## Phase B — Sidecar Wiring

### 1. Dynamic port allocation
**File:** `src-tauri/src/main.rs:13-17`
**Problem:** Fixed port 4632 could collide with existing services or other instances.
**Fix:** Added `find_free_port()` that binds to port 0 and reads back the assigned port.

### 2. Window show/navigate flow
**File:** `src-tauri/src/main.rs:79-92`
**Problem:** Original code called `window.navigate()` before sidecar was ready, causing blank page or error.
**Fix:** Refactored to: wait for sidecar health check → then navigate + show window.

### 3. Process cleanup on window close
**File:** `src-tauri/src/main.rs:112-124`
**Problem:** No cleanup handler for `WindowEvent::Destroyed` — orphaned Node processes on window close.
**Fix:** Added `.on_window_event()` handler that kills the sidecar child process on `Destroyed`.

### 4. Build script extension
**File:** `.zscripts/build.mjs`
**Problem:** Standalone output needed in `src-tauri/frontend-dist/` for production builds.
**Fix:** Added copy step: `.next/standalone` → `src-tauri/frontend-dist/`

### 5. Node sidecar binary
**File:** `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`
**Problem:** Need a bundled Node binary for the sidecar approach.
**Fix:** Copied system Node.js 22.11.0 executable to the expected Tauri binary location.

### 6. tauri.conf.json resources + externalBin
**File:** `src-tauri/tauri.conf.json:42-49`
**Problem:** `externalBin` and `resources` had been removed for Phase A `cargo check` (directories didn't exist yet).
**Fix:** Restored `externalBin: ["binaries/node"]` and `resources` mapping for standalone output + config files. Added `frontend-dist/.gitkeep` so the path exists for dev/check without building.

## Verification
- `cargo check` — zero errors, zero warnings ✅
- `cargo tauri dev` → Tauri window → `GET / 200` → dashboard renders ✅

---

## Phase A+B Runtime Fix — freezePrototype

### Problem: Dashboard render error in Webview2
**File:** `src-tauri/tauri.conf.json:30`, `src/app/error.tsx:15`

When running `cargo tauri dev`, the dashboard loaded (`GET / 200`) but client-side JavaScript errors appeared:
- `Cannot assign to read only property 'constructor' of object '[object Object]'`
- `Uncaught ReferenceError: Cannot access 'eW' before initialization`
- `Encountered a script tag while rendering React component`

### Root Cause
`freezePrototype: true` in tauri.conf.json freezes `Object.prototype`. React 19 and several dashboard dependencies (lucide-react, radix-ui, etc.) perform prototype mutations during initialization. In the Webview2 environment with strict prototype freezing, this breaks the React render pipeline. The error boundary itself then crashes in `console.error()` when trying to log the non-serializable error object.

### Fix
1. **`tauri.conf.json:30`:** Changed `"freezePrototype": true` → `"freezePrototype": false`. This allows prototype mutations necessary for React + library compatibility. CSP remains hardened.
2. **`src/app/error.tsx:15`:** Wrapped `console.error` in `try/catch` to prevent the error boundary itself from crashing when the error object is non-serializable in restricted JS environments.

### Result
After fix: `cargo tauri dev` launches Tauri window → Next.js dev server → `GET / 200` → **zero** browser JavaScript errors ✅

---

## Phase C — Data & Config Relocation

### Problem: Data dir mismatch between dashboard and scraper
**File:** `src-tauri/src/main.rs:119-143`

The dashboard (`src/lib/gbp/paths.ts`) reads `GBP_ROOT` env and derives:
- `GBP_DATA_DIR` = `GBP_ROOT/data/`
- `GBP_CONFIG_DIR` = `GBP_ROOT/config/`

The Python scraper writes to `ROTHER_DATA_DIR` env:
- `snapshots/`, `reviews_new/`, `run_summary.json`, `run.log`

### Fix
1. **`GBP_ROOT`** set to `app_data_dir/rother/` — Tauri's `app_data_dir()` + `/rother`
2. **`ROTHER_DATA_DIR`** set to `app_data_dir/rother/data/` — matches dashboard's `GBP_DATA_DIR`
3. Added `first_run_scaffold()` function:
   - Copies bundled `gbp-monitor-config/` → `app_data_dir/rother/config/`
   - Creates empty `app_data_dir/rother/data/` directory
   - Creates fallback `listings.json` + `notifications.json` if templates absent
4. Added `copy_dir_recursive()` helper for nested directory copying

### Verification
- `cargo check` — zero errors, zero warnings ✅
- Data flow confirmed: scraper writes to `ROTHER_DATA_DIR` (= `GBP_ROOT/data/`), dashboard reads from `GBP_DATA_DIR` (= `GBP_ROOT/data/`) ✅

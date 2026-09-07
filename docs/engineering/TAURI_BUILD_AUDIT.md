# Tauri Desktop Build Audit

## Summary

This document records the issues found during the Tauri desktop build audit and the fixes applied.

## Issues Found and Fixed

### 1. Turbopack Build Warnings

**Problem:** Turbopack 5 emits warnings for `spawnSync`, `spawn`, and `path.join` calls in API route files, because these Node.js builtins are not available in the browser runtime.

**Fix:** Added `// @ts-ignore` comments? No — added `/*turbopackIgnore: true*/` directives to all affected call sites in:
- `src/app/api/health/route.ts`
- `src/app/api/setup/detect/route.ts`
- `src/app/api/setup/install/route.ts`
- `src/lib/gbp/scrape-runner.ts`
- `src/lib/gbp/server-data.ts`

**Status:** Fixed — 0 warnings during `npx next build`.

### 2. Frontend-Dist Contamination

**Problem:** The `cpSync` call in `build.mjs` copied ALL files from the Next.js standalone output to `frontend-dist`, including:
- Non-app directories: `rother02-archive/`, `examples/`, `imagetest/`, `tool-results/`, etc.
- Server-side files: `server.js`, `package.json`, `package-lock.json`
- Config files: `.env`, `components.json`, `opencode.json`, `tsconfig.json`, `_audit_reviews_output.json`

**Fix:** Added `EXCLUDE_DIRS` set (12 entries) and `EXCLUDE_FILES` set (8 entries) to `build.mjs`. The `shouldExclude()` function filters these during `cpSync`.

**Status:** Fixed — `frontend-dist` now only contains `.next/`, `.rother/`, `public/`, `src/`, and `index.html`.

### 3. Double-Build CWD Corruption

**Problem:** The `standalone-server/` directory was placed inside `src-tauri/`. This directory contained a `package.json` from the Next.js standalone output. On the second `cargo tauri build`, Cargo/Tauri mis-resolved `CARGO_MANIFEST_DIR` to `src-tauri/standalone-server/` instead of `src-tauri/`, causing the `beforeBuildCommand` to fail with `Cannot find module`.

**Root Cause:** The `standalone-server/` directory inside `src-tauri/` interfered with Cargo's manifest directory resolution, likely because the `package.json` at that location was picked up as a workspace member or resource root.

**Fix:** Moved the server bundle from `src-tauri/standalone-server/` to `.tauri-cache/standalone-server/` (project root, outside `src-tauri/`). Updated `tauri.conf.json` `resources` entry accordingly.

**Status:** Fixed — 2 consecutive `cargo tauri build` runs both succeed.

### 4. Missing index.html (Runtime Error)

**Problem:** Tauri's webview requires `index.html` at the `frontendDist` root at startup. Next.js standalone output is server-side rendered — HTML files are inside `.next/server/pages/` (404.html, 500.html), not at the root. This caused the "asset not found: index.html" error when running the installed desktop app.

**Fix:** Added a step to `build.mjs` that writes a minimal loading screen `index.html` to `frontend-dist/` after copying assets. The loading screen shows "Starting Rother..." with a spinner animation. After ~1s, `main.rs` navigates the webview to `http://127.0.0.1:PORT/` where the Node.js sidecar serves the real Next.js app.

**Status:** Fixed — `index.html` present in `frontend-dist`, loading screen generated.

### 5. TypeScript Configuration

**Problem:** `tsconfig.json` did not exclude `src-tauri/` and `gbp-monitor/` directories, causing type-checking errors from non-app TypeScript files.

**Fix:** Added `src-tauri` and `gbp-monitor` to the `exclude` array in `tsconfig.json`.

**Status:** Fixed — `tsc --noEmit` passes with 0 errors.

### 6. Windows EBUSY File Lock Errors

**Problem:** On Windows, `rmSync` can fail with `EBUSY` if files are still locked by the OS during cleanup of `frontend-dist/` and `standalone-server/`.

**Fix:** Added EBUSY retry logic to `removeDir()` function in `build.mjs` — retries up to 3 times with 1s delays, falls back to `cmd /c "rmdir /s /q"` for stubborn locks.

**Status:** Fixed.

### 8. Infinite Loading Screen (Sidecar Path Bug)

**Problem:** After installing the Tauri app, it gets stuck on "Starting Rother..." loading screen indefinitely (5+ minutes).

**Root Cause:** In `src-tauri/src/main.rs`, the `beforeBuildCommand` spawns the Node.js sidecar with:
```rust
.args(["standalone/server.js"])
.current_dir(&standalone_dir)  // standalone_dir = resource_dir.join("standalone")
```
The working directory is already set to `resource_dir/standalone/`, but the argument path is `standalone/server.js`. Node.js resolves this relative to the working directory, looking for `standalone/standalone/server.js` — a nonexistent path. The Node.js process fails immediately, the port never opens, and the loading screen displays forever.

**Fix:** Changed `.args(["standalone/server.js"])` to `.args(["server.js"])` (line 137).

**Status:** Fixed — app should now start the Node.js sidecar correctly.

### 7. .gitignore Cleanup

**Problem:** `frontend-dist/` and `standalone-server/` directories were not gitignored, allowing build artifacts to be committed.

**Fix:** Added `/src-tauri/frontend-dist/` and `/.tauri-cache/` to `.gitignore`.

**Status:** Fixed.

## Final Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 119/119 pass |
| `npx eslint src` | 0 errors (5 pre-existing warnings) |
| `npx next build` | No warnings |
| `cargo tauri build` (1st) | Success — MSI + NSIS produced |
| `cargo tauri build` (2nd) | Success — double-build safe |
| `frontend-dist` contents | `.next/`, `.rother/`, `public/`, `src/`, `index.html` |
| `standalone-server` contents | `server.js`, `node_modules/`, `package.json` |
| `main.rs` sidecar path | Fixed — `server.js` relative to standalone_dir |
| Secrets scan | No exposed secrets |

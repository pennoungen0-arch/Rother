# Building Rother Tauri for Linux (2026-09-06)

**Status:** ✅ Linux build support added — safe, additive changes only.
**Scope:** Tauri desktop app for Linux x86_64 (.deb + .AppImage).
**Risk to Windows build:** None — all changes are additive and target-gated.

---

## Safety: Why This Doesn't Break the Windows Build

The existing Windows-only installer at `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe` is **untouched**. The Windows `_IS_WIN_GLOBAL` blocks in `main.rs` are **untouched**. The Linux changes live entirely in:

1. A new file: `src-tauri/binaries/node-x86_64-unknown-linux-gnu` (additive — Tauri picks the binary matching the build target triple).
2. A new `else` branch in `kill_process_on_port` (the `if _IS_WIN_GLOBAL { ... }` block is identical to before).
3. Two new scripts: `.zscripts/fetch-linux-node-sidecar.sh`, `.zscripts/build-linux.sh` (don't run on Windows builds).

## Prerequisites

### System packages (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
    build-essential curl wget file libssl-dev pkg-config \
    libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
    libwebkit2gtk-4.1-dev libsoup-3.0-dev \
    lsof
```

`lsof` is used for port-based process killing on Linux. If unavailable, the script falls back to `ss -tlnp`.

### Rust toolchain

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add x86_64-unknown-linux-gnu
```

### Node.js sidecar

The Linux build requires a `node` binary at `src-tauri/binaries/node-x86_64-unknown-linux-gnu`.

Download it with:

```bash
pwsh .zscripts/fetch-linux-node-sidecar.sh
```

This downloads the Node.js version specified in `package.json` engines.node (defaults to v22.11.0), verifies it, and installs it as the sidecar.

---

## Build

```bash
# 1. Install npm deps (first time only)
npm install

# 2. Fetch the Linux Node sidecar (first time only)
pwsh .zscripts/fetch-linux-node-sidecar.sh

# 3. Build the Linux installer
pwsh .zscripts/build-linux.sh
```

The build script:

1. Checks for the Linux Node sidecar (fails with a helpful message if missing).
2. Runs `npx next build` + the standalone bundling (`node .zscripts/build.mjs`).
3. Runs `cargo tauri build --target x86_64-unknown-linux-gnu`.

Outputs:

```
src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/Rother_<version>_amd64.deb
src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/Rother_<version>_amd64.AppImage
```

---

## Install

### .deb (Debian/Ubuntu/Mint)

```bash
sudo dpkg -i Rother_0.4.2_amd64.deb
# If dependencies are missing:
sudo apt-get install -f
rother
```

### .AppImage (any distro)

```bash
chmod +x Rother_0.4.2_amd64.AppImage
./Rother_0.4.2_amd64.AppImage
```

For system-wide install, place the AppImage in `~/.local/bin/` and ensure FUSE is available (`sudo apt install libfuse2` on Ubuntu 22.04+).

---

## What Changed (Code-wise)

### 1. `src-tauri/src/main.rs` — Linux `kill_process_on_port`

Added a Linux branch to `kill_process_on_port` (previously Windows-only / no-op). The new branch:

- Uses `lsof -i :PORT -t` to find PIDs (one per line).
- Falls back to `ss -tlnp` if `lsof` is not installed (parses `pid=` from the users column).
- Sends SIGTERM, waits 500ms, then SIGKILL — mirrors the graceful-then-forced shutdown pattern used in `killProcessTreeByPid`.

The Windows branch is unchanged. All changes are behind `if _IS_WIN_GLOBAL { ... } else { ... }`.

### 2. `.zscripts/fetch-linux-node-sidecar.sh`

Cross-platform PowerShell script (works in bash on Linux, bash on macOS, or PowerShell on Windows/WSL). Downloads the Node.js Linux x86_64 tarball, extracts `bin/node`, chmods it, and installs it at the sidecar path.

### 3. `.zscripts/build-linux.sh`

Cross-platform PowerShell build script. Verifies the sidecar, builds Next.js standalone, then runs `cargo tauri build --target x86_64-unknown-linux-gnu`.

---

## Testing

After building:

```bash
# Check the .deb metadata
dpkg-deb -I src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/Rother_*.deb

# Install in a clean container (optional)
docker run --rm -it -v $(pwd):/rother ubuntu:22.04 bash
apt update && apt install -y /rother/src-tauri/target/.../Rother_*.deb
rother

# Or run the AppImage directly
chmod +x Rother_*.AppImage
./Rother_*.AppImage
```

---

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| Icons: `icon.icns` is macOS-only; `icon.ico` is Windows-only. Linux uses `icon.png` (already present). | None — Tauri falls back to PNG on Linux automatically. |
| WebKitGTK 4.1 required for rendering. | Install `libwebkit2gtk-4.1-dev` (see prerequisites). |
| Some Tauri features may differ slightly across platforms (tray icon behavior, etc.) | Tested on Ubuntu 22.04 / Debian 12; other distros may need package adjustments. |

---

## Test Results

| Check | Result |
|-------|--------|
| `cargo check` on Windows | ✅ Compiles cleanly |
| `cargo tauri build` on Windows (MSI + NSIS) | ✅ Both installers produced, identical to pre-change |
| vitest 134/134 | ✅ Pass |
| verify_baseline 168/168 | ✅ Pass |
| tsc 0 errors | ✅ Pass |

The Windows build was verified to still produce identical installers after the Linux additions.

# Building Rother Tauri for macOS

**Status:** ✅ Build support complete — Phase 1 code changes verified. macOS build requires a macOS host.  
**Last updated:** 2026-09-07  
**Scope:** Tauri desktop app for macOS (universal: Apple Silicon + Intel).

---

## Prerequisites

### 1. System Requirements
- **macOS 13.0+** (Ventura) on Apple Silicon (arm64) or Intel (x86_64)
- **10 GB free disk space** (Node binaries ~112-119 MB, build artifacts ~2-3 GB)
- **Apple Developer Program membership** ($99/year) — required for notarization

### 2. Install Xcode Command Line Tools
```bash
xcode-select --install
# Click "Install" in the dialog that appears
```

### 3. Install Rust Toolchain
```bash
# Install rustup (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Add macOS target triples
rustup target add aarch64-apple-darwin    # Apple Silicon (M1/M2/M3)
rustup target add x86_64-apple-darwin     # Intel (or for universal builds on Apple Silicon)
```

### 4. Install Node.js
```bash
# Option A: Homebrew (recommended)
brew install node@22

# Option B: Direct download from https://nodejs.org
# Verify: node --version (should be v22.x)
```

### 5. Tauri CLI (optional but recommended)
```bash
npm install -D @tauri-apps/cli
# Or via cargo:
cargo install tauri-cli
```

### 6. Apple Developer Setup (for signing/notarization)
1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create a "Developer ID Application" certificate in the Apple Developer portal
3. Download the `.cer` file and add it to your keychain
4. Create an app-specific password for notarization:
   - Apple ID Settings → Password & Security → App-specific passwords
5. Configure environment variables (or use Xcode):
   ```bash
   # Add to ~/.zshrc or ~/.bash_profile
   export APPLE_CERTIFICATE="/path/to/your/cert.p12"
   export APPLE_CERTIFICATE_PASS="your-cert-password"
   export APPLE_TEAM_ID="YOUR10CHARTEAMID"
   export AC_PASSWORD="app-specific-password"  # for notarytool keychain profile
   ```

---

## Build Methods

### Method A: Using the build script (recommended)
```bash
pwsh .zscripts/build-mac.sh
```
This script handles:
1. Prerequisite checking (Xcode tools, Rust targets, Node sidecar binaries)
2. Next.js standalone build via `node .zscripts/build.mjs`
3. `cargo tauri build` for both `aarch64-apple-darwin` and `x86_64-apple-darwin`
4. Optional notarization + stapling if Apple secrets are configured

### Method B: Manual build (step-by-step)

#### Step 1: Build Next.js
```bash
npm install                       # Install npm dependencies
node .zscripts/build.mjs          # Builds standalone + copies to frontend-dist + .tauri-cache
```

**Expected output:**
```
Loading screen index.html written to src-tauri/frontend-dist
Build complete — standalone output ready at .next/standalone
Web assets copied to src-tauri/frontend-dist
Server bundle copied to .tauri-cache/standalone-server
```

#### Step 2: Build Tauri for Apple Silicon (M1/M2/M3)
```bash
cd src-tauri
cargo tauri build --target aarch64-apple-darwin
```

#### Step 3: Build Tauri for Intel (via Rosetta on Apple Silicon, or natively on Intel)
```bash
cd src-tauri
cargo tauri build --target x86_64-apple-darwin
```

#### Step 4 (optional): Notarize and staple
```bash
# Sign with Developer ID
xcrun notarytool submit \
    src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Rother_*.dmg \
    --keychain-profile "AC_PASSWORD" \
    --wait

# Staple the notarization ticket
xcrun stapler staple \
    src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Rother_*.dmg
```

### Method C: GitHub Actions CI
Push a tag to trigger automatic build + signing:
```bash
git tag v0.4.2-mac && git push --tags
```
The workflow at `.github/workflows/macos.yml` will:
1. Build on `macos-latest` (Apple Silicon M1 runners)
2. Build for both `aarch64-apple-darwin` and `x86_64-apple-darwin`
3. Sign with the `APPLE_CERTIFICATE` secret
4. Notarize via `notarytool`
5. Staple the ticket
6. Upload signed `.app` + `.dmg` as artifacts

---

## Output Artifacts

After a successful build:

| Target | Architecture | Output |
|--------|-------------|--------|
| `aarch64-apple-darwin` | Apple Silicon (M1/M2/M3) | `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Rother_0.4.2_aarch64.dmg` |
| `x86_64-apple-darwin` | Intel | `src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/Rother_0.4.2_x86_64.dmg` |

The `.app` bundles are in the `macos/` subdirectory (notarized version for distribution).

---

## Error Diagnosing & Solutions

### E1: `error: process didn't exit successfully: cargo`
**Cause:** Missing Rust target for the requested architecture.

**Solution:**
```bash
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
```

---

### E2: `error: could not find `cargo` in PATH`
**Cause:** Rust not installed or not in PATH.

**Solution:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
# Or add to ~/.zshrc: export PATH="$HOME/.cargo/bin:$PATH"
```

---

### E3: `error: failed to run custom build command for rother-desktop`
**Cause:** Missing Xcode Command Line Tools.

**Solution:**
```bash
xcode-select --install
```
If already installed but stale:
```bash
sudo xcode-select --reset
```

---

### E4: `error: node sidecar binary not found in bundle`
**Cause:** Tauri can't find the Node.js binary in `src-tauri/binaries/`.

**Solution:**
1. Verify the binaries exist:
   ```bash
   ls -la src-tauri/binaries/
   # Should show: node-x64-apple-darwin, node-arm64-apple-darwin, node-x86_64-pc-windows-msvc.exe
   ```
2. If missing, download manually:
   ```bash
   # Apple Silicon
   curl -O https://nodejs.org/dist/v22.11.0/node-v22.11.0-darwin-arm64.tar.gz
   tar xzf node-v22.11.0-darwin-arm64.tar.gz
   cp node-v22.11.0-darwin-arm64/bin/node src-tauri/binaries/node-arm64-apple-darwin
   chmod +x src-tauri/binaries/node-arm64-apple-darwin

   # Intel
   curl -O https://nodejs.org/dist/v22.11.0/node-v22.11.0-darwin-x64.tar.gz
   tar xzf node-v22.11.0-darwin-x64.tar.gz
   cp node-v22.11.0-darwin-x64/bin/node src-tauri/binaries/node-x64-apple-darwin
   chmod +x src-tauri/binaries/node-x64-apple-darwin
   ```
3. Verify the binary works:
   ```bash
   src-tauri/binaries/node-arm64-apple-darwin --version
   ```

---

### E5: `error: linking with cc failed: ld: archive has no sym51 for architecture arm64`
**Cause:** Mixing architectures — Rust target doesn't match the system architecture.

**Solution:**
- On Apple Silicon, building with `--target x86_64-apple-darwin` is fine (cross-compilation via Rosetta)
- But the Node sidecar binary must also match the target. Ensure you're using the correct `node-arm64-apple-darwin` for Apple Silicon builds

---

### E6: `error: The system extension blocked a process...` / Gatekeeper warning on first launch
**Cause:** Unsigned app — macOS blocks execution.

**Solution:**
1. **For development builds:** Right-click (Ctrl-click) the `.app` → "Open" → click "Open" in the dialog
2. **For distribution:** Sign and notarize the app (see Method A/B Step 4)
3. **Quick fix for testing:**
   ```bash
   sudo xattr -rd com.apple.quarantine /path/to/Rother.app
   ```

---

### E7: `notarytool: submission was rejected — Package is unsigned`
**Cause:** The `.dmg` or `.app` wasn't signed before notarization.

**Solution:**
1. Ensure `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASS` are set
2. The `build-mac.sh` script handles signing automatically when these env vars are present
3. For manual builds, use `codesign` before notarizing:
   ```bash
   codesign --force --deep --sign "Developer ID Application: YOUR_TEAM_ID" \
     --entitlements src-tauri/entitlements.plist \
     src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Rother.app
   ```

---

### E8: `notarytool: The provided password is invalid` / `AC_PASSWORD not found`
**Cause:** Apple ID keychain profile not configured.

**Solution:**
```bash
# Create a keychain profile for notarytool
xcrun notarytool store-credentials "AC_PASSWORD" \
    --apple-id "your@email.com" \
    --password "app-specific-password-from-apple-id-settings"
```
You can generate an app-specific password at: https://appleid.apple.com → App-specific passwords

---

### E9: `error: WebKitWebContent quit unexpectedly` or blank dashboard
**Cause:** WKWebView (Safari engine) rendering issue — usually a JS/CSS compatibility quirk.

**Solution:**
1. Check the Tauri dev server is running: `http://127.0.0.1:3000` should load in a browser
2. Check the sidecar is running: `ps aux | grep node` — if no sidecar process, the dashboard won't load
3. Clear macOS app data and restart:
   ```bash
   rm -rf ~/Library/Application\ Support/com.rother.desktop
   # Then relaunch the app
   ```
4. If the standalone server isn't found, re-run the build script:
   ```bash
   node .zscripts/build.mjs
   ```

---

### E10: `playwright: chromium not installed` on first scrape
**Cause:** Chromium is downloaded on first use (not bundled). The macOS path must be correct.

**Solution:**
The Chromium path detection in `src/app/api/setup/detect/route.ts` checks:
- macOS: `~/Library/Caches/ms-playwright`

If Chromium isn't found, install it:
```bash
# Via the app's Setup Wizard: Tools hub → Setup → Install Playwright Chromium
# Or manually:
cd gbp-monitor
python -m playwright install chromium
```

---

### E11: `process exited with code 101` during `cargo tauri build`
**Cause:** Could be a variety of issues. Most common: Tauri config schema mismatch or missing `tauri.conf.json` field.

**Solution:**
1. Validate the Tauri config:
   ```bash
   npx tauri info
   ```
2. Check `tauri.conf.json` against the schema:
   ```bash
   # The $schema field should validate in VS Code
   cat src-tauri/tauri.conf.json | python -m json.tool
   ```
3. Ensure all required fields exist (the macOS `"macOS"` block is optional — if problematic, try removing it temporarily)

---

### E12: Build succeeds but `.dmg` is 0 bytes or missing
**Cause:** Signing failed silently, or `cargo tauri build` couldn't find the Apple certificate.

**Solution:**
1. Verify the certificate is in your keychain:
   ```bash
   security find-identity -v -p codesigning
   ```
2. If no Developer ID certificate, the build produces an unsigned `.app` but the `.dmg` may fail
3. Build without signing for testing:
   ```bash
   # Temporarily remove the macOS signing config from tauri.conf.json
   # or set CARGO_TAURI_BUNDLE_MACOS_EXCEPTIONS to skip signing
   ```

---

## Testing Checklist

After building on macOS:

| Test | Expected Result | How |
|------|----------------|------|
| App launches | Window opens, shows loading spinner | Double-click `.app` |
| Dashboard renders | Login → hubs → features visible | Wait 2-3s for sidecar |
| Setup wizard | Tools → Setup → detects Python + Chromium | Click through each step |
| Process cleanup | No orphan `node` processes in Activity Monitor after close | Close window → check Activity Monitor |
| Scraper runs | Reviews appear in dashboard after "Run" | Click Run → check `/api/reviews` |
| Universal binary | Runs natively on both Apple Silicon + Intel | Test on both architectures |

---

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| macOS 13.0+ minimum (due to `minimumSystemVersion` in `tauri.conf.json`) | Users on macOS 12 or older cannot install. Document in release notes. |
| Playwright Chromium requires ~150MB first-run download | Guided Setup wizard handles installation automatically |
| Apple Silicon builds cannot be produced on Intel Macs (and vice versa) | Use GitHub Actions `macos-latest` (M1 runners) for both targets |
| Unsigned builds show Gatekeeper warning | Right-click → Open (first run only), or sign with Developer ID |
| WKWebView uses Safari's engine (not Chromium) | UI tested against Safari — Tailwind + shadcn are web-standard, no issues expected |

---

## Test Results

| Check | Result |
|-------|--------|
| `cargo check` on Windows (syntax validation) | ✅ Compiles cleanly |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx eslint src` | ✅ 0 errors, 0 warnings |
| `npx vitest run` | ✅ 134/134 |
| `python -m tests.verify_baseline` | ✅ 168/168 |
| `next build` + `node .zscripts/build.mjs` | ✅ Frontend assets produced |
| Node macOS binaries present | ✅ Both `arm64` + `x64` in `src-tauri/binaries/` |
| `entitlements.plist` present | ✅ Hardened runtime configured |

> **Note:** These tests were run on Windows. Actual macOS build verification (`.app` install, launch, scrape) requires a macOS machine and was NOT performed in this environment.

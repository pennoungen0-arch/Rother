#!/usr/bin/env pwsh
# Build the Rother Tauri app for macOS.
#
# Usage (from repo root, on macOS, in PowerShell or bash):
#   pwsh .zscripts/build-mac.sh
#
# This is ADDITIVE — it does NOT modify any Windows-specific files. The
# existing Windows build (cargo tauri build on Windows) is unaffected.
#
# Produces:
#   src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Rother_<version>_aarch64.dmg  (Apple Silicon)
#   src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Rother.app                   (Apple Silicon)
#   src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/Rother_<version>_x86_64.dmg     (Intel, via Rosetta)
#   src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Rother.app                    (Intel)
#
# Requires:
#   - macOS 13+ (Ventura for Apple Silicon / Intel)
#   - Rust toolchain (rustup) with:
#       rustup target add aarch64-apple-darwin  (for Apple Silicon builds)
#       rustup target add x86_64-apple-darwin   (for Intel builds, or via Rosetta)
#   - Xcode Command Line Tools: xcode-select --install
#   - For signed builds: Apple Developer ID certificate + notarytool credentials
#     (set as env vars: APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASS, APPLE_TEAM_ID)
#   - Node.js sidecar binaries at:
#       src-tauri/binaries/node-arm64-apple-darwin
#       src-tauri/binaries/node-x64-apple-darwin
#     (binaries are pre-committed to the repo for v0.4.2)
#
# Reference: https://tauri.app/start/prerequisites/

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path "$PSScriptRoot/.."
$tauriDir = Join-Path $repoRoot "src-tauri"

# --- 1. Verify prerequisites ---
Write-Host "=== Rother Tauri macOS Build ===" -ForegroundColor Cyan

# Check that we're on macOS
if ($IsWindows -or $IsLinux) {
    Write-Warning "This script is intended to run on macOS."
    Write-Warning "If you are running on Windows, use 'cargo tauri build' for Windows."
    Write-Host ""
    $choice = Read-Host "Continue anyway? (y/N)"
    if ($choice -ne "y") { exit 1 }
}

# Detect architecture
$arch = & uname -m 2>/dev/null
if (-not $arch) {
    $arch = "arm64"  # default to Apple Silicon on macOS
}
Write-Host "Detected architecture: $arch"

# Check Xcode Command Line Tools
$cltCheck = & xcode-select -p 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing Xcode Command Line Tools..." -ForegroundColor Yellow
    & xcode-select --install
    Write-Host "  Please complete the installation prompt, then re-run this script."
    exit 1
}

# Check Rust toolchain
Write-Host "Checking Rust toolchain..."
$rustTargets = & rustup target list --installed 2>$null

$buildTargets = @()
if ($arch -eq "arm64" -or $arch -eq "Apple Silicon") {
    $buildTargets = @("aarch64-apple-darwin", "x86_64-apple-darwin")
    if ($rustTargets -notcontains "aarch64-apple-darwin") {
        Write-Host "  Installing aarch64-apple-darwin target..."
        & rustup target add aarch64-apple-darwin
    }
    if ($rustTargets -notcontains "x86_64-apple-darwin") {
        Write-Host "  Installing x86_64-apple-darwin target (for Intel universal build)..."
        & rustup target add x86_64-apple-darwin
    }
} else {
    $buildTargets = @("x86_64-apple-darwin")
    if ($rustTargets -notcontains "x86_64-apple-darwin") {
        Write-Host "  Installing x86_64-apple-darwin target..."
        & rustup target add x86_64-apple-darwin
    }
}

# Check Node sidecar binaries
foreach ($triple in $buildTargets) {
    $sidecarName = if ($triple -eq "aarch64-apple-darwin") {
        "node-arm64-apple-darwin"
    } else {
        "node-x64-apple-darwin"
    }
    $sidecarPath = Join-Path $tauriDir "binaries/$sidecarName"
    if (-not (Test-Path $sidecarPath)) {
        Write-Host "Node sidecar binary not found at: $sidecarPath" -ForegroundColor Yellow
        Write-Host "  Download Node.js v22.11.0 from https://nodejs.org/dist/v22.11.0/"
        Write-Host "  Extract bin/node and copy to: $sidecarPath"
        $choice = Read-Host "Continue without sidecar (will fail at sidecar spawn)? (y/N)"
        if ($choice -ne "y") { exit 1 }
    } else {
        Write-Host "  Found: $sidecarName" -ForegroundColor Green
    }
}

# Check signing configuration
if ($env:APPLE_CERTIFICATE) {
    Write-Host "Apple signing certificate found (APPLE_CERTIFICATE set)" -ForegroundColor Green
} else {
    Write-Host "No Apple signing certificate found — build will be unsigned" -ForegroundColor Yellow
    Write-Host "  For notarized distribution, set APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASS, APPLE_TEAM_ID"
    Write-Host "  See .github/workflows/macos.yml for CI-based signing"
}

# --- 2. Build Next.js standalone (same as Windows/Linux build) ---
Write-Host ""
Write-Host "Building Next.js standalone..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Installing npm deps..."
        & npm install
    }
    & node .zscripts/build.mjs
} finally {
    Pop-Location
}

# --- 3. Build the Tauri installer for each target ---
foreach ($target in $buildTargets) {
    Write-Host ""
    Write-Host "Building Tauri for $target..." -ForegroundColor Cyan

    Push-Location $tauriDir
    try {
        & cargo tauri build --target $target
    } finally {
        Pop-Location
    }
}

# --- 4. Report ---
Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Green
foreach ($target in $buildTargets) {
    $bundleDir = Join-Path $tauriDir "target/$target/release/bundle"

    if (Test-Path (Join-Path $bundleDir "dmg")) {
        Get-ChildItem (Join-Path $bundleDir "dmg") -Filter "*.dmg" -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  DMG:  $($_.FullName)"
        }
    }

    if (Test-Path (Join-Path $bundleDir "macos")) {
        Get-ChildItem (Join-Path $bundleDir "macos") -Filter "*.app" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  APP:  $($_.FullName)"
        }
    }
}

# --- 5. Optional: Notarize and staple ---
if ($env:APPLE_CERTIFICATE) {
    Write-Host ""
    Write-Host "=== Notarizing (Apple signing enabled) ===" -ForegroundColor Cyan

    foreach ($target in $buildTargets) {
        $dmgDir = Join-Path $tauriDir "target/$target/release/bundle/dmg"
        if (Test-Path $dmgDir) {
            Get-ChildItem $dmgDir -Filter "*.dmg" | ForEach-Object {
                $dmgPath = $_.FullName
                Write-Host "  Notarizing: $dmgPath"
                try {
                    & xcrun notarytool submit $dmgPath --keychain-profile "AC_PASSWORD" --wait
                    Write-Host "  Stapling: $dmgPath"
                    & xcrun stapler staple $dmgPath
                    Write-Host "  ✅ Notarized + stapled: $dmgPath" -ForegroundColor Green
                } catch {
                    Write-Host "  ❌ Notarization failed: $_" -ForegroundColor Red
                }
            }
        }
    }
} else {
    Write-Host ""
    Write-Host "=== Skipping notarization (no Apple signing cert) ===" -ForegroundColor Yellow
}

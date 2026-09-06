#!/usr/bin/env pwsh
# Build the Rother Tauri installer for Linux x86_64.
#
# Usage (from repo root, in PowerShell or bash on Linux/macOS/WSL):
#   pwsh .zscripts/build-linux.sh
#
# This is ADDITIVE — it does NOT modify any Windows-specific files. The
# existing Windows build (cargo tauri build on Windows) is unaffected.
#
# Produces:
#   src-tauri/target/release/bundle/deb/Rother_<version>_amd64.deb
#   src-tauri/target/release/bundle/appimage/Rother_<version>_amd64.AppImage
#
# Requires:
#   - Linux x86_64 host (Ubuntu 22.04+ / Debian 12+ recommended)
#   - Rust toolchain (rustup) with x86_64-unknown-linux-gnu target:
#       rustup target add x86_64-unknown-linux-gnu
#   - Tauri build dependencies (see docs/TAURI_LINUX_BUILD.md)
#   - Node.js sidecar binary at:
#       src-tauri/binaries/node-x86_64-unknown-linux-gnu
#     (use .zscripts/fetch-linux-node-sidecar.sh to download it)
#
# Reference: https://tauri.app/start/prerequisites/

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path "$PSScriptRoot/.."
$tauriDir = Join-Path $repoRoot "src-tauri"

# --- 1. Verify prerequisites ---
Write-Host "=== Rother Tauri Linux Build ===" -ForegroundColor Cyan

# Check Linux host
if ($IsWindows -or [System.Environment]::OSVersion.Platform -eq "Win32NT") {
    Write-Warning "This script is intended to run on Linux (or WSL2)."
    Write-Warning "If you are running on Windows, use 'cargo tauri build' for Windows."
    Write-Host ""
    $choice = Read-Host "Continue anyway? (y/N)"
    if ($choice -ne "y") { exit 1 }
}

# Check rust target
Write-Host "Checking rust target x86_64-unknown-linux-gnu..."
$rustTargets = & rustup target list --installed 2>$null
if ($rustTargets -notcontains "x86_64-unknown-linux-gnu") {
    Write-Host "  Installing target..."
    & rustup target add x86_64-unknown-linux-gnu
}

# Check Node sidecar
$sidecarPath = Join-Path $tauriDir "binaries/node-x86_64-unknown-linux-gnu"
if (-not (Test-Path $sidecarPath)) {
    Write-Host "Node sidecar binary not found at $sidecarPath" -ForegroundColor Yellow
    Write-Host "  Run .zscripts/fetch-linux-node-sidecar.sh to download it."
    $choice = Read-Host "Continue without sidecar (will fail at sidecar spawn)? (y/N)"
    if ($choice -ne "y") { exit 1 }
}

# --- 2. Build Next.js standalone (same as Windows build) ---
Write-Host ""
Write-Host "Building Next.js standalone..."
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

# --- 3. Build the Tauri installer ---
Write-Host ""
Write-Host "Building Tauri installer for Linux..."
Push-Location $tauriDir
try {
    & cargo tauri build --target x86_64-unknown-linux-gnu
} finally {
    Pop-Location
}

# --- 4. Report ---
Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Green
$bundleDir = Join-Path $tauriDir "target/x86_64-unknown-linux-gnu/release/bundle"
if (Test-Path (Join-Path $bundleDir "deb")) {
    Get-ChildItem (Join-Path $bundleDir "deb") -Filter "*.deb" | ForEach-Object {
        Write-Host "  DEB:     $($_.FullName)"
    }
}
if (Test-Path (Join-Path $bundleDir "appimage")) {
    Get-ChildItem (Join-Path $bundleDir "appimage") -Filter "*.AppImage" | ForEach-Object {
        Write-Host "  AppImage: $($_.FullName)"
    }
}

#!/usr/bin/env pwsh
# Fetch a Linux x86_64 Node.js binary and install it as the Tauri sidecar.
#
# Usage (from repo root, in PowerShell or bash):
#   pwsh .zscripts/fetch-linux-node-sidecar.sh
#
# This is ADDITIVE — it only writes to src-tauri/binaries/node-x86_64-unknown-linux-gnu.
# The existing Windows sidecar (node-x86_64-pc-windows-msvc.exe) is not touched, so
# Windows builds are unaffected.
#
# Requires:
#   - curl (or wget)
#   - Node.js version in src-tauri/package.json "engines.node" (or hardcoded below)
#   - Linux x86_64 (or use an existing Linux machine / WSL)
#
# Tested on:
#   - Ubuntu 22.04 / Debian 12 (x86_64)
#   - WSL2 with Ubuntu 22.04

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path "$PSScriptRoot/.."
$binariesDir = Join-Path $repoRoot "src-tauri/binaries"
$targetTriple = "x86_64-unknown-linux-gnu"
$binaryName = "node"
$sidecarPath = Join-Path $binariesDir "node-${targetTriple}"

# Resolve Node.js version from package.json engines.node, default to v22.
$packageJsonPath = Join-Path $repoRoot "package.json"
$nodeVersion = "v22.11.0"
if (Test-Path $packageJsonPath) {
    try {
        $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        if ($pkg.engines.node) {
            $eng = $pkg.engines.node
            # Strip semver range chars, take major.minor.patch prefix.
            $cleaned = $eng -replace '[^\d.]', ''
            $parts = $cleaned.Split('.')
            if ($parts.Length -ge 2) {
                $nodeVersion = "v$($parts[0]).$($parts[1]).0"
            }
        }
    } catch {
        Write-Warning "Could not read package.json engines.node; falling back to $nodeVersion"
    }
}

if (-not (Test-Path $binariesDir)) {
    New-Item -ItemType Directory -Path $binariesDir -Force | Out-Null
}

$downloadUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-linux-x64.tar.xz"
$tmpTar = Join-Path $env:TEMP "node-linux-x64.tar.xz"
$tmpExtract = Join-Path $env:TEMP "node-linux-x64-extract"

Write-Host "Downloading Node.js $nodeVersion for Linux x86_64..."
Write-Host "  URL: $downloadUrl"
try {
    if (Get-Command curl -ErrorAction SilentlyContinue) {
        & curl -fL --retry 3 -o $tmpTar $downloadUrl
    } elseif (Get-Command wget -ErrorAction SilentlyContinue) {
        & wget -q -O $tmpTar $downloadUrl
    } else {
        Write-Error "Neither curl nor wget is available. Install one and retry."
        exit 1
    }
} catch {
    Write-Error "Download failed: $_"
    exit 1
}

if (-not (Test-Path $tmpTar) -or (Get-Item $tmpTar).Length -lt 1MB) {
    Write-Error "Downloaded file is missing or too small."
    exit 1
}

Write-Host "Extracting..."
if (Test-Path $tmpExtract) { Remove-Item -Recurse -Force $tmpExtract }
New-Item -ItemType Directory -Path $tmpExtract -Force | Out-Null
# tar.xz extraction
if (Get-Command tar -ErrorAction SilentlyContinue) {
    & tar -xf $tmpTar -C $tmpExtract --strip-components=1
} else {
    Write-Error "tar command not available."
    exit 1
}

$nodeBin = Join-Path $tmpExtract "bin/node"
if (-not (Test-Path $nodeBin)) {
    Write-Error "node binary not found in extracted archive."
    exit 1
}

Write-Host "Installing sidecar to: $sidecarPath"
Copy-Item -Path $nodeBin -Destination $sidecarPath -Force
& chmod +x $sidecarPath 2>$null

# Cleanup
Remove-Item -Recurse -Force $tmpExtract
Remove-Item -Force $tmpTar

# Verify
$version = & $sidecarPath --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK — installed: $sidecarPath ($version)"
} else {
    Write-Warning "Installed but could not execute: $sidecarPath"
}

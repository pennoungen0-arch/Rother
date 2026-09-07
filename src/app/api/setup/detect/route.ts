import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import {
  GBP_ROOT,
  GBP_LISTINGS_PATH,
  GBP_SELECTORS_PATH,
} from "@/lib/gbp/paths";

export const dynamic = "force-dynamic";

interface PythonCheck {
  available: boolean;
  executable: string | null;
  version: string | null;
  versionNum: number | null;
}

interface PackagesCheck {
  allInstalled: boolean;
  missing: string[];
  checked: string[];
}

interface ChromiumCheck {
  available: boolean;
  message: string;
}

interface DetectResult {
  python: PythonCheck;
  packages: PackagesCheck;
  chromium: ChromiumCheck;
  config: {
    listings: boolean;
    selectors: boolean;
    requirements: boolean;
  };
  gbpRoot: string;
}

function findPython(): { executable: string; version: string } | null {
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const result = spawnSync(/*turbopackIgnore: true*/ cmd, ["--version"], {
        encoding: "utf-8",
        timeout: 5_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.error || result.status !== 0) continue;
      const version = (result.stdout || result.stderr || "").trim();
      if (version) return { executable: cmd, version };
    } catch {
      continue;
    }
  }
  return null;
}

function checkPython(): PythonCheck {
  const found = findPython();
  if (!found) {
    return { available: false, executable: null, version: null, versionNum: null };
  }

  let versionNum: number | null = null;
  const match = found.version.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
  if (match) {
    versionNum = parseInt(match[1], 10) * 10000 + parseInt(match[2], 10) * 100 + parseInt(match[3], 10);
  }

  return {
    available: true,
    executable: found.executable,
    version: found.version,
    versionNum,
  };
}

function checkPackages(python: string): PackagesCheck {
  const required = ["playwright", "parsel", "requests"];
  const missing: string[] = [];

  for (const pkg of required) {
    try {
      const result = spawnSync(/*turbopackIgnore: true*/ python, ["-c", `import ${pkg}; print("${pkg} ok")`], {
        encoding: "utf-8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.error || result.status !== 0) {
        missing.push(pkg);
      }
    } catch {
      missing.push(pkg);
    }
  }

  return {
    allInstalled: missing.length === 0,
    missing,
    checked: required,
  };
}

function checkChromium(python: string | null): ChromiumCheck {
  if (!python) {
    return { available: false, message: "Python not found — cannot check Chromium" };
  }
  // Check if the Playwright browsers directory exists and contains a chromium build.
  // Platform-specific cache locations:
  // - Windows: %LOCALAPPDATA%\ms-playwright
  // - macOS: ~/Library/Caches/ms-playwright
  // - Linux: ~/.cache/ms-playwright
  const playwrightBrowsersPath =
    process.platform === "win32"
      ? join(process.env.LOCALAPPDATA || "", "ms-playwright")
      : process.platform === "darwin"
      ? join(process.env.HOME || "", "Library", "Caches", "ms-playwright")
      : join(process.env.HOME || "", ".cache", "ms-playwright");
  if (existsSync(playwrightBrowsersPath)) {
    try {
      const entries: Dirent[] = readdirSync(playwrightBrowsersPath, { withFileTypes: true });
      const hasChromium = entries.some((e) => e.isDirectory() && e.name.toLowerCase().includes("chromium"));
      if (hasChromium) {
        return { available: true, message: "Chromium ready" };
      }
    } catch {
      // fall through to subprocess check
    }
  }
  // Fallback: try launching chromium to verify it actually works
  try {
    const result = spawnSync(
      /*turbopackIgnore: true*/ python,
      ["-c", "from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(); b.close(); p.stop(); print('chromium ok')"],
      {
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.status === 0 && (result.stdout || "").includes("chromium ok")) {
      return { available: true, message: "Chromium ready" };
    }
    return { available: false, message: "Chromium not installed — run Setup › Install Playwright Chromium" };
  } catch (e) {
    return { available: false, message: `Check failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function GET() {
  const python = checkPython();
  const packages = python.available
    ? checkPackages(python.executable!)
    : { allInstalled: false, missing: ["playwright", "parsel", "requests"], checked: ["playwright", "parsel", "requests"] };
  const chromium = checkChromium(python.available ? python.executable : null);

  const requirementsPath = join(GBP_ROOT, "requirements.txt");

  const result: DetectResult = {
    python,
    packages,
    chromium,
    config: {
      listings: existsSync(GBP_LISTINGS_PATH),
      selectors: existsSync(GBP_SELECTORS_PATH),
      requirements: existsSync(requirementsPath),
    },
    gbpRoot: GBP_ROOT,
  };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

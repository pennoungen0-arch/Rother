import { spawn, spawnSync, execSync, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  GBP_ROOT,
  GBP_DATA_DIR,
  GBP_LISTINGS_PATH,
  businessDataDir,
} from "./paths";
import { readActiveBusiness, readJsonFile, writeEffectiveListings } from "./server-data";
import type { CategoryScanResponse, RunSummary } from "./types";
import { sanitizeErrorMessage } from "./sanitize";

const _IS_WIN = process.platform === "win32";

/** Terminate a process and its entire child process tree.
 *
 * On Windows: uses `taskkill /T /F` to kill the entire process tree
 * (ensures Playwright/Chromium children are terminated).
 *
 * On POSIX: sends SIGTERM first, then SIGKILL after a grace period
 * if the process is still alive.
 */
function killProcessTree(proc: ChildProcess): void {
  if (!proc.pid) return;
  if (_IS_WIN) {
    try {
      execSync(`taskkill /T /F /PID ${proc.pid}`, {
        stdio: "ignore",
        timeout: 5_000,
      });
    } catch {
      // Process may have already exited — ignore
    }
  } else {
    proc.kill("SIGTERM");
    // Give the process a grace period to exit gracefully, then force kill.
    const graceTimer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Already exited
      }
    }, 5_000);
    // Clear the grace timer if the process exits on its own.
    proc.once("close", () => clearTimeout(graceTimer));
  }
}

export interface RunStatus {
  runId: string;
  status: "starting" | "running" | "completed" | "failed";
  mode: "fixtures" | "live";
  progress: { completed: number; total: number; label: string };
  elapsed: number;
  logTail: string[];
  summary?: RunSummary;
  error?: string;
  stderr?: string;
}

interface ActiveRun {
  proc: ChildProcess;
  mode: "fixtures" | "live";
  startedAt: number;
  status: "running" | "completed" | "failed";
  stdoutBuf: string[];
  stderrBuf: string[];
  totalCompetitors: number;
  summary?: RunSummary;
  error?: string;
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
      if (result.error) continue;
      if (result.status !== 0) continue;
      const version = (result.stdout || result.stderr || "").trim();
      if (version) return { executable: cmd, version };
    } catch {
      continue;
    }
  }
  return null;
}

async function countCompetitors(): Promise<number> {
  try {
    const buf = await fs.readFile(GBP_LISTINGS_PATH, "utf-8");
    const data = JSON.parse(buf) as {
      branches?: { competitors: unknown[] }[];
      businesses?: { branches?: { competitors: unknown[] }[] }[];
    };
    const branches = data.businesses?.[0]?.branches ?? data.branches ?? [];
    let total = 0;
    for (const branch of branches) {
      total += (branch.competitors ?? []).length;
    }
    return total || 1;
  } catch {
    return 1;
  }
}

/**
 * Parse JSONLOG lines from the Python scraper's stdout to extract progress.
 * The orchestrator emits lines like:
 *   JSONLOG: {"stage":"listing_result","progress":"3/12",...}
 */
interface JsonlogLine {
  stage?: string;
  progress?: string;
  [key: string]: unknown;
}

function parseJsonlog(line: string): JsonlogLine | null {
  const idx = line.indexOf("JSONLOG: ");
  if (idx === -1) return null;
  const json = line.slice(idx + "JSONLOG: ".length);
  try {
    return JSON.parse(json) as JsonlogLine;
  } catch {
    return null;
  }
}

/**
 * Scan both stdout and stderr for JSONLOG listing_result lines.
 * The Python logger writes JSONLOG to stderr (StreamHandler → sys.stderr),
 * so both buffers must be checked.
 */
function extractProgress(lines: string[]): {
  completed: number;
  total: number;
} {
  for (const line of [...lines].reverse()) {
    const parsed = parseJsonlog(line);
    if (
      (parsed?.stage === "listing_result" ||
        parsed?.stage === "collection_progress") &&
      parsed.progress
    ) {
      const parts = parsed.progress.split("/");
      if (parts.length === 2) {
        const completed = parseInt(parts[0], 10);
        const total = parseInt(parts[1], 10);
        if (!isNaN(completed) && !isNaN(total) && total > 0) {
          return { completed, total };
        }
      }
    }
  }
  return { completed: 0, total: 0 };
}

const PROCESS_TIMEOUT_MS = parseInt(
  process.env.SCRAPER_TIMEOUT_MS ?? "600000",
  10,
);

/**
 * Sanitize user-supplied competitor ids before they reach the Python CLI.
 * Mirrors the orchestrator's own `_VALID_COMPETITOR_ID_RE` (alphanumeric,
 * hyphen, underscore; ≤64 chars) so a malicious id can never smuggle shell
 * semantics into the spawned argv. Invalid entries are dropped, not fatal —
 * an empty result simply means "no filter".
 */
function sanitizeCompetitorIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      seen.add(id);
    }
  }
  return [...seen];
}

/**
 * P1 / RISK-024 — run a category discovery scan and return the parsed result.
 *
 * Spawns `python -m orchestration.run_all --category-scan ...`, waits for the
 * process to finish (the Python side writes `<data-dir>/category_scan/
 * latest.json`), then reads that file. Scoped to the active business's data
 * dir via `ROTHER_DATA_DIR`, consistent with the scrape runner.
 *
 * `mode` selects the acquisition path:
 *   - "fixtures" (default) — read tests/fixtures HTML, no browser/network.
 *   - "cached"   — replay the raw HTML from the last live run (offline).
 *   - "live"     — launch headless Chromium against Google Maps.
 * `fixtures` is retained for backward compatibility (an explicit `mode` wins).
 */
export async function runCategoryScan(input: {
  category: string;
  location?: string;
  fixtures?: boolean;
  mode?: "fixtures" | "cached" | "live";
  businessId?: string;
}): Promise<CategoryScanResponse> {
  const python = findPython();
  if (!python) {
    throw new Error("No Python executable found. Tried: python3, python.");
  }

  const mode: "fixtures" | "cached" | "live" =
    input.mode ?? (input.fixtures ? "fixtures" : "live");

  const id = input.businessId;
  const dataDir = id ? businessDataDir(id) : GBP_DATA_DIR;

  const args = [
    "-m",
    "orchestration.run_all",
    "--category-scan",
    "--category",
    input.category,
  ];
  if (input.location) args.push("--location", input.location);
  if (mode === "fixtures") args.push("--fixtures");
  else if (mode === "cached") args.push("--cached");

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(/*turbopackIgnore: true*/ python.executable, args, {
      cwd: GBP_ROOT,
      env: { ...process.env, ROTHER_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (c: Buffer) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Category scan exited with code ${code}: ${stderr.slice(-1000)}`));
    });
  });

  const scanDir = path.join(dataDir, "category_scan");
  const latest = await readJsonFile<string | null>(
    path.join(scanDir, "latest.json"),
    null,
  );
  if (!latest) {
    throw new Error("Category scan produced no output file.");
  }
  const result = await readJsonFile<CategoryScanResponse | null>(
    path.join(scanDir, latest),
    null,
  );
  if (!result) {
    throw new Error("Category scan output could not be read.");
  }
  return result;
}

const MAX_STDOUT_LINES = 10_000;
const MAX_STDERR_LINES = 5_000;

class ScrapeRunManager {
  private runs = new Map<string, ActiveRun>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private starting = false;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  hasActiveRun(): boolean {
    return this.getActiveRunId() !== null;
  }

  /**
   * Return the runId of the currently-active scrape, or null if none.
   * Also performs the liveness check (marks dead processes as failed).
   * Used by `/api/scrape/status?active=1` so the persistent TopBar
   * indicator can show per-competitor progress across navigations
   * and after server restarts (see TAURI_AUDIT_2026-09-06 R2).
   */
  getActiveRunId(): string | null {
    for (const [runId, run] of this.runs) {
      if (run.status === "running") {
        // Verify the process is actually alive — a killed/orphaned process
        // leaves status stuck at "running" and blocks all future triggers.
        if (run.proc.pid && this._isPidAlive(run.proc.pid)) {
          return runId;
        }
        // Process is dead but close handler didn't fire — mark as failed.
        run.status = "failed";
        run.error = "Process terminated unexpectedly";
      }
    }
    return null;
  }

  /** Check if a PID is still alive (cross-platform). */
  private _isPidAlive(pid: number): boolean {
    try {
      // process.kill(pid, 0) throws if the process does not exist
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Force-stop a running run by runId. Returns true if a run was stopped. */
  stopRun(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.status !== "running") return false;
    killProcessTree(run.proc);
    run.status = "failed";
    run.error = "Stopped by user";
    return true;
  }

  /** Force-stop ALL running runs (used by the "stop" API endpoint). */
  stopAllRuns(): number {
    let stopped = 0;
    for (const [runId] of this.runs) {
      if (this.stopRun(runId)) stopped++;
    }
    return stopped;
  }

  /** Start a scrape run. Returns the runId, or null if a run is already active. */
  async start(
    mode: "fixtures" | "live",
    competitorIds?: string[],
  ): Promise<string | null> {
    if (this.hasActiveRun() || this.starting) return null;
    this.starting = true;
    try {
      return await this.startInner(mode, competitorIds);
    } finally {
      this.starting = false;
    }
  }

  private async startInner(
    mode: "fixtures" | "live",
    competitorIds?: string[],
  ): Promise<string> {
    const python = findPython();
    if (!python) {
      throw new Error("No Python executable found. Tried: python3, python.");
    }

    const runId = randomUUID().slice(0, 8);

    // P2 / RISK-024 — tenant scoping: point the orchestrator at the active
    // business's data dir so its snapshots/deltas/run_summary are isolated.
    const active = await readActiveBusiness();
    const dataDir = active?.id
      ? businessDataDir(active.id)
      : GBP_DATA_DIR;

    // P0-2 Fix B — discovery scrapes the USER'S competitors: materialize the
    // active business's branches into effective_listings.json and point
    // Python at it via ROTHER_LISTINGS_PATH. No active business (fixed mode)
    // keeps the legacy root config/listings.json behavior.
    let noCompetitors = false;
    let effectivePath: string | null = null;
    let effectiveTotal = 0;
    if (active) {
      const effective = await writeEffectiveListings(active.id);
      if (effective) {
        effectivePath = effective.path;
        effectiveTotal = effective.totalCompetitors;
      } else {
        // Active business exists but has zero configured competitors — an
        // empty run would be dishonest; caller maps this to a friendly 422.
        noCompetitors = true;
      }
    }

    const env = {
      ...process.env,
      ROTHER_DATA_DIR: dataDir,
      ...(effectivePath ? { ROTHER_LISTINGS_PATH: effectivePath } : {}),
    };

    // The Python orchestrator reads business config from:
    // - Fixed mode: config/listings.json (via ROTHER_DATA_DIR)
    // - Discovery mode: config/user-business.json (via ROTHER_DATA_DIR)
    // No CLI args needed for business config.
    // NOTE: GBP_MONITOR_STORAGE_STATE / GBP_MONITOR_COOKIES_FILE env vars
    // are NOT currently read by the Python orchestrator — all scrapes
    // share the global data/storage_state.json (see TAURI_AUDIT_2026-09-06 R1).
    const args = ["-m", "orchestration.run_all"];
    if (mode !== "live") {
      args.push("--fixtures");
    }

    // Phase C partial-run: per-competitor Refresh passes ids through to the
    // orchestrator's `--competitors` filter (Python-side sanitization too).
    const filteredIds = sanitizeCompetitorIds(competitorIds);
    if (filteredIds.length > 0) {
      args.push("--competitors", filteredIds.join(","));
    }

    // P0-2 Fix B guard — an active business with zero configured competitors
    // would produce a dishonest empty run; refuse before spawning.
    if (noCompetitors && filteredIds.length === 0) {
      throw new Error("NO_COMPETITORS_CONFIGURED");
    }

    const configTotal = await countCompetitors();
    // Progress denominator priority: partial-run filter > tenant effective
    // listings > legacy root config count.
    const baseTotal = effectivePath ? effectiveTotal : configTotal;
    const totalCompetitors =
      filteredIds.length > 0
        ? Math.min(filteredIds.length, baseTotal)
        : baseTotal;

    const proc = spawn(/*turbopackIgnore: true*/ python.executable, args, {
      cwd: GBP_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const activeRun: ActiveRun = {
      proc,
      mode,
      startedAt: Date.now(),
      status: "running",
      stdoutBuf: [],
      stderrBuf: [],
      totalCompetitors,
    };

    proc.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      activeRun.stdoutBuf.push(...lines);
      if (activeRun.stdoutBuf.length > MAX_STDOUT_LINES) {
        activeRun.stdoutBuf = activeRun.stdoutBuf.slice(-MAX_STDOUT_LINES);
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      activeRun.stderrBuf.push(...lines);
      if (activeRun.stderrBuf.length > MAX_STDERR_LINES) {
        activeRun.stderrBuf = activeRun.stderrBuf.slice(-MAX_STDERR_LINES);
      }
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        activeRun.status = "failed";
        activeRun.error = `Python exited with code ${code}`;
        return;
      }
      try {
        // The orchestrator writes run_summary.json to its scoped data dir
        // (ROTHER_DATA_DIR), which matches `dataDir` computed above.
        const summaryJson = await fs.readFile(
          path.join(dataDir, "run_summary.json"),
          "utf-8",
        );
        activeRun.summary = JSON.parse(summaryJson) as RunSummary;
        activeRun.status = "completed";
      } catch (err) {
        activeRun.status = "failed";
        activeRun.error = sanitizeErrorMessage(
          err instanceof Error ? err.message : String(err),
        );
      }
    });

    proc.on("error", (err) => {
      activeRun.status = "failed";
      activeRun.error = err.message;
    });

    const timeout = setTimeout(() => {
      if (activeRun.status === "running") {
        activeRun.status = "failed";
        activeRun.error = `Process timed out after ${PROCESS_TIMEOUT_MS / 1000}s`;
        killProcessTree(proc);
      }
    }, PROCESS_TIMEOUT_MS);

    proc.on("close", () => {
      clearTimeout(timeout);
    });

    this.runs.set(runId, activeRun);
    return runId;
  }

  async getStatus(runId: string): Promise<RunStatus | null> {
    const run = this.runs.get(runId);
    if (!run) return null;

    const allLines = [...run.stdoutBuf, ...run.stderrBuf];
    const { completed, total } = extractProgress(allLines);

    return {
      runId,
      status: run.status,
      mode: run.mode,
      progress: {
        completed,
        total: Math.max(total, run.totalCompetitors),
        label: `${completed} / ${Math.max(total, run.totalCompetitors)}`,
      },
      elapsed: Date.now() - run.startedAt,
      logTail: run.stderrBuf.slice(-50),
      summary: run.summary,
      error: run.error,
      stderr: run.stderrBuf.join("\n").slice(-2000),
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [runId, run] of this.runs.entries()) {
      // Kill processes that have been running too long
      if (run.status === "running" && now - run.startedAt > PROCESS_TIMEOUT_MS * 2) {
        killProcessTree(run.proc);
        run.status = "failed";
        run.error = `Process killed by cleanup after ${PROCESS_TIMEOUT_MS * 2 / 1000}s`;
      }
      // Remove old completed/failed entries
      if (
        (run.status === "completed" || run.status === "failed") &&
        now - run.startedAt > 300_000
      ) {
        this.runs.delete(runId);
      }
    }
  }

  destroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const [, run] of this.runs) {
      if (run.status === "running") {
        killProcessTree(run.proc);
      }
    }
    this.runs.clear();
  }
}

export const scrapeRunManager = new ScrapeRunManager();

// Graceful shutdown: clean up child processes on SIGTERM/SIGINT.
// Guard against serverless environments where process.on may not be available.
if (typeof process !== "undefined" && typeof process.on === "function") {
  const shutdown = () => {
    scrapeRunManager.destroy();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

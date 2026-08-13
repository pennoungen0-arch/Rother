import { spawn, spawnSync, execSync, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  GBP_ROOT,
  GBP_LISTINGS_PATH,
  GBP_RUN_SUMMARY_PATH,
} from "./paths";
import type { RunSummary } from "./types";
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
      const result = spawnSync(cmd, ["--version"], {
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
    const data = JSON.parse(buf) as { branches: { competitors: unknown[] }[] };
    let total = 0;
    for (const branch of data.branches ?? []) {
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
    if (parsed?.stage === "listing_result" && parsed.progress) {
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
    for (const [, run] of this.runs) {
      if (run.status === "running") return true;
    }
    return false;
  }

  /** Start a scrape run. Returns the runId, or null if a run is already active. */
  async start(mode: "fixtures" | "live"): Promise<string | null> {
    if (this.hasActiveRun() || this.starting) return null;
    this.starting = true;
    try {
      return await this.startInner(mode);
    } finally {
      this.starting = false;
    }
  }

  private async startInner(mode: "fixtures" | "live"): Promise<string> {
    const python = findPython();
    if (!python) {
      throw new Error("No Python executable found. Tried: python3, python.");
    }

    const runId = randomUUID().slice(0, 8);

    const args =
      mode === "live"
        ? ["-m", "orchestration.run_all"]
        : ["-m", "orchestration.run_all", "--fixtures"];

    const totalCompetitors = await countCompetitors();

    const proc = spawn(python.executable, args, {
      cwd: GBP_ROOT,
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
        const summaryJson = await fs.readFile(GBP_RUN_SUMMARY_PATH, "utf-8");
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

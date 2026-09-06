"use client";

import * as React from "react";
import { Loader2, Play, Radar, CheckCircle2, XCircle, ScrollText, ChevronDown, ChevronUp, AlertTriangle, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { toast } from "sonner";

/** P3-U7: Map error strings to actionable recovery guidance. */
const ERROR_GUIDANCE: { pattern: RegExp; title: string; message: string; command?: string }[] = [
  {
    pattern: /no python|python.*not found|tried.*python3.*python/i,
    title: "Python not found",
    message: "Install Python 3.10+ and ensure it is on your PATH.",
    command: "winget install Python.Python.3.12",
  },
  {
    pattern: /no.*competitors|NO_COMPETITORS_CONFIGURED/i,
    title: "No competitors configured",
    message: "Add at least one competitor in Config before running a scrape.",
  },
  {
    pattern: /timed? ?out|timeout/i,
    title: "Scrape timed out",
    message: "The scraper took too long. Check your internet connection and try again. If the problem persists, Google may be rate-limiting.",
  },
  {
    pattern: /reduced variant|REDUCED/i,
    title: "Google serving reduced data",
    message: "Google detected automated access and is serving limited data. Wait 10–15 minutes, then try again.",
  },
  {
    pattern: /browser.*launch|chromium.*not installed|playwright/i,
    title: "Browser not available",
    message: "Playwright Chromium is not installed. Run the Setup Wizard to install it.",
    command: "playwright install chromium",
  },
  {
    pattern: /network|ECONNREFUSED|DNS|ENOTFOUND/i,
    title: "Network error",
    message: "Could not reach Google Maps. Check your internet connection and try again.",
  },
  {
    pattern: /429|rate.?limit/i,
    title: "Rate limited",
    message: "Too many requests. Wait 5–10 minutes before trying again.",
  },
];

function ErrorGuidanceCard({ error }: { error: string }) {
  const [copied, setCopied] = React.useState(false);
  const match = ERROR_GUIDANCE.find((g) => g.pattern.test(error));
  if (!match) return null;

  const handleCopy = () => {
    if (match.command) {
      navigator.clipboard.writeText(match.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-left space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{match.title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{match.message}</p>
      {match.command && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <code className="flex-1 text-xs font-mono text-foreground">{match.command}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy command"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

interface ScrapeProgress {
  completed: number;
  total: number;
  currentCompetitor?: string;
  currentReviews?: number;
  status: "starting" | "running" | "completed" | "failed";
  newReviews?: number;
  totalReviews?: number;
  failed?: number;
  error?: string;
}

function parseJsonlog(line: string): Record<string, unknown> | null {
  const idx = line.indexOf("JSONLOG: ");
  if (idx === -1) return null;
  try {
    return JSON.parse(line.slice(idx + "JSONLOG: ".length));
  } catch {
    return null;
  }
}

function extractProgressFromLogs(logLines: string[]): ScrapeProgress | null {
  let progress: ScrapeProgress | null = null;
  for (const line of [...logLines].reverse()) {
    const parsed = parseJsonlog(line);
    if (!parsed) continue;
    if (
      (parsed.stage === "listing_result" || parsed.stage === "collection_progress") &&
      typeof parsed.progress === "string"
    ) {
      const parts = parsed.progress.split("/");
      if (parts.length === 2) {
        const completed = parseInt(parts[0], 10);
        const total = parseInt(parts[1], 10);
        if (!isNaN(completed) && !isNaN(total)) {
          if (!progress) progress = { completed, total, status: "running" };
          else { progress.completed = completed; progress.total = total; }
        }
      }
    }
    if (parsed.stage === "listing_start" && typeof parsed.competitor === "string") {
      if (!progress) progress = { completed: 0, total: 0, status: "running" };
      progress.currentCompetitor = parsed.competitor;
    }
    if (parsed.stage === "listing_done") {
      if (!progress) progress = { completed: 0, total: 0, status: "running" };
      if (typeof parsed.competitor === "string") progress.currentCompetitor = parsed.competitor;
      if (typeof parsed.reviews === "number") progress.currentReviews = parsed.reviews;
    }
  }
  return progress;
}

/**
 * The Run gate. Shown before the hubs are revealed.
 *
 * Honors the no-page-scroll contract: a single, centered, one-viewport screen.
 * - Fixed mode (v1): triggers a live scrape of the configured competitor list
 *   via POST /api/scrape/trigger with NO business body (so no `user-business.json`
 *   is written and the fixed list remains the active dataset).
 * - Discovery mode (v2): triggers a live scrape of the user's own business.
 *
 * Pressing Run shows a scanning state and — regardless of success or failure —
 * reveals the hubs (which then show the data or empty states). A scrape failure
 * must NEVER block navigation.
 */
export function RunScreen() {
  const { business, mode, startRun } = useAppState();
  const [scanning, setScanning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<ScrapeProgress | null>(null);
  const [logLines, setLogLines] = React.useState<string[]>([]);
  const [showLogs, setShowLogs] = React.useState(false);
  const [completionSummary, setCompletionSummary] = React.useState<{
    success: number; failed: number; skipped: number; newReviews: number; totalReviews: number;
  } | null>(null);
  const [busyElsewhere, setBusyElsewhere] = React.useState(false);

  const targetName =
    mode === "fixed" ? "your competitor list" : business?.name ?? "your business";

  // Probe for an already-active run on mount + every 5s while visible.
  React.useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const r = await fetch("/api/scrape/status?active=1");
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setBusyElsewhere(Boolean(d.active));
      } catch {
        // ignore probe errors
      }
    };
    void probe();
    const t = setInterval(probe, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Background status poller: shows progress + completion toast AFTER the
  // hubs are revealed. Never blocks navigation (design contract).
  const watchRef = React.useRef<((id: string) => Promise<void>) | null>(null);
  const watchStatus = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/scrape/status?runId=${id}`);
      if (!res.ok) return;
      const data = await res.json();

      // Parse log lines for per-competitor progress
      const logTail: string[] = data.logTail ?? [];
      setLogLines(logTail.slice(-10));

      const parsed = extractProgressFromLogs(logTail);
      if (parsed) {
        setProgress(prev => ({
          ...prev,
          ...parsed,
          status: data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : "running",
        }));
      } else if (data.progress?.total > 0) {
        setProgress({
          completed: data.progress.completed,
          total: data.progress.total,
          status: data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : "running",
        });
      }

      if (data.status === "completed") {
        setScanning(false);
        const summary = data.summary;
        if (summary) {
          setCompletionSummary({
            success: summary.success ?? 0,
            failed: summary.failed ?? 0,
            skipped: summary.skipped ?? 0,
            newReviews: summary.new_reviews ?? 0,
            totalReviews: summary.total_reviews ?? 0,
          });
        }
        const newReviews = summary?.new_reviews ?? 0;
        toast.success("Scrape completed", {
          description: newReviews > 0 ? `Found ${newReviews} new reviews` : "No new reviews found",
        });
      } else if (data.status === "failed") {
        setScanning(false);
        setProgress(prev => prev ? { ...prev, status: "failed", error: data.error } : null);
        toast.error("Scrape failed", { description: data.error ?? "Unknown error" });
      } else if (data.status === "running") {
        setTimeout(() => watchRef.current?.(id), 3000);
      }
    } catch {
      // ignore polling errors
    }
  }, []);
  React.useEffect(() => {
    watchRef.current = watchStatus;
  }, [watchStatus]);

  const handleRun = React.useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setCompletionSummary(null);
    setProgress(null);
    setLogLines([]);
    setStatus("Starting live scan…");
    let triggered = false;
    try {
      const body =
        mode === "fixed"
          ? {}
          : {
              name: business?.name,
              location: business?.location,
              category: business?.category,
              categoryId: business?.categoryId,
            };
      const res = await fetch("/api/scrape/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 409) {
          setBusyElsewhere(true);
          setStatus("A scrape is already running — new data will appear when it completes.");
          toast.info("A scrape is already running", {
            description: "Watch the dashboard — data will refresh when it finishes.",
          });
        } else {
          setStatus(
            data?.error
              ? `Scrape could not start: ${data.error}`
              : "Scrape could not start — showing empty states.",
          );
        }
      } else {
        const data = await res.json();
        triggered = true;
        if (data.runId) {
          setStatus("Scraping in the background — you can explore while it runs.");
          setTimeout(() => watchStatus(data.runId), 3000);
        }
      }
    } catch {
      setStatus("Network error reaching the scraper — showing empty states.");
    } finally {
      startRun();
    }
    void triggered;
  }, [mode, business, scanning, startRun, watchStatus]);

  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Radar className="size-7" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Start monitoring {targetName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll run a live scan of{" "}
          <span className="font-medium">{targetName}</span>
          {mode === "discovery" && business?.location
            ? ` in ${business.location}`
            : ""}
          , then open your dashboard.
        </p>

        <div className="mt-7 space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={handleRun}
            disabled={scanning || busyElsewhere}
          >
            {busyElsewhere && !scanning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Scrape already running…
              </>
            ) : scanning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Play className="size-4" />
                Run
              </>
            )}
          </Button>

          {busyElsewhere && !scanning && (
            <p className="text-xs text-muted-foreground">
              A scrape is already running in this or another session — you can
              explore the dashboard meanwhile; data appears when it finishes.
            </p>
          )}

          {/* P3-U1: Live scrape progress with per-competitor detail */}
          {scanning && progress && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    {progress.currentCompetitor
                      ? `Scraping ${progress.currentCompetitor}`
                      : "Preparing…"}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progress.completed}/{progress.total}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {progress.currentReviews !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {progress.currentReviews} reviews harvested from {progress.currentCompetitor}
                </p>
              )}

              {status && (
                <p className="text-xs text-muted-foreground">{status}</p>
              )}

              {/* Mini log viewer */}
              {logLines.length > 0 && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowLogs(!showLogs)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ScrollText className="size-3" />
                    {showLogs ? "Hide" : "Show"} scraper logs
                    {showLogs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                  {showLogs && (
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-muted/50 p-2">
                      <pre className="text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {logLines.filter(l => !l.includes("JSONLOG")).slice(-5).join("\n")}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Simple status when scanning but no progress yet */}
          {scanning && !progress && status && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-muted-foreground">{status}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-1/4 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
          )}

          {/* P3-U1: Completion summary card */}
          {completionSummary && !scanning && (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-left space-y-3">
              <div className="flex items-center gap-2">
                {completionSummary.failed > 0 ? (
                  <XCircle className="size-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                )}
                <span className="text-sm font-semibold">
                  {completionSummary.failed > 0 ? "Scrape completed with errors" : "Scrape completed"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold tabular-nums">{completionSummary.success}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Succeeded</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold tabular-nums text-amber-600">{completionSummary.newReviews}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">New</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold tabular-nums">{completionSummary.totalReviews}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
                </div>
              </div>
              {completionSummary.failed > 0 && (
                <p className="text-xs text-amber-600">
                  {completionSummary.failed} competitor(s) failed — check run logs for details.
                </p>
              )}
            </div>
          )}

          {!scanning && status && !completionSummary && (
            <p className="mt-4 text-xs text-muted-foreground">{status}</p>
          )}

          {/* P3-U7: Error recovery guidance */}
          {!scanning && progress?.error && (
            <ErrorGuidanceCard error={progress.error} />
          )}
          {!scanning && status && !progress?.error && (
            <ErrorGuidanceCard error={status} />
          )}
        </div>
      </div>
    </div>
  );
}

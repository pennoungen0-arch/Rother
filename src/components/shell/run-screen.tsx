"use client";

import * as React from "react";
import { Loader2, Play, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { toast } from "sonner";

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
  const [progress, setProgress] = React.useState<{ completed: number; total: number } | null>(null);
  // P1-4 Fix C: a scrape may be in flight from another tab/session — offer
  // an honest running state instead of a Run click that dead-ends in a 409.
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
      if (data.progress?.total > 0) {
        setProgress({ completed: data.progress.completed, total: data.progress.total });
      }
      if (data.status === "completed") {
        setScanning(false);
        const newReviews = data.summary?.new_reviews ?? 0;
        toast.success("Scrape completed", {
          description: newReviews > 0 ? `Found ${newReviews} new reviews` : "No new reviews found",
        });
      } else if (data.status === "failed") {
        setScanning(false);
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
          // Concurrent run — friendly copy + reflect the active state.
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
          // Fire-and-forget watcher: progress bar + completion toast
          setTimeout(() => watchStatus(data.runId), 3000);
        }
      }
    } catch {
      setStatus("Network error reaching the scraper — showing empty states.");
    } finally {
      // Reveal the hubs whether the scrape succeeded or failed. Features will
      // show the scraped data if any, or explicit empty states.
      startRun();
    }
    void triggered;
  }, [mode, business, scanning, startRun, watchStatus]);

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

          {scanning && (
            <div className="space-y-3 text-sm">
              {status && <p className="text-muted-foreground">{status}</p>}
              {progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress.completed} / {progress.total}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scraped {progress.completed} of {progress.total} competitors
                  </p>
                </div>
              )}
            </div>
          )}

          {!scanning && status && (
            <p className="mt-4 text-xs text-muted-foreground">{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
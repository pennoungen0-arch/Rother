"use client";

import * as React from "react";
import { Loader2, ToggleLeft, ToggleRight, Play, Calendar, CheckCircle, AlertCircle, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isVercel } from "@/lib/vercel";

interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  nextRun: string | null;
  lastRun: string | null;
  lastRunStatus: "success" | "failed" | null;
}

export default function SchedulerFeature() {
  // On Vercel, show a message that this feature is not available
  if (isVercel()) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
            <Calendar className="size-4" />
            Scheduler
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            The Scheduler feature manages automatic scraping schedules by writing to
            a local <code>schedule.json</code> file and triggering local Python
            scrapes — neither works on Vercel's read-only serverless platform.
          </p>

          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <span>GitHub Actions Cron</span>
                <span className="ml-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border border-emerald-500/40 bg-emerald-500/10 rounded">
                  Active
                </span>
              </div>
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                Scraping runs automatically every day at 02:00 UTC (06:00 WITA).
              </p>
            </div>

            <a
              href="https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary underline hover:no-underline"
            >
              Trigger manual scrape on GitHub Actions →
            </a>
          </div>
        </div>
      </div>
    );
  }

  const [config, setConfig] = React.useState<ScheduleConfig>({
    enabled: false,
    intervalHours: 24,
    nextRun: null,
    lastRun: null,
    lastRunStatus: null,
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule", { cache: "no-store" });
      if (res.ok) setConfig(await res.json());
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load triggers setConfig
    load();
  }, [load]);

  const save = async (patch: Partial<ScheduleConfig>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) setConfig(await res.json());
      else setStatus("Failed to save schedule");
    } catch {
      setStatus("Network error saving schedule");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setStatus("Triggering scrape…");
    try {
      const res = await fetch("/api/scrape/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setStatus("Failed to trigger scrape");
        setRunning(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.runId) {
        setRunId(data.runId);
        setStatus("Scraping in progress…");
        const poll = async () => {
          try {
            const sr = await fetch(`/api/scrape/status?runId=${data.runId}`);
            if (!sr.ok) return;
            const sd = await sr.json();
            if (sd.progress?.total > 0) {
              setStatus(`Scraping… ${sd.progress.completed}/${sd.progress.total} competitors`);
            }
            if (sd.status === "completed") {
              setRunning(false);
              setRunId(null);
              const newReviews = sd.summary?.new_reviews ?? 0;
              toast.success("Scrape completed", {
                description: newReviews > 0 ? `Found ${newReviews} new reviews` : "No new reviews found",
              });
              setStatus("Scrape completed");
              setTimeout(load, 2000);
              return;
            }
            if (sd.status === "failed") {
              setRunning(false);
              setRunId(null);
              toast.error("Scrape failed", { description: sd.error ?? "Unknown error" });
              setStatus("Scrape failed");
              return;
            }
            setTimeout(poll, 3000);
          } catch {
            // ignore poll errors
          }
        };
        setTimeout(poll, 3000);
      } else {
        setStatus("Scrape triggered — check status page for progress");
        setRunning(false);
        setTimeout(load, 2000);
      }
    } catch {
      setStatus("Network error triggering scrape");
      setRunning(false);
    }
  };

  const stopRun = async () => {
    if (!runId) return;
    try {
      await fetch(`/api/scrape/stop?runId=${runId}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    setRunning(false);
    setRunId(null);
    setStatus("Scrape stopped.");
  };

  const formatISO = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const intervals = [
    { value: 6, label: "Every 6 hours" },
    { value: 12, label: "Every 12 hours" },
    { value: 24, label: "Every 24 hours" },
    { value: 48, label: "Every 48 hours" },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
            <Calendar className="size-4" />
            Scheduler
          </div>
          <p className="text-sm text-muted-foreground">Loading schedule config…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
          <Calendar className="size-4" />
          Scheduler
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Automatic scraping</p>
              <p className="text-xs text-muted-foreground">
                Run scrapes on a recurring interval. Requires <code>python -m orchestration.run_all --schedule</code> in cron.
              </p>
            </div>
            <Button
              variant={config.enabled ? "default" : "outline"}
              onClick={() => save({ enabled: !config.enabled })}
              disabled={saving}
            >
              {config.enabled ? (
                <>
                  <ToggleRight className="size-4 mr-2" />
                  Enabled
                </>
              ) : (
                <>
                  <ToggleLeft className="size-4 mr-2" />
                  Disabled
                </>
              )}
            </Button>
          </div>

          {config.enabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium w-36">Interval</label>
                <Select
                  value={String(config.intervalHours)}
                  onValueChange={(v) => save({ intervalHours: Number(v) })}
                  disabled={saving}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervals.map((i) => (
                      <SelectItem key={i.value} value={String(i.value)}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">Next run</p>
                  <p className="font-medium">{formatISO(config.nextRun)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">Last run</p>
                  <p className="font-medium">{formatISO(config.lastRun)}</p>
                </div>
              </div>

              {config.lastRunStatus && (
                <div className="flex items-center gap-2 text-sm">
                  {config.lastRunStatus === "success" ? (
                    <>
                      <CheckCircle className="size-4 text-green-500" />
                      <span className="text-green-500">Last run succeeded</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4 text-red-500" />
                      <span className="text-red-500">Last run failed</span>
                    </>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={runNow}
                disabled={running || saving}
              >
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-2" />
                    Run now
                  </>
                )}
              </Button>
              {running && runId && (
                <Button
                  className="mt-2 w-full"
                  onClick={stopRun}
                  variant="destructive"
                >
                  <Square className="size-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>
          )}

          {status && (
            <p className="text-center text-xs text-muted-foreground">{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import * as React from "react";
import Image from "next/image";
import { LogOut, Search, UserCircle2, LayoutGrid, RefreshCw, Square, Loader2 } from "lucide-react";

import { useAppState } from "@/lib/app-state";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LoginScreen } from "./login-screen";
import { Onboarding } from "./onboarding";
import { RunScreen } from "./run-screen";
import { Hub } from "./hub";
import { SectionView } from "./section-view";
import { CommandPalette } from "./command-palette";
import TodayFeature from "@/features/today";

/** P3-UI: Persistent scrape status — polled at the TopBar level so every
 *  screen (hubs, sections, today) sees the same "scraping in progress"
 *  indicator regardless of where the user navigates after triggering. */
interface ScrapeState {
  active: boolean;
  runId: string | null;
  completed: number;
  total: number;
  currentCompetitor: string | null;
}

function useScrapeStatus(): {
  state: ScrapeState;
  start: (body: Record<string, unknown>) => Promise<string | null>;
  stop: () => Promise<void>;
} {
  const [state, setState] = React.useState<ScrapeState>({
    active: false, runId: null, completed: 0, total: 0, currentCompetitor: null,
  });

  const poll = React.useCallback(async () => {
    try {
      const r = await fetch("/api/scrape/status?active=1");
      if (!r.ok) return;
      const d = await r.json();
      if (!d.active) {
        setState((s) => (s.active ? { active: false, runId: null, completed: 0, total: 0, currentCompetitor: null } : s));
        return;
      }
    } catch {
      return;
    }
    if (!state.runId) {
      // Need the active runId to poll detail; fetch list of runs.
      try {
        const r = await fetch("/api/scrape/status");
        if (r.ok) {
          const d = await r.json();
          if (d.runId && d.status === "running") {
            setState((s) => ({ ...s, runId: d.runId, active: true }));
          }
        }
      } catch {}
      return;
    }
    try {
      const r = await fetch(`/api/scrape/status?runId=${state.runId}`);
      if (!r.ok) return;
      const d = await r.json();
      const logTail: string[] = d.logTail ?? [];
      let currentCompetitor: string | null = null;
      let completed = 0;
      let total = 0;
      for (let i = logTail.length - 1; i >= 0; i--) {
        const line = logTail[i];
        const idx = line.indexOf("JSONLOG: ");
        if (idx === -1) continue;
        try {
          const parsed = JSON.parse(line.slice(idx + "JSONLOG: ".length));
          if ((parsed.stage === "listing_result" || parsed.stage === "collection_progress") && typeof parsed.progress === "string") {
            const parts = parsed.progress.split("/");
            if (parts.length === 2) {
              completed = parseInt(parts[0], 10) || 0;
              total = parseInt(parts[1], 10) || 0;
            }
          }
          if (parsed.stage === "listing_start" && typeof parsed.competitor === "string") {
            currentCompetitor = parsed.competitor;
          }
        } catch {}
      }
      if (d.progress?.total > 0) {
        completed = d.progress.completed;
        total = d.progress.total;
      }
      if (d.status === "completed" || d.status === "failed") {
        setState({ active: false, runId: null, completed: 0, total: 0, currentCompetitor: null });
      } else {
        setState((s) => ({ ...s, active: true, completed, total, currentCompetitor }));
      }
    } catch {}
  }, [state.runId]);

  // Poll every 3s while there's an active run.
  React.useEffect(() => {
    void poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);

  const start = React.useCallback(async (body: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await fetch("/api/scrape/trigger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Failed to start scrape");
        return null;
      }
      const data = await res.json();
      if (data.runId) {
        setState((s) => ({ ...s, active: true, runId: data.runId, completed: 0, total: 0, currentCompetitor: null }));
      }
      return data.runId ?? null;
    } catch {
      toast.error("Network error");
      return null;
    }
  }, []);

  const stop = React.useCallback(async () => {
    if (!state.runId) return;
    try {
      await fetch(`/api/scrape/stop?runId=${state.runId}`, { method: "DELETE" });
    } catch {}
    setState({ active: false, runId: null, completed: 0, total: 0, currentCompetitor: null });
    toast.info("Scrape stopped");
  }, [state.runId]);

  return { state, start, stop };
}

function TopBar({ onShowHubs }: { onShowHubs: () => void }) {
  const { user, business, mode, logout, setPaletteOpen } = useAppState();
  const scrape = useScrapeStatus();
  const targetLabel =
    mode === "fixed" ? "Competitor list" : business?.name ?? user?.email ?? "";

  const runScrape = async () => {
    if (scrape.state.active) return;
    const body = mode === "fixed" ? {} : {
      name: business?.name,
      location: business?.location,
      category: business?.category,
      categoryId: business?.categoryId,
    };
    await scrape.start(body);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg viewBox="0 0 32 32" className="size-4" aria-hidden="true">
              <path
                d="M9 22V10h4.2c3 0 5 1.7 5 4.6 0 2.9-2 4.6-5 4.6H12V22h-3zm3.2-7.1h.9c1.3 0 2.1-.7 2.1-2s-.8-2-2.1-2h-.9v4zm8.1 7.1V10h3v12h-3z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="font-semibold tracking-tight">Rother</span>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-2 hidden h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
        >
          <Search className="size-4" />
          <span>Search features…</span>
          <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onShowHubs}
          aria-label="Show all hubs"
        >
          <LayoutGrid className="size-3.5" />
          <span className="hidden sm:inline">Hubs</span>
        </Button>

        {/* P3-UI: Persistent scraping indicator — visible at all times when active */}
        {scrape.state.active && (
          <button
            type="button"
            onClick={scrape.stop}
            className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            aria-label="Scrape in progress — click to stop"
            title={scrape.state.currentCompetitor
              ? `Scraping ${scrape.state.currentCompetitor} (${scrape.state.completed}/${scrape.state.total}) — click to stop`
              : `Scraping in progress (${scrape.state.completed}/${scrape.state.total}) — click to stop`}
          >
            <Loader2 className="size-3 animate-spin" />
            <span className="hidden sm:inline">
              {scrape.state.currentCompetitor
                ? `Scraping ${scrape.state.currentCompetitor}`
                : "Scraping…"}
            </span>
            {scrape.state.total > 0 && (
              <span className="tabular-nums text-primary/70">
                {scrape.state.completed}/{scrape.state.total}
              </span>
            )}
            <Square className="size-2.5 fill-current" />
          </button>
        )}

        {!scrape.state.active && (
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={runScrape}
            aria-label="Refresh data"
          >
            <RefreshCw className="size-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search features"
          >
            <Search className="size-4" />
          </Button>
          {user && (
            <div className="flex items-center gap-2">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name ?? "User avatar"}
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 rounded-full border border-border"
                />
              ) : (
                <UserCircle2 className="size-8 text-muted-foreground" />
              )}
              <span className="hidden max-w-[12rem] truncate text-sm md:inline">
                {targetLabel}
              </span>
              {/* S6 provenance (SYSTEMS_FIX_PLAN Phase D): in fixed mode the
                  monitored list IS the seeded demo set — say so explicitly
                  instead of silently masking (server mirrors this via the
                  configSource field on /api/overview + /api/branches). */}
              {mode === "fixed" && (
                <span
                  className="hidden rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 lg:inline"
                  title="Fixed mode monitors the seeded demo competitor list. Switch to Discovery mode to monitor your own business."
                >
                  Demo dataset
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const { user, business, mode, runStarted, hub, feature, showHubs, showToday, setHub, setFeature, setShowHubs, setShowToday } = useAppState();

  if (!user) return <LoginScreen />;
  if (mode === "discovery" && !business) return <Onboarding />;
  if (!runStarted) return <RunScreen />;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopBar onShowHubs={() => { setHub(null); setFeature(null); setShowToday(false); }} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {hub || feature ? (
            <SectionView />
          ) : showToday ? (
            <TodayFeature />
          ) : (
            <Hub />
          )}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import { LogOut, Search, UserCircle2 } from "lucide-react";

import { useAppState } from "@/lib/app-state";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import { LoginScreen } from "./login-screen";
import { Onboarding } from "./onboarding";
import { RunScreen } from "./run-screen";
import { Hub } from "./hub";
import { SectionView } from "./section-view";
import { CommandPalette } from "./command-palette";

function TopBar() {
  const { user, business, mode, logout, setPaletteOpen } = useAppState();
  const targetLabel =
    mode === "fixed" ? "Competitor list" : business?.name ?? user?.email ?? "";
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
  const { user, business, mode, runStarted, hub } = useAppState();

  if (!user) return <LoginScreen />;
  // Discovery mode requires onboarding the user's own business first. In
  // fixed-list mode (v1) there is nothing to onboard — the configured
  // competitor list from listings.json is the target.
  if (mode === "discovery" && !business) return <Onboarding />;
  // Run gate: the 4 hub icons stay hidden until the user has triggered a
  // scrape. In fixed mode this scans the configured competitor list; in
  // discovery mode it scans the user's own business.
  if (!runStarted) return <RunScreen />;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopBar />
      <main className="flex-1">{hub ? <SectionView /> : <Hub />}</main>
      <CommandPalette />
    </div>
  );
}

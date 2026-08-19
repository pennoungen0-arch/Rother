"use client";

import * as React from "react";
import { Loader2, RefreshCw, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { getCategory } from "@/lib/categories";

/**
 * Tools › Config.
 * - Fixed mode (v1): shows the configured competitor list (branch/competitor
 *   counts) and a "Run scan again" that re-scrapes the fixed list.
 * - Discovery mode (v2): shows the user's own selected business (never the
 *   seeded Copenhagen Bali demo) and a "Run scan again" affordance.
 */
export default function ConfigFeature() {
  const { business, mode, startRun } = useAppState();
  const [scanning, setScanning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [listings, setListings] = React.useState<
    { branch_id: string; branch_name: string; competitor_count: number }[] | null
  >(null);

  const category = getCategory(business?.categoryId);

  React.useEffect(() => {
    if (mode !== "fixed") return;
    let active = true;
    fetch("/api/config/listings")
      .then((r) => r.json())
      .then((data: { branches?: { branch_id: string; branch_name: string; competitors: unknown[] }[] }) => {
        if (!active) return;
        setListings(
          (data.branches ?? []).map((b) => ({
            branch_id: b.branch_id,
            branch_name: b.branch_name,
            competitor_count: b.competitors?.length ?? 0,
          })),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mode]);

  const runAgain = React.useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setStatus(mode === "fixed" ? "Re-running live scrape of competitor list…" : "Re-running live scrape…");
    try {
      const res = await fetch("/api/scrape/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          mode === "fixed"
            ? JSON.stringify({})
            : JSON.stringify({
                name: business?.name,
                location: business?.location,
                category: business?.category,
                categoryId: business?.categoryId,
              }),
      });
      setStatus(res.ok ? "Scan queued — refreshing your data." : "Could not start scan.");
    } catch {
      setStatus("Network error — try again.");
    } finally {
      setScanning(false);
      startRun();
    }
  }, [mode, business, scanning, startRun]);

  if (mode === "fixed") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
            <Store className="size-4" />
            Competitor list
          </div>

          {!listings ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No branches configured.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {listings.map((b) => (
                <li
                  key={b.branch_id}
                  className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0"
                >
                  <span className="font-medium">{b.branch_name}</span>
                  <span className="text-muted-foreground">
                    {b.competitor_count} competitor{b.competitor_count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button
            className="mt-6 w-full"
            onClick={runAgain}
            disabled={scanning}
            variant="outline"
          >
            {scanning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Run scan again
              </>
            )}
          </Button>
          {status && (
            <p className="mt-3 text-center text-xs text-muted-foreground">{status}</p>
          )}
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        No business selected yet.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
          <Store className="size-4" />
          Your business
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Name" value={business.name} />
          <Row label="Location" value={business.location || "—"} />
          <Row label="Category" value={category?.label ?? business.category ?? "—"} />
        </dl>

        <Button
          className="mt-6 w-full"
          onClick={runAgain}
          disabled={scanning}
          variant="outline"
        >
          {scanning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Run scan again
            </>
          )}
        </Button>
        {status && (
          <p className="mt-3 text-center text-xs text-muted-foreground">{status}</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

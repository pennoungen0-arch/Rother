"use client";

import * as React from "react";
import { Loader2, RefreshCw, Store, Plus, Trash2, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { getCategory } from "@/lib/categories";
import type { BranchConfig, CompetitorConfig } from "@/lib/gbp/types";
import SchedulerFeature from "./t-scheduler";
import { toast } from "sonner";

/**
 * Tools › Config.
 * - Fixed mode (v1): shows the configured competitor list (branch/competitor
 *   counts) and a "Run scan again" that re-scrapes the fixed list.
 * - Discovery mode (v2): shows the user's own selected business with competitor
 *   management (add/edit/remove competitors via Google Maps links).
 */
export default function ConfigFeature() {
  const { business, mode, startRun } = useAppState();
  const [scanning, setScanning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [listings, setListings] = React.useState<
    { branch_id: string; branch_name: string; competitor_count: number }[] | null
  >(null);
  // Discovery mode state
  const [branches, setBranches] = React.useState<BranchConfig[]>([]);
  const [competitorInput, setCompetitorInput] = React.useState("");
  const [addingCompetitor, setAddingCompetitor] = React.useState(false);

  const category = getCategory(business?.categoryId);

  // Load data based on mode
  React.useEffect(() => {
    let active = true;
    if (mode === "fixed") {
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
    } else {
      // Discovery mode: load active business branches (with competitors)
      fetch("/api/business/branches")
        .then((r) => r.json())
        .then((data: { branches?: BranchConfig[] }) => {
          if (!active) return;
          setBranches(data.branches ?? []);
        })
        .catch(() => {});
    }
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

  // Discovery mode: add competitor to all branches
  const addCompetitor = React.useCallback(async () => {
    if (!competitorInput.trim() || addingCompetitor) return;
    setAddingCompetitor(true);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(competitorInput.trim())}`);
      const data = await res.json();
      if (data.places?.length > 0) {
        const place = data.places[0];
        const compId = place.name
          ? place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
          : "competitor";
        const newCompetitor: CompetitorConfig = {
          competitor_id: compId,
          name: place.name ?? competitorInput.trim(),
          gmaps_url: competitorInput.trim(),
          place_id: place.place_id?.startsWith("gmaps/") ? place.place_id.slice(6) : null,
          gmaps_place_id: place.place_id?.startsWith("gmaps/") ? place.place_id.slice(6) : null,
          osm_place_id: place.place_id?.startsWith("coord/") || place.place_id?.startsWith("osm/") ? place.place_id : null,
          lat: place.lat,
          lng: place.lng,
          category: place.category,
          verified: place.provider === "gmaps",
        };
        // Dedupe FIRST (before any state update): never add the same
        // competitor_id twice.
        if (branches.some((b) => (b.competitors ?? []).some((c) => c.competitor_id === compId))) {
          toast.info("Already added", { description: `${place.name ?? "Competitor"} is already in your list` });
          setCompetitorInput("");
          return;
        }
        // Persist updated branches. NOTE: compute the next state from the
        // current `branches` value — passing a state-updater FUNCTION into
        // JSON.stringify silently serializes to `{}` (functions are
        // omitted), which 400s on the server and persists nothing. The
        // optimistic setBranches must use the SAME `next` as the POST.
        const next = branches.map((b) => ({
          ...b,
          competitors: [...(b.competitors ?? []), newCompetitor],
        }));
        setBranches(next);
        await fetch("/api/business/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branches: next }),
        });
        setCompetitorInput("");
        toast.success("Competitor added", { description: place.name ?? "Added to monitoring list" });
      } else {
        toast.error("Could not resolve link", { description: "Try a different Google Maps link" });
      }
    } catch {
      toast.error("Failed to add competitor", { description: "Network error" });
    } finally {
      setAddingCompetitor(false);
    }
  }, [competitorInput, addingCompetitor, branches]);

  const removeCompetitor = React.useCallback(async (competitorId: string) => {
    // Same fix as addCompetitor: serialize DATA, not a state-updater function.
    const next = branches.map((b) => ({
      ...b,
      competitors: (b.competitors ?? []).filter((c) => c.competitor_id !== competitorId),
    }));
    setBranches(next);
    await fetch("/api/business/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branches: next }),
    });
    toast.success("Competitor removed", { description: "Removed from monitoring list" });
  }, [branches]);

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

      {/* Discovery mode: Competitor management */}
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
          <Link2 className="size-4" />
          Competitors
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://maps.app.goo.gl/... or https://maps.google.com/place/..."
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && competitorInput.trim() && addCompetitor()}
              disabled={addingCompetitor}
              aria-label="Competitor Google Maps link"
            />
            <Button
              type="button"
              onClick={() => competitorInput.trim() && addCompetitor()}
              disabled={!competitorInput.trim() || addingCompetitor}
            >
              {addingCompetitor ? (
                <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
              ) : (
                <>
                  <Plus className="size-4 mr-2" />
                  Add
                </>
              )}
            </Button>
          </div>

          {branches.flatMap((b) => b.competitors ?? []).length > 0 && (
            <ul className="space-y-2">
              {branches.flatMap((b) => b.competitors ?? []).map((c) => (
                <li key={c.competitor_id} className="flex items-center justify-between gap-2 p-2 border border-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.gmaps_url}</p>
                    {c.verified && <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Verified</span>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCompetitor(c.competitor_id)}
                    aria-label="Remove competitor"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {branches.flatMap((b) => b.competitors ?? []).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No competitors added yet. Add your first competitor above.
            </p>
          )}
        </div>
      </div>

      {/* Discovery mode: Scheduler */}
      <SchedulerFeature />
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

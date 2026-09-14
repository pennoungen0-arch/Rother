"use client";

import * as React from "react";
import { Activity, ArrowLeft, Bell, BarChart3, Building2, ChevronDown, ChevronRight, Clock, ExternalLink, Loader2, MapPin, MessageSquare, Settings2, Star, Store, Trophy, TrendingUp } from "lucide-react";

import { KpiRow } from "@/components/dashboard/kpi-row";
import { AlertsSection } from "@/components/dashboard/alerts-section";
import { SnapshotGlance } from "@/components/dashboard/snapshot-glance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { RatingDistributionChart } from "@/components/dashboard/charts/rating-distribution";
import { useOverview } from "@/lib/gbp/use-overview";
import { useAppState } from "@/lib/app-state";
import { FEATURES } from "@/lib/features";
import { useBranches } from "@/lib/gbp/use-branches";
import { isVercel } from "@/lib/vercel";

const QUICK_LINKS = [
  { id: "i-kpis", label: "KPIs", icon: BarChart3 },
  { id: "i-rating-distribution", label: "Rating Distribution", icon: Star },
  { id: "r-reviews", label: "All Reviews", icon: MessageSquare },
  { id: "r-alerts", label: "Alerts", icon: Bell },
  { id: "c-leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "t-config", label: "Config", icon: Settings2 },
  { id: "t-scrape-schedule", label: "Schedule", icon: Activity },
];

/** Expandable card showing branch/competitor details when clicked. */
function ExpandableMetricCard({
  icon: Icon,
  label,
  count,
  unit,
  items,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  unit: string;
  items: { name: string; detail?: string }[];
  accent: "primary" | "teal";
}) {
  const [expanded, setExpanded] = React.useState(false);

  const accentClasses = accent === "primary"
    ? "from-primary/15 to-primary/5 text-primary"
    : "from-teal-500/15 to-teal-500/5 text-teal-600 dark:text-teal-400";

  return (
    <Card className="gbp-card-hover relative overflow-hidden py-0">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-start justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30"
          aria-expanded={expanded}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {count}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {count === 1 ? unit : unit + "s"} — click to {expanded ? "hide" : "see details"}
            </span>
          </div>
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accentClasses}`}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
        </button>

        {expanded && items.length > 0 && (
          <div className="border-t border-border/60 px-5 pb-4 pt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {accent === "primary" ? (
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <Store className="size-3.5 shrink-0 text-teal-600" />
                )}
                <span className="font-medium text-foreground">{item.name}</span>
                {item.detail && (
                  <span className="text-xs text-muted-foreground">— {item.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {expanded && items.length === 0 && (
          <div className="border-t border-border/60 px-5 pb-4 pt-3">
            <p className="text-xs text-muted-foreground italic">
              No {label.toLowerCase()} configured yet. Add them in Config.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * First-run / startup banner: shown on the Today screen when no scrape data
 * exists yet. Detects an active background scrape by polling the status API
 * and shows a non-blocking progress banner so users know data is arriving.
 */
function StartupBanner() {
  const onVercel = isVercel();

  // On Vercel, the scrape status API doesn't work — show a simple info card
  // pointing to GitHub Actions instead.
  if (onVercel) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Activity className="size-4 text-primary" />
          <div className="text-sm flex-1">
            <span className="font-medium text-primary">Web version (Vercel)</span>
            <span className="text-muted-foreground"> — scraping runs on GitHub Actions every day at 02:00 UTC.</span>
            <a
              href="https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-primary underline"
            >
              View workflow <ExternalLink className="size-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  const [active, setActive] = React.useState<null | {
    runId: string; progress?: { completed: number; total: number }
  }>(null);

  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch("/api/scrape/status?active=1");
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (d.active && d.runId) {
          setActive({ runId: d.runId, progress: d.progress ?? undefined });
        } else {
          setActive(null);
        }
      } catch {
        // ignore
      }
    };
    check();
    const id = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!active) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="size-4 text-amber-600 animate-spin" />
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-300">First run detected</span>
            <span className="text-muted-foreground"> — your businesses are being configured. Run a scrape to start monitoring.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const p = active.progress;
  const completed = p?.completed ?? 0;
  const total = p?.total ?? 0;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 text-primary animate-spin" />
          <div className="text-sm">
            <span className="font-medium text-primary">Scraping in progress</span>
            {total > 0 && (
              <span className="ml-1 text-muted-foreground">
                — {completed}/{total} businesses processed
              </span>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, (completed / total) * 100)}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {total > 0 && completed > 0
            ? `${total - completed} business${total - completed === 1 ? "" : "es"} remaining — reviews will appear as each completes.`
            : "Initialising scraper — reviews will appear shortly."}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * P3-U5: Last scrape summary card — shows when the last scrape happened,
 * how many competitors succeeded, total reviews, and new alerts.
 */
function LastScrapeSummary({
  summary,
  onOpenHistory,
}: {
  summary: { started_at?: string; success?: number; failed?: number; skipped?: number; new_reviews?: number; total_reviews?: number };
  onOpenHistory: () => void;
}) {
  const [relative, setRelative] = React.useState<string>("");

  React.useEffect(() => {
    if (!summary.started_at) return;
    const update = () => {
      const diff = Date.now() - new Date(summary.started_at!).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) setRelative("just now");
      else if (mins < 60) setRelative(`${mins}m ago`);
      else if (mins < 1440) setRelative(`${Math.floor(mins / 60)}h ago`);
      else setRelative(`${Math.floor(mins / 1440)}d ago`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [summary.started_at]);

  if (!summary.started_at) return null;

  const hasErrors = (summary.failed ?? 0) > 0;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5"
      onClick={onOpenHistory}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenHistory(); } }}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${hasErrors ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
          <Clock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Last scrape</span>
            <span className="text-xs text-muted-foreground">{relative}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {(summary.success ?? 0)} competitor{(summary.success ?? 0) === 1 ? "" : "s"} scraped
            {(summary.new_reviews ?? 0) > 0 && (
              <span className="font-medium text-amber-600"> · {summary.new_reviews} new alert{(summary.new_reviews ?? 0) === 1 ? "" : "s"}</span>
            )}
            {hasErrors && (
              <span className="font-medium text-amber-600"> · {summary.failed} failed</span>
            )}
          </p>
        </div>
        <TrendingUp className="size-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function TodayFeature() {
  const { data, loading } = useOverview();
  const { data: branches } = useBranches();
  const { openFeature, back } = useAppState();

  const hasData = (data?.totalReviews ?? 0) > 0;
  const googleCount = data?.competitorStats[0]?.google_review_count;
  const harvestStatus = data?.competitorStats[0]?.harvest_status;

  // Build branch/competitor items for expandable cards
  const branchItems = (branches?.branches ?? []).map((b) => ({
    name: b.branch_name,
    detail: `${b.competitors.length} competitor${b.competitors.length === 1 ? "" : "s"}`,
  }));
  const competitorItems = (branches?.branches ?? []).flatMap((b) =>
    b.competitors.map((c) => ({
      name: c.name,
      detail: b.branch_name,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 bg-background/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
              <p className="text-sm text-muted-foreground">
                Your monitoring snapshot at a glance
              </p>
            </div>
          </div>
          {harvestStatus && harvestStatus !== "full" && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              title={`Google reports ${googleCount ?? "unknown"} total reviews. Rother captured a ${harvestStatus} window.`}
            >
              <TrendingUp className="size-3" />
              Partial window
            </Badge>
          )}
        </div>
      </div>

      {/* Vercel: Prominent scraping status banner — always visible */}
      {isVercel() && data?.runSummary && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Activity className="size-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Scraping is running automatically</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Last scrape: {data.runSummary.finished_at
                  ? new Date(data.runSummary.finished_at).toLocaleString()
                  : "Never"}
                {" · "}
                {data.runSummary.success ?? 0} competitors scraped
                {(data.runSummary.new_reviews ?? 0) > 0 && (
                  <span className="font-medium text-amber-600"> · {data.runSummary.new_reviews} new reviews</span>
                )}
                {" · "}
                Next run: tomorrow 02:00 UTC
              </p>
            </div>
            <a
              href="https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              View on GitHub <ExternalLink className="size-3" />
            </a>
          </CardContent>
        </Card>
      )}

        {/* Quick navigation — moved from footer to header */}
        {hasData && (
          <div className="flex flex-wrap gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              const feature = FEATURES.find((f) => f.id === link.id);
              if (!feature) return null;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => openFeature(link.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon className="size-3.5 text-primary" />
                  {link.label}
                </button>
              );
            })}
          </div>
        )}

        {/* First-run / startup indicator: show when no data exists yet */}
        {!loading && !hasData && <StartupBanner />}

        {loading && !data ? (
          <div className="space-y-6">
            <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
          </div>
        ) : !hasData ? (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            description="Run your first scrape to populate the Today dashboard."
          />
        ) : (
        <>
          {/* Expandable Branches + Competitors cards */}
          <div className="grid grid-cols-2 gap-4">
            <ExpandableMetricCard
              icon={Building2}
              label="Branches"
              count={data?.totalBranches ?? 0}
              unit="location"
              items={branchItems}
              accent="primary"
            />
            <ExpandableMetricCard
              icon={Store}
              label="Competitors"
              count={data?.totalCompetitors ?? 0}
              unit="competitor"
              items={competitorItems}
              accent="teal"
            />
          </div>

          <KpiRow />

          {/* P3-U5: Last scrape summary */}
          {data?.runSummary && (
            <LastScrapeSummary summary={data.runSummary} onOpenHistory={() => openFeature("r-run-history")} />
          )}

          {googleCount && (
            <p className="text-xs text-muted-foreground">
              of ~{googleCount} on Google
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="size-4 text-primary" />
                  Alerts
                </CardTitle>
                <CardDescription>Recent notifications and warnings</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertsSection />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-primary" />
                  Rating Distribution
                </CardTitle>
                <CardDescription>Star ratings across all reviews</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.ratingDistribution &&
                data.ratingDistribution.length > 0 ? (
                  <RatingDistributionChart data={data.ratingDistribution} />
                ) : (
                  <EmptyState
                    icon={Star}
                    title="No ratings"
                    description="No rating data available."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <SnapshotGlance />
        </>
      )}
    </div>
  );
}

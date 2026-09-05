"use client";

import * as React from "react";
import { Activity, ArrowLeft, Bell, BarChart3, Loader2, MessageSquare, Settings2, Star, Trophy, TrendingUp } from "lucide-react";

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

const QUICK_LINKS = [
  { id: "i-kpis", label: "KPIs", icon: BarChart3 },
  { id: "i-rating-distribution", label: "Rating Distribution", icon: Star },
  { id: "r-reviews", label: "All Reviews", icon: MessageSquare },
  { id: "r-alerts", label: "Alerts", icon: Bell },
  { id: "c-leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "t-config", label: "Config", icon: Settings2 },
  { id: "t-scrape-schedule", label: "Schedule", icon: Activity },
];

/**
 * First-run / startup banner: shown on the Today screen when no scrape data
 * exists yet. Detects an active background scrape by polling the status API
 * and shows a non-blocking progress banner so users know data is arriving.
 */
function StartupBanner() {
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

export default function TodayFeature() {
  const { data, loading } = useOverview();
  const { openFeature, back } = useAppState();

  const hasData = (data?.totalReviews ?? 0) > 0;
  const googleCount = data?.competitorStats[0]?.google_review_count;
  const harvestStatus = data?.competitorStats[0]?.harvest_status;

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
          <KpiRow />

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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick navigation</CardTitle>
              <CardDescription>Jump to a feature</CardDescription>
            </CardHeader>
            <CardContent>
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
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Icon className="size-4 text-primary" />
                      {link.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

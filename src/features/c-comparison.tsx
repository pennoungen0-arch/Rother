"use client";

import * as React from "react";
import { Radar, BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompetitorRadarChart } from "@/components/dashboard/charts/radar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/lib/gbp/use-overview";
import { StarRating } from "@/components/dashboard/star-rating";
import type { CompetitorStats } from "@/lib/gbp/types";

const TrendIcon = ({ dir }: { dir: "up" | "down" | "stable" | null }) => {
  if (!dir || dir === "stable") return <Minus className="size-3 text-muted-foreground" />;
  return dir === "up"
    ? <TrendingUp className="size-3 text-emerald-500" />
    : <TrendingDown className="size-3 text-destructive" />;
};

export default function ComparisonFeature() {
  const { data, loading } = useOverview();
  const has = (data?.competitorStats.length ?? 0) > 0;
  const [view, setView] = React.useState<"radar" | "table">("radar");

  return (
    <Card className="gbp-card-hover">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="size-4 text-primary" /> Competitor Comparison
            </CardTitle>
            <CardDescription>
              {view === "radar"
                ? "Top 3 competitors compared across normalized dimensions (0–100)."
                : "Side-by-side comparison across all monitored competitors."}
            </CardDescription>
          </div>
          <div className="flex gap-1 rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setView("radar")}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "radar"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={view === "radar"}
            >
              <Radar className="size-3.5 inline mr-1" />
              Radar
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={view === "table"}
            >
              <BarChart3 className="size-3.5 inline mr-1" />
              Table
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <Skeleton className={view === "radar" ? "h-[320px]" : "h-[200px]"} />
        ) : has && data ? (
          view === "radar" ? (
            <CompetitorRadarChart
              data={data.competitorStats as CompetitorStats[]}
              topN={3}
            />
          ) : (
            <ComparisonTable data={data.competitorStats as CompetitorStats[]} />
          )
        ) : (
          <EmptyState
            icon={Radar}
            title="No competitor data yet"
            description="Run the scraper to populate competitor comparison."
            className="h-[320px]"
          />
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ data }: { data: CompetitorStats[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Business</th>
            <th className="px-3 py-2 font-medium text-right">Reviews</th>
            <th className="px-3 py-2 font-medium text-center">Rating</th>
            <th className="px-3 py-2 font-medium text-right">New</th>
            <th className="px-3 py-2 font-medium text-center">Trend</th>
            <th className="px-3 py-2 font-medium text-center">Hours</th>
            <th className="px-3 py-2 font-medium text-left">Category</th>
            <th className="px-3 py-2 font-medium text-left">Branch</th>
          </tr>
        </thead>
        <tbody>
          {data.map((comp) => (
            <tr
              key={comp.competitor_id}
              className={`border-b border-border/40 last:border-0 ${
                comp.self ? "bg-primary/5" : ""
              }`}
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {comp.name}
                {comp.self && (
                  <Badge variant="outline" className="ml-1.5 text-[9px] uppercase px-1 py-0 border-primary/40 text-primary">
                    You
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {comp.total_reviews.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-center">
                <div className="inline-flex items-center gap-1">
                  <StarRating rating={comp.average_rating} size="sm" />
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                {comp.new_reviews_count > 0 ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 px-1 py-0">
                    +{comp.new_reviews_count}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                <TrendIcon dir={comp.trend_indicator ?? null} />
              </td>
              <td className="px-3 py-2 text-center text-xs">
                {comp.hours_status ? (
                  <span className="font-medium text-foreground">{comp.hours_status}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {comp.category ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">{comp.branch_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

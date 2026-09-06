"use client";

import * as React from "react";
import { Building2, Store, FileText, TrendingUp, Clock, Info } from "lucide-react";

import { KpiCard } from "./kpi-card";
import { useOverview } from "@/lib/gbp/use-overview";
import { formatTimestamp } from "@/lib/gbp/format";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export function KpiRow() {
  const { data, loading } = useOverview();

  if (loading && !data) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const ts = formatTimestamp(
    data.runSummary?.finished_at ?? data.runSummary?.started_at,
  );

  const branchNames = data.newReviewsPerBranch.map((b) => b.branch_name).join(", ") || "none configured";
  const competitorNames = data.competitorStats.map((c) => c.name).join(", ") || "none configured";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Branches Monitored"
        value={data.totalBranches}
        icon={Building2}
        accent="primary"
        hint={
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-help">
                <Info className="size-3" />
                {data.totalBranches === 1 ? "location" : "locations"} tracked
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold mb-1">Branches</p>
              <p className="text-[11px] leading-relaxed">
                Branches are your business locations (e.g., &quot;Crate Cafe Canggu&quot;). Each branch has its own set of competitors and reviews. Currently monitoring: {branchNames}.
              </p>
            </TooltipContent>
          </Tooltip>
        }
      />
      <KpiCard
        label="Competitors Tracked"
        value={data.totalCompetitors}
        icon={Store}
        accent="teal"
        hint={
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-help">
                <Info className="size-3" />
                across all branches
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold mb-1">Competitors</p>
              <p className="text-[11px] leading-relaxed">
                Competitors are rival businesses you monitor alongside your own. Their reviews, ratings, and trends are tracked per branch. Currently tracking: {competitorNames}.
              </p>
            </TooltipContent>
          </Tooltip>
        }
      />
      <KpiCard
        label="Reviews Collected"
        value={data.totalReviews}
        icon={FileText}
        accent="primary"
        hint="Across all snapshots"
      />
      <KpiCard
        label="New Alerts (Latest)"
        value={`+${data.newReviewsLastRun}`}
        icon={TrendingUp}
        accent="amber"
        hint="From latest update"
      />
      <KpiCard
        label="Last Scrape Run"
        value={
          <span className="text-base font-bold leading-tight">{ts.relative}</span>
        }
        icon={Clock}
        accent="teal"
        hint={<span className="font-mono text-[10px]">{ts.absolute}</span>}
      />
    </div>
  );
}

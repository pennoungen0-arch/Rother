"use client";

import * as React from "react";
import { CalendarDays, TrendingUp } from "lucide-react";

import { ReviewsOverTimeCard } from "@/components/dashboard/reviews-over-time-card";
import { ReviewRecencyHeatmap } from "@/components/dashboard/review-recency-heatmap";

type ViewMode = "timeline" | "heatmap";

export default function ReviewsOverTimeFeature() {
  const [view, setView] = React.useState<ViewMode>("timeline");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reviews over Time</h1>
          <p className="text-sm text-muted-foreground">
            Review count trend and activity heatmap
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setView("timeline")}
            className={
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors " +
              (view === "timeline"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={view === "timeline"}
          >
            <TrendingUp className="size-3.5" />
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setView("heatmap")}
            className={
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors " +
              (view === "heatmap"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={view === "heatmap"}
          >
            <CalendarDays className="size-3.5" />
            Heatmap
          </button>
        </div>
      </div>

      {view === "timeline" ? (
        <ReviewsOverTimeCard refreshKey={0} />
      ) : (
        <ReviewRecencyHeatmap refreshKey={0} />
      )}
    </div>
  );
}

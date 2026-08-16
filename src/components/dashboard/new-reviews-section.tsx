"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Heart, MessageSquarePlus, RefreshCw, Store, User } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { EmptyState } from "./empty-state";
import { StarRating } from "./star-rating";
import { cleanReviewerName, formatTimestamp } from "@/lib/gbp/format";
import type { NewReviewsResponse, Review } from "@/lib/gbp/types";

interface NewReviewsSectionProps {
  refreshKey?: number;
}

/**
 * "New Reviews" tab: surfaces the actual content of every review newly
 * captured per delta run (not just counts). Grouped newest-run-first, with a
 * per-run selector and competitor badges.
 */
export function NewReviewsSection({ refreshKey }: NewReviewsSectionProps) {
  const [data, setData] = React.useState<NewReviewsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [runTs, setRunTs] = React.useState<string>("latest");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/new-reviews", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as NewReviewsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData, refreshKey]);

  const selectedRun = React.useMemo(() => {
    if (!data || data.runs.length === 0) return null;
    if (runTs === "latest") return data.runs[0];
    return data.runs.find((r) => r.run_timestamp === runTs) ?? data.runs[0];
  }, [data, runTs]);

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading new reviews">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={MessageSquarePlus}
        title="Couldn't load new reviews"
        description={error}
        action={
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  if (!data || data.runs.length === 0) {
    return (
      <EmptyState
        icon={MessageSquarePlus}
        title="No new reviews yet"
        description="Run a scrape to capture new reviews. Every delta run will appear here with the full review content."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <MessageSquarePlus className="size-5 text-primary" aria-hidden="true" />
              New Reviews
            </CardTitle>
            <CardDescription>
              The actual review content captured in each delta run.
            </CardDescription>
          </div>
          <Select value={runTs} onValueChange={setRunTs}>
            <SelectTrigger className="w-64" aria-label="Select delta run">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest run</SelectItem>
              {data.runs.map((r) => (
                <SelectItem key={r.run_timestamp} value={r.run_timestamp}>
                  {formatTimestamp(r.run_timestamp).absolute} · +{r.total_new_reviews}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-5">
          {selectedRun && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatTimestamp(selectedRun.run_timestamp).relative}
                </span>
                <span>·</span>
                <span>{formatTimestamp(selectedRun.run_timestamp).absolute}</span>
                <span>·</span>
                <span>
                  {selectedRun.total_new_reviews} new review
                  {selectedRun.total_new_reviews === 1 ? "" : "s"} across{" "}
                  {selectedRun.groups.length} competitor
                  {selectedRun.groups.length === 1 ? "" : "s"}
                </span>
              </div>

              {selectedRun.groups.map((group) => (
                <div key={group.competitor_id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Store className="size-3" aria-hidden="true" />
                      {group.competitor_name}
                    </Badge>
                    <Badge variant="outline">{group.branch_name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.reviews.length} new
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.reviews.map((review) => (
                      <NewReviewCard key={review.review_id} review={review} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewReviewCard({ review }: { review: Review }) {
  const name = cleanReviewerName(review.reviewer_name);
  const scraped = formatTimestamp(review.scraped_at);
  const reviewDate =
    review.review_date && review.review_date !== "None"
      ? review.review_date
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium leading-tight">{name}</p>
            <StarRating rating={review.rating} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(review.review_like_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden="true" />
              {review.review_like_count}
            </span>
          )}
          <span title={scraped.absolute}>{scraped.relative}</span>
        </div>
      </div>
      {review.text && (
        <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
          {review.text}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {review.relative_date && <span>“{review.relative_date}”</span>}
        {reviewDate && (
          <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
            {reviewDate}
          </span>
        )}
      </div>
    </motion.div>
  );
}

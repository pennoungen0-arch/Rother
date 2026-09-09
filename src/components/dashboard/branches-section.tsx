"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  Globe,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Store,
  RefreshCw,
  Loader2,
} from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { StarRating } from "./star-rating";
import { EmptyState } from "./empty-state";
import { cleanReviewerName, formatTimestamp } from "@/lib/gbp/format";
import type {
  BranchesResponse,
  CompetitorStats,
  Review,
  ReviewsResponse,
} from "@/lib/gbp/types";

interface BranchesSectionProps {
  data: BranchesResponse | null;
  loading: boolean;
  error: string | null;
  /** Bump this number to force a refetch of per-competitor reviews. */
  refreshKey?: number;
}

/** A single competitor row inside an expanded branch accordion. */
function CompetitorRow({
  comp,
  onOpen,
}: {
  comp: CompetitorStats;
  onOpen: () => void;
}) {
  const ts = formatTimestamp(comp.last_scraped_at);
  const hasReviews = comp.total_reviews > 0;
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/scrape/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor_ids: [comp.competitor_id] }),
      });
    } catch {
      // error handled silently
    } finally {
      setRefreshing(false);
    }
  };

  const TrendIcon = comp.trend_indicator === "up" ? ArrowUp
    : comp.trend_indicator === "down" ? ArrowDown
    : null;

  return (
    // div[role=button] instead of <button>: this row contains the per-competitor
    // refresh <button>, and HTML forbids nested interactive elements (hydration error).
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group w-full cursor-pointer rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`View reviews for ${comp.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Store className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <h4 className="truncate text-sm font-semibold text-foreground">
              {comp.name}
            </h4>
            {comp.self && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-primary/50 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary"
                title="This is your own monitored business — scraped alongside competitors"
              >
                <Store className="size-2.5" aria-hidden="true" />
                Your business
              </Badge>
            )}
            {/* P1-F1: unscrapeable self entry — no valid place_id */}
            {comp.self && comp.unscrapeable && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-red-500/50 bg-red-500/15 px-1.5 py-0 text-[10px] font-semibold text-red-700 dark:text-red-300"
                title="This business has no valid Google place_id — add a Google Maps link in Config to enable monitoring"
              >
                <AlertTriangle className="size-2.5" aria-hidden="true" />
                Not monitored — no place_id
              </Badge>
            )}
            {/* Harvest honesty (HARVEST_FIX_PLAN Phase 3): say when the
                capture window is a partial slice of Google's true total. */}
            {comp.harvest_status === "reduced" && comp.google_review_count && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-sky-500/50 bg-sky-500/15 px-1.5 py-0 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
                title={comp.name + ": newest-window harvest — Google reports more reviews than the panel renders"}
              >
                <AlertTriangle className="size-2.5" aria-hidden="true" />
                Partial window
              </Badge>
            )}
            {/* P1-F2: sort status indicator */}
            {comp.sort_applied === true && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-emerald-500/50 bg-emerald-500/15 px-1.5 py-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                title="Reviews were sorted by newest before scraping — best monitoring accuracy"
              >
                Sorted newest
              </Badge>
            )}
            {comp.sort_applied === false && comp.total_reviews > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-amber-500/50 bg-amber-500/15 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                title="Reviews were in default (most relevant) order — newest reviews may be outside the captured window"
              >
                Default order
              </Badge>
            )}
            {comp.verified === false && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-red-500/50 bg-red-500/15 px-1.5 py-0 text-[10px] font-semibold text-red-700 dark:text-red-300"
                title="place_id has not been cross-checked against the resolved business name"
              >
                <AlertTriangle className="size-2.5" aria-hidden="true" />
                Unverified
              </Badge>
            )}
            {comp.new_reviews_count > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-amber-500/50 bg-amber-500/15 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
              >
                <Sparkles className="size-2.5" aria-hidden="true" />+
                {comp.new_reviews_count} new
              </Badge>
            )}
            {TrendIcon && (
              <TrendIcon
                className={`size-3.5 ${
                  comp.trend_indicator === "up"
                    ? "text-emerald-500"
                    : "text-red-500"
                }`}
                aria-label={`Trending ${comp.trend_indicator}`}
              />
            )}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {comp.competitor_id}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
            aria-hidden="true"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing || !!comp.unscrapeable}
            aria-label={comp.unscrapeable ? "Cannot refresh — no place_id" : `Refresh ${comp.name}`}
            className="h-7 w-7 text-muted-foreground hover:text-primary"
          >
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* P3-U4: Harvest completeness bar */}
      {comp.harvest_status && comp.google_review_count && comp.total_reviews > 0 && (() => {
        const googleCount = parseInt(comp.google_review_count.replace(/[.,]/g, ""), 10);
        if (isNaN(googleCount) || googleCount <= 0) return null;
        const pct = Math.min(100, Math.round((comp.total_reviews / googleCount) * 100));
        const isFull = comp.harvest_status === "full";
        const isReduced = comp.harvest_status === "reduced";
        return (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">
                {isFull ? "Full harvest" : isReduced ? "Newest window" : "Harvest"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {comp.total_reviews.toLocaleString()}/{googleCount.toLocaleString()} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFull
                    ? "bg-emerald-500"
                    : isReduced
                      ? "bg-sky-500"
                      : "bg-muted-foreground/30"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Reviews:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {comp.total_reviews}
          </span>
          {comp.harvest_status === "reduced" && comp.google_review_count && (
            <span
              className="text-muted-foreground"
              title="Google's review panel renders only the newest ~500 — the rest stays on Google"
            >
              of ~{comp.google_review_count} on Google
            </span>
          )}
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Avg:</span>
          <StarRating rating={comp.average_rating} size="sm" />
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-3" aria-hidden="true" />
          <span>Scraped {ts.relative}</span>
        </div>
        {comp.average_review_length !== null && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground">
              ~{comp.average_review_length} char avg
            </span>
          </>
        )}
        {comp.hours_status && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-muted-foreground">
              {comp.hours_status}
            </span>
          </>
        )}
      </div>

      {comp.latest_review?.text && (
        <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2">
          <span className="font-medium text-foreground/60">Latest: </span>
          {comp.latest_review.text}
        </p>
      )}

      {!hasReviews && !comp.unscrapeable && (
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          No snapshot yet — this competitor has no fixture in fixtures mode and
          hasn&apos;t been scraped live.
        </p>
      )}
      {comp.unscrapeable && (
        <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
          No valid Google place_id — add a Google Maps link in Config to enable monitoring.
        </p>
      )}
    </div>
  );
}

/** Sheet content showing a competitor's full review list. */
function CompetitorReviewList({
  comp,
  open,
  onOpenChange,
  refreshKey,
}: {
  comp: CompetitorStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshKey?: number;
}) {
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !comp) return;
    let cancelled = false;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    const url = `/api/reviews?competitor_id=${encodeURIComponent(
      comp.competitor_id,
    )}&pageSize=100`;
    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as ReviewsResponse;
        if (!cancelled) setReviews(json.data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setReviews([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // refreshKey forces a refetch after a manual scrape.
  }, [open, comp, refreshKey]);

  if (!comp) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl"
      >
        <SheetHeader className="gap-2 border-b border-border/60 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-start justify-between gap-2 pr-6">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Store className="size-4 text-primary" aria-hidden="true" />
              {comp.name}
              {comp.self && (
                <Badge
                  variant="outline"
                  className="ml-1 gap-1 border-primary/50 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary"
                  title="This is your own monitored business — scraped alongside competitors"
                >
                  <Store className="size-2.5" aria-hidden="true" />
                  Your business
                </Badge>
              )}
              {comp.verified === false && (
                <Badge
                  variant="outline"
                  className="ml-1 gap-1 border-red-500/50 bg-red-500/15 px-1.5 py-0 text-[10px] font-semibold text-red-700 dark:text-red-300"
                  title="place_id has not been cross-checked against the resolved business name"
                >
                  <AlertTriangle className="size-2.5" aria-hidden="true" />
                  Unverified
                </Badge>
              )}
            </SheetTitle>
            {comp.new_reviews_count > 0 && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/50 bg-amber-500/15 px-1.5 py-0 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
              >
                <Sparkles className="size-3" aria-hidden="true" />+
                {comp.new_reviews_count} new
              </Badge>
            )}
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-mono">{comp.competitor_id}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {comp.branch_name}
            </span>
            {comp.gmaps_url && (
              <a
                href={comp.gmaps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                Google Maps
              </a>
            )}
            {comp.harvest_status === "reduced" && comp.google_review_count && (
              <span
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400"
                title="Google's review panel virtualizes and renders only the newest ~500 cards per session — older reviews stay on Google. Monitoring (new-review detection) is unaffected."
              >
                <AlertTriangle className="size-3" aria-hidden="true" />
                Harvested {comp.total_reviews} of ~{comp.google_review_count} on Google (newest window)
              </span>
            )}
            {/* P1-F2: sort status in sheet view */}
            {comp.sort_applied === true && (
              <span
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                title="Reviews were sorted by newest before scraping — best monitoring accuracy"
              >
                Sorted newest
              </span>
            )}
            {comp.sort_applied === false && comp.total_reviews > 0 && (
              <span
                className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                title="Reviews were in default order — newest reviews may be outside the captured window"
              >
                Default order
              </span>
            )}
            {comp.category && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Category:</span>
                <span className="text-foreground">{comp.category}</span>
              </span>
            )}
            {comp.phone && (
              <a
                href={`tel:${comp.phone}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Phone className="size-3" aria-hidden="true" />
                {comp.phone}
              </a>
            )}
            {comp.website && (
              <a
                href={comp.website.startsWith("http") ? comp.website : `https://${comp.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Globe className="size-3" aria-hidden="true" />
                Website
              </a>
            )}
          </SheetDescription>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-background/60 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Total
              </div>
              <div className="text-lg font-bold tabular-nums">
                {comp.total_reviews}
              </div>
            </div>
            <div className="rounded-lg bg-background/60 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Avg
              </div>
              <div className="flex items-center justify-center pt-1">
                <StarRating
                  rating={comp.average_rating}
                  size="sm"
                  showValue={true}
                />
              </div>
            </div>
            <div className="rounded-lg bg-background/60 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                New
              </div>
              <div className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                +{comp.new_reviews_count}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto gbp-scrollbar p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load reviews"
              description={error}
            />
          ) : reviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No reviews yet"
              description="No data yet for this competitor. Click the update button to load it."
            />
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li
                  key={r.review_id}
                  className="rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {cleanReviewerName(r.reviewer_name)}
                      </div>
                      <div className="mt-0.5">
                        <StarRating rating={r.rating} size="sm" />
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {r.relative_date ?? "—"}
                    </span>
                  </div>
                  {r.text && (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                      {r.text}
                    </p>
                  )}
                  <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                    {r.review_id}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function BranchesSection({
  data,
  loading,
  error,
  refreshKey,
}: BranchesSectionProps) {
  const [selected, setSelected] = React.useState<CompetitorStats | null>(null);
  const [open, setOpen] = React.useState(false);

  const handleOpen = React.useCallback((comp: CompetitorStats) => {
    setSelected(comp);
    setOpen(true);
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load branches"
        description={error}
      />
    );
  }

  if (!data || data.branches.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No branches configured"
        description="config/listings.json is empty or missing."
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-4"
    >
      <Card className="gbp-card-hover bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" aria-hidden="true" />
            Branches &amp; Competitors
          </CardTitle>
          <CardDescription>
            {data.branches.length} branches ·{" "}
            {data.totalCompetitors} competitors monitored ·{" "}
            {data.totalReviews} reviews captured
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={[data.branches[0]?.branch_id]} className="space-y-3">
        {data.branches.map((branch) => {
          const totalNew = branch.new_reviews_count;
          return (
            <AccordionItem
              key={branch.branch_id}
              value={branch.branch_id}
              className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
            >
              <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/40">
                <div className="flex w-full items-center justify-between gap-3 pr-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                      <MapPin className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {branch.branch_name}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {branch.branch_id} · {branch.competitors.length}{" "}
                        competitor{branch.competitors.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1 border-border/60 px-2 py-0.5 text-[11px] font-medium"
                    >
                      <MessageSquare className="size-2.5" aria-hidden="true" />
                      {branch.total_reviews}
                    </Badge>
                    {totalNew > 0 && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                      >
                        <Sparkles className="size-2.5" aria-hidden="true" />+
                        {totalNew}
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {branch.competitors.map((comp) => (
                    <CompetitorRow
                      key={comp.competitor_id}
                      comp={comp}
                      onOpen={() => handleOpen(comp)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <CompetitorReviewList
        comp={selected}
        open={open}
        onOpenChange={setOpen}
        refreshKey={refreshKey}
      />
    </motion.div>
  );
}

"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { FEATURES, getHub, getPinnedFeatures, getUnpinnedFeatures } from "@/lib/features";
import { useAppState, type HubId } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeaturePage, FeatureLoading } from "./feature-page";

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

// Lazy components are created once at module scope (stable identity) so each
// feature module is only fetched from the network when first rendered.
const LAZY: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  "i-kpis": React.lazy(() => import("@/features/i-kpis")),
  "i-rating-distribution": React.lazy(() => import("@/features/i-rating-distribution")),
  "i-new-reviews-branch": React.lazy(() => import("@/features/i-new-reviews-branch")),
  "i-runs": React.lazy(() => import("@/features/runs")),
  "r-reviews": React.lazy(() => import("@/features/r-reviews")),
  "r-reviews-over-time": React.lazy(() => import("@/features/r-reviews-over-time-merged")),
  "r-review-lengths": React.lazy(() => import("@/features/r-review-lengths")),
  "r-word-cloud": React.lazy(() => import("@/features/r-word-cloud")),
  "r-language": React.lazy(() => import("@/features/r-language")),
  "r-top-reviewers": React.lazy(() => import("@/features/r-top-reviewers")),
  "r-alerts": React.lazy(() => import("@/features/r-alerts")),
  "c-branches": React.lazy(() => import("@/features/c-branches")),
  "c-compare": React.lazy(() => import("@/features/c-compare")),
  "c-leaderboard": React.lazy(() => import("@/features/c-leaderboard")),
  "c-comparison": React.lazy(() => import("@/features/c-comparison")),
  "c-growth-rate": React.lazy(() => import("@/features/c-growth-rate")),
  "c-correlation": React.lazy(() => import("@/features/c-correlation")),
  "c-rating-dist-comparison": React.lazy(() => import("@/features/c-rating-dist-comparison")),
  "c-competitive-health": React.lazy(() => import("@/features/c-competitive-health")),
  "c-discover": React.lazy(() => import("@/features/c-discover")),
  "c-geo-grid": React.lazy(() => import("@/features/c-geo-grid")),
  "t-config": React.lazy(() => import("@/features/t-config")),
  "t-export": React.lazy(() => import("@/features/t-export")),
  "t-scrape-schedule": React.lazy(() => import("@/features/t-scrape-schedule")),
  "t-today": React.lazy(() => import("@/features/today")),
};

export function SectionView() {
  const { hub, feature, openFeature } = useAppState();
  if (!hub) return null;
  const Lazy = feature ? LAZY[feature] ?? null : null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      {!feature ? (
        <FeatureGrid hub={hub as HubId} onPick={openFeature} />
      ) : Lazy ? (
        <React.Suspense
          fallback={
            <div className="flex h-full items-center justify-center p-6">
              <FeatureLoading />
            </div>
          }
        >
          <FeaturePage featureId={feature}>
            <Lazy />
          </FeaturePage>
        </React.Suspense>
      ) : (
        <div className="flex h-full items-center justify-center">
          Feature not found.
        </div>
      )}
    </div>
  );
}

function FeatureGrid({
  hub,
  onPick,
}: {
  hub: HubId;
  onPick: (id: string) => void;
}) {
  const { back } = useAppState();
  const hubDef = getHub(hub);
  const HubIcon = hubDef.icon;
  const pinned = getPinnedFeatures(hub);
  const unpinned = getUnpinnedFeatures(hub);
  const reduce = useReducedMotion();

  return (
    <div className="gbp-scrollbar h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="sticky top-0 z-10 -mx-4 mb-6 bg-background/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
              <ArrowLeft />
            </Button>
            <div className="flex items-center gap-2">
              <HubIcon className="size-5 text-primary" />
              <div>
                <h1 className="text-lg font-semibold leading-tight">
                  {hubDef.label}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {hubDef.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {pinned.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pinned
            </h2>
            <motion.div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={reduce ? undefined : gridVariants}
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "show"}
            >
              {pinned.map((f) => {
                const Icon = f.icon;
                return (
                  <motion.button
                    key={f.id}
                    type="button"
                    onClick={() => onPick(f.id)}
                    variants={reduce ? undefined : itemVariants}
                    className={cn(
                      "group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all",
                      "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    )}
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="block font-medium">{f.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {f.description}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        )}

        {unpinned.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              More analytics
            </h2>
            <motion.div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={reduce ? undefined : gridVariants}
              initial={reduce ? undefined : "hidden"}
              animate={reduce ? undefined : "show"}
            >
              {unpinned.map((f) => {
                const Icon = f.icon;
                return (
                  <motion.button
                    key={f.id}
                    type="button"
                    onClick={() => onPick(f.id)}
                    variants={reduce ? undefined : itemVariants}
                    className={cn(
                      "group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all",
                      "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    )}
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="block font-medium">{f.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {f.description}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

import type { ActiveBusiness, BranchConfig, CompetitorConfig } from "./types";

/** Where the monitored-config came from (S6 provenance, SYSTEMS_FIX_PLAN Phase D). */
export type ConfigSource = "tenant" | "seed-demo";

/**
 * v0.3.2 self-monitoring (see SELF_MONITORING_FIX_PLAN.md).
 *
 * Synthesizes a competitor entry for the ACTIVE BUSINESS ITSELF and prepends
 * it to the business's branches, so "you" is always part of the scrape-target
 * set and snapshot joins. This fixes the seam regression where onboarding's
 * competitor-only branches POST silently disabled self-monitoring.
 *
 * Honesty rules:
 *  - No resolvable Google place id (`place_id`/`gmaps_place_id`) → no entry.
 *    We never fabricate an unscrapeable target.
 *  - A stored entry with `competitor_id === active.id` anywhere wins; the
 *    user's own config is never duplicated or overridden.
 *  - The synthetic entry is flagged `self: true` and is NEVER persisted to
 *    user-business.json — geographic-statistics consumers
 *    (competitive-health, geo-grid, osm-discovery) keep reading raw stored
 *    branches so distance/density math stays honest.
 *
 * Multi-branch businesses: self is attached to the first branch only (a
 * place exists once). When no branch exists at all, one synthetic branch is
 * created carrying just the self entry.
 */
export function withSelfEntry(
  active: ActiveBusiness | null | undefined,
): BranchConfig[] {
  if (!active) return [];

  const branches = Array.isArray(active.branches) ? active.branches : [];

  const alreadyListed = branches.some((b) =>
    (b.competitors ?? []).some((c) => c.competitor_id === active.id),
  );
  if (alreadyListed) return branches;

  const placeId = active.gmaps_place_id ?? active.place_id ?? null;
  if (!placeId) return branches;

  const selfEntry: CompetitorConfig = {
    competitor_id: active.id,
    name: active.name || "Your business",
    gmaps_url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    place_id: placeId,
    gmaps_place_id: placeId,
    lat: active.lat,
    lng: active.lng,
    verified: !active.unverified,
    self: true,
  };

  if (branches.length === 0) {
    return [
      {
        branch_id: active.id,
        branch_name: active.name || "Your business",
        competitors: [selfEntry],
      },
    ];
  }

  return branches.map((branch, i) =>
    i === 0
      ? { ...branch, competitors: [selfEntry, ...(branch.competitors ?? [])] }
      : branch,
  );
}

/**
 * S6 provenance (SYSTEMS_FIX_PLAN Phase D) — pure decision core for "which
 * monitored-config should this consumer use, and where did it come from".
 *
 * The 2026-08-24 sweep found TEN API routes joining snapshots against the
 * ROOT SEED `listings.json` while a tenant business was active
 * (/api/reviews filtered by the user's own branch returned ZERO rows; alerts,
 * new-reviews, correlation, history and export routes showed unknown labels /
 * incomplete joins). Every such consumer must go through this helper instead
 * of calling readListings() directly.
 *
 * IO wrapper: `resolveMonitoredConfig()` in server-data.ts.
 */
export function pickMonitoredConfig(
  active: ActiveBusiness | null | undefined,
  seedBranches: BranchConfig[],
): { branches: BranchConfig[]; source: ConfigSource } {
  if (active) {
    return { branches: withSelfEntry(active), source: "tenant" };
  }
  // Fixed mode / pre-onboarding: the seed list IS the legitimate config.
  return { branches: seedBranches, source: "seed-demo" };
}

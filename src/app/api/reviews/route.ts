import { NextResponse } from "next/server";

import { sanitizeError } from "@/lib/gbp/sanitize";
import type { Review, ReviewsResponse } from "@/lib/gbp/types";
import { readAllSnapshots, resolveMonitoredConfig } from "@/lib/gbp/server-data";
import { parseRelativeDate } from "@/lib/gbp/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/reviews?branch_id=&competitor_id=&rating=&date_from=&date_to=&q=&page=1&pageSize=25
 *
 * Paginated, filtered view of ALL reviews across all competitor snapshots.
 * - branch_id: optional, filters by branch
 * - competitor_id: optional, filters by competitor
 * - rating: optional, comma-separated list of star ratings to include
 * - date_from: optional, ISO date string, filters scraped_at >= date_from
 * - date_to: optional, ISO date string, filters scraped_at <= date_to
 * - q: optional, case-insensitive substring match on reviewer_name + text
 * - page: 1-indexed, default 1
 * - pageSize: default 25, capped at 100
 *
 * Returns { data: Review[], total, page, pageSize }.
 *
 * We hydrate each review with its branch_name + competitor_name client-side
 * via the listings map (kept in localStorage or fetched from /api/branches).
 * To keep this endpoint simple, the response only includes the raw review
 * shape — clients join with /api/branches output for display names.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id") || undefined;
    const competitorId = searchParams.get("competitor_id") || undefined;
    const ratingParam = searchParams.get("rating") || undefined;
    const dateFrom = searchParams.get("date_from") || undefined;
    const dateTo = searchParams.get("date_to") || undefined;
    const q = (searchParams.get("q") || "").trim().toLowerCase() || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSizeRaw = parseInt(searchParams.get("pageSize") || "25", 10) || 25;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

    const ratingFilter = ratingParam
      ? new Set(
          ratingParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => Math.round(Number(s)))
            .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 5),
        )
      : null;

    // P2 / tenant scoping (fixed 2026-08-24, SYSTEMS_FIX_PLAN Phase B
    // escalation + Phase D sweep): the branch→competitors filter map MUST
    // come from resolveMonitoredConfig() (tenant branches + self entry),
    // NOT the root seed listings — otherwise filtering by a tenant branch
    // (e.g. "Crate Cafe") produced an empty allowed-set and zero rows.
    const [{ branches: configBranches }, snapshots] = await Promise.all([
      resolveMonitoredConfig(),
      readAllSnapshots(),
    ]);

    // Determine which competitor_ids to include based on branch filter.
    const branchToCompetitorIds = new Map<string, Set<string>>();
    for (const branch of configBranches) {
      branchToCompetitorIds.set(
        branch.branch_id,
        new Set(branch.competitors.map((c) => c.competitor_id)),
      );
    }

    let allowedCompetitorIds: Set<string> | null = null;
    if (branchId) {
      allowedCompetitorIds = branchToCompetitorIds.get(branchId) ?? new Set();
    }
    if (competitorId) {
      // Intersect with branch filter (if branchId was given).
      if (allowedCompetitorIds) {
        if (!allowedCompetitorIds.has(competitorId)) {
          allowedCompetitorIds = new Set();
        } else {
          allowedCompetitorIds = new Set([competitorId]);
        }
      } else {
        allowedCompetitorIds = new Set([competitorId]);
      }
    }

    // Gather all reviews from disk, applying competitor filter at the source.
    const all: Review[] = [];
    for (const [compId, reviews] of snapshots.entries()) {
      if (allowedCompetitorIds && !allowedCompetitorIds.has(compId)) continue;
      for (const r of reviews) all.push(r);
    }

    // Apply rating + date + text filters.
    const filtered = all.filter((r) => {
      if (ratingFilter) {
        if (r.rating === null) return false;
        const bucket = Math.round(r.rating);
        if (!ratingFilter.has(bucket)) return false;
      }
      if (dateFrom || dateTo) {
        const reviewDate =
          parseRelativeDate(r.relative_date, r.scraped_at) ?? r.scraped_at?.slice(0, 10) ?? null;
        if (dateFrom && reviewDate && reviewDate < dateFrom) return false;
        if (dateTo && reviewDate && reviewDate > dateTo) return false;
      }
      if (q) {
        const name = (r.reviewer_name || "").toLowerCase();
        const text = (r.text || "").toLowerCase();
        if (!name.includes(q) && !text.includes(q)) return false;
      }
      return true;
    });

    // Sort: newest review DATE first (resolved from relative_date), then by
    // scraped_at as a tiebreaker. This ensures recently POSTED reviews appear
    // at the top, not just recently SCRAPED ones.
    filtered.sort((a, b) => {
      const dateA = parseRelativeDate(a.relative_date, a.scraped_at) ?? a.scraped_at?.slice(0, 10) ?? "";
      const dateB = parseRelativeDate(b.relative_date, b.scraped_at) ?? b.scraped_at?.slice(0, 10) ?? "";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const sa = a.scraped_at || "";
      const sb = b.scraped_at || "";
      if (sa !== sb) return sb.localeCompare(sa);
      return (b.review_id || "").localeCompare(a.review_id || "");
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    const body: ReviewsResponse = { data, total, page, pageSize };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "reviews query failed",
        detail: sanitizeError(err),
      },
      { status: 500 },
    );
  }
}

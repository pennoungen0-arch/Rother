import { NextResponse } from "next/server";

import { sanitizeError } from "@/lib/gbp/sanitize";
import { readAllDeltas, resolveMonitoredConfig } from "@/lib/gbp/server-data";
import type { NewReviewsResponse } from "@/lib/gbp/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/new-reviews
 *
 * Returns the FULL content of every new review captured per delta run,
 * grouped by run timestamp and competitor. Unlike /api/history (counts only),
 * this surfaces the actual review text, rating, reviewer, date, and likes so
 * the dashboard can show what changed.
 *
 * Response shape:
 *   {
 *     runs: [
 *       {
 *         run_timestamp: "2026-08-13T09:05:03Z",
 *         total_new_reviews: 3881,
 *         groups: [
 *           {
 *             competitor_id, competitor_name, branch_id, branch_name,
 *             reviews: [ Review, ... ]
 *           }
 *         ]
 *       }
 *     ],
 *     totalRuns: 1
 *   }
 */
export async function GET() {
  try {
    // Phase D sweep: label maps from the monitored config, not seed listings.
    const [deltas, { branches: configBranches }] = await Promise.all([
      readAllDeltas(),
      resolveMonitoredConfig(),
    ]);

    // Build id→name maps
    const compIdToName = new Map<string, string>();
    const compIdToBranchId = new Map<string, string>();
    const branchIdToName = new Map<string, string>();
    for (const branch of configBranches) {
      branchIdToName.set(branch.branch_id, branch.branch_name);
      for (const comp of branch.competitors) {
        compIdToName.set(comp.competitor_id, comp.name);
        compIdToBranchId.set(comp.competitor_id, branch.branch_id);
      }
    }

    // Group deltas by run_timestamp, keeping the full review objects.
    const byRun = new Map<
      string,
      Map<string, NewReviewsResponse["runs"][number]["groups"][number]>
    >();
    for (const d of deltas) {
      if (d.reviews.length === 0) continue;
      const branchId = compIdToBranchId.get(d.competitor_id) ?? "";
      let runGroups = byRun.get(d.run_timestamp);
      if (!runGroups) {
        runGroups = new Map();
        byRun.set(d.run_timestamp, runGroups);
      }
      const existing = runGroups.get(d.competitor_id);
      const group = {
        competitor_id: d.competitor_id,
        competitor_name:
          compIdToName.get(d.competitor_id) ?? d.competitor_id,
        branch_id: branchId,
        branch_name: branchIdToName.get(branchId) ?? branchId,
        reviews: existing ? [...existing.reviews, ...d.reviews] : d.reviews,
      };
      runGroups.set(d.competitor_id, group);
    }

    const runs = Array.from(byRun.entries())
      .map(([run_timestamp, groups]) => {
        const groupList = Array.from(groups.values()).sort((a, b) =>
          a.competitor_name.localeCompare(b.competitor_name),
        );
        const total_new_reviews = groupList.reduce(
          (s, g) => s + g.reviews.length,
          0,
        );
        return { run_timestamp, total_new_reviews, groups: groupList };
      })
      .sort((a, b) => b.run_timestamp.localeCompare(a.run_timestamp));

    const body: NewReviewsResponse = { runs, totalRuns: runs.length };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "new-reviews query failed",
        detail: sanitizeError(err),
      },
      { status: 500 },
    );
  }
}

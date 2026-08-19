import type { RunSummary } from "@/lib/gbp/types";

/**
 * v1 run_summary.json does not carry the v2 contract fields
 * (`status`/`reviewCount`/`targetCount`) that ScrapeSchedule and other v2
 * consumers expect. Derive them from the v1 success/failed/total counts so
 * the fixed-list (v1) data speaks the v2 contract. Never overwrites a field
 * that the v2 single-path scraper already wrote.
 */
export function normalizeRunSummary(summary: RunSummary | null): RunSummary | null {
  if (!summary) return null;
  const normalized: RunSummary = { ...summary };
  if (normalized.status === undefined) {
    if (summary.failed > 0 && summary.failed >= summary.success) {
      normalized.status = "FAILED";
    } else if (summary.success > 0) {
      normalized.status = "OK";
    } else {
      normalized.status = "INSUFFICIENT";
    }
  }
  if (normalized.reviewCount === undefined) {
    normalized.reviewCount = summary.total_reviews;
  }
  if (normalized.targetCount === undefined) {
    normalized.targetCount = summary.total_competitors ?? 0;
  }
  return normalized;
}
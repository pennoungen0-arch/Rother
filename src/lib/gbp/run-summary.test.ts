import { describe, it, expect } from "vitest";
import { normalizeRunSummary } from "./run-summary";

describe("normalizeRunSummary", () => {
  it("returns null for null input", () => {
    expect(normalizeRunSummary(null)).toBeNull();
  });

  it("derives status OK when success > 0 and no failures", () => {
    const result = normalizeRunSummary({
      started_at: "2026-08-13T09:05:03Z",
      finished_at: "2026-08-13T09:28:22Z",
      mode: "live",
      success: 12,
      failed: 0,
      skipped: 0,
      new_reviews: 100,
      total_reviews: 5000,
      errors: [],
    });
    expect(result?.status).toBe("OK");
  });

  it("derives status FAILED when failures >= successes", () => {
    const result = normalizeRunSummary({
      started_at: "2026-08-13T09:05:03Z",
      finished_at: "2026-08-13T09:28:22Z",
      mode: "live",
      success: 1,
      failed: 3,
      skipped: 0,
      new_reviews: 0,
      total_reviews: 10,
      errors: [{ competitor_id: "c1", error: "boom" }],
    });
    expect(result?.status).toBe("FAILED");
  });

  it("derives status INSUFFICIENT when nothing succeeded or failed", () => {
    const result = normalizeRunSummary({
      started_at: "2026-08-13T09:05:03Z",
      finished_at: null,
      mode: "fixtures",
      success: 0,
      failed: 0,
      skipped: 5,
      new_reviews: 0,
      total_reviews: 0,
      errors: [],
    });
    expect(result?.status).toBe("INSUFFICIENT");
  });

  it("derives reviewCount and targetCount from v1 totals", () => {
    const result = normalizeRunSummary({
      started_at: "2026-08-13T09:05:03Z",
      finished_at: "2026-08-13T09:28:22Z",
      mode: "live",
      success: 12,
      failed: 0,
      skipped: 0,
      new_reviews: 5021,
      total_reviews: 5021,
      total_competitors: 12,
      errors: [],
    });
    expect(result?.reviewCount).toBe(5021);
    expect(result?.targetCount).toBe(12);
  });

  it("does not overwrite v2-provided fields", () => {
    const result = normalizeRunSummary({
      started_at: "2026-08-13T09:05:03Z",
      finished_at: "2026-08-13T09:28:22Z",
      mode: "live",
      success: 0,
      failed: 0,
      skipped: 0,
      new_reviews: 0,
      total_reviews: 0,
      errors: [],
      status: "NEED_SESSION",
      reviewCount: 7,
      targetCount: 9,
    });
    expect(result?.status).toBe("NEED_SESSION");
    expect(result?.reviewCount).toBe(7);
    expect(result?.targetCount).toBe(9);
  });

  it("targetCount defaults to 0 when total_competitors is absent", () => {
    const result = normalizeRunSummary({
      started_at: "2026-08-13T09:05:03Z",
      finished_at: "2026-08-13T09:28:22Z",
      mode: "live",
      success: 1,
      failed: 0,
      skipped: 0,
      new_reviews: 0,
      total_reviews: 5,
      errors: [],
    });
    expect(result?.targetCount).toBe(0);
  });
});
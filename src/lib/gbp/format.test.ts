import { describe, it, expect } from "vitest";
import {
  parseRelativeDate,
  cleanReviewerName,
  truncate,
  averageRating,
  formatRating,
  ratingColor,
  formatTimestamp,
} from "./format";

describe("parseRelativeDate", () => {
  const scrapedAt = "2026-07-23T09:53:45.695184+00:00";

  it("parses Indonesian: X hari lalu", () => {
    expect(parseRelativeDate("5 hari lalu", scrapedAt)).toBe("2026-07-18");
  });

  it("parses Indonesian: sehari lalu", () => {
    expect(parseRelativeDate("sehari lalu", scrapedAt)).toBe("2026-07-22");
  });

  it("parses Indonesian: X minggu lalu", () => {
    expect(parseRelativeDate("2 minggu lalu", scrapedAt)).toBe("2026-07-09");
  });

  it("parses Indonesian: seminggu lalu", () => {
    expect(parseRelativeDate("seminggu lalu", scrapedAt)).toBe("2026-07-16");
  });

  it("parses Indonesian: X bulan lalu", () => {
    expect(parseRelativeDate("3 bulan lalu", scrapedAt)).toBe("2026-04-23");
  });

  it("parses Indonesian: sebulan lalu", () => {
    expect(parseRelativeDate("sebulan lalu", scrapedAt)).toBe("2026-06-23");
  });

  it("parses Indonesian: 2 bulan lalu", () => {
    expect(parseRelativeDate("2 bulan lalu", scrapedAt)).toBe("2026-05-23");
  });

  it("parses Indonesian: X tahun lalu", () => {
    expect(parseRelativeDate("1 tahun lalu", scrapedAt)).toBe("2025-07-23");
  });

  it("parses Indonesian: setahun lalu", () => {
    expect(parseRelativeDate("setahun lalu", scrapedAt)).toBe("2025-07-23");
  });

  it("parses English: X days ago", () => {
    expect(parseRelativeDate("5 days ago", scrapedAt)).toBe("2026-07-18");
  });

  it("parses English: a day ago", () => {
    expect(parseRelativeDate("a day ago", scrapedAt)).toBe("2026-07-22");
  });

  it("parses English: X weeks ago", () => {
    expect(parseRelativeDate("2 weeks ago", scrapedAt)).toBe("2026-07-09");
  });

  it("parses English: a week ago", () => {
    expect(parseRelativeDate("a week ago", scrapedAt)).toBe("2026-07-16");
  });

  it("parses English: X months ago", () => {
    expect(parseRelativeDate("3 months ago", scrapedAt)).toBe("2026-04-23");
  });

  it("parses English: a month ago", () => {
    expect(parseRelativeDate("a month ago", scrapedAt)).toBe("2026-06-23");
  });

  it("parses English: X years ago", () => {
    expect(parseRelativeDate("2 years ago", scrapedAt)).toBe("2024-07-23");
  });

  it("returns null for null input", () => {
    expect(parseRelativeDate(null, scrapedAt)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseRelativeDate(undefined, scrapedAt)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRelativeDate("", scrapedAt)).toBeNull();
  });

  it("returns null for unparseable string", () => {
    expect(parseRelativeDate("some random text", scrapedAt)).toBeNull();
  });

  it("returns null for invalid scrapedAt", () => {
    expect(parseRelativeDate("5 days ago", "not-a-date")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(parseRelativeDate("5 HARI LALU", scrapedAt)).toBe("2026-07-18");
    expect(parseRelativeDate("5 Days Ago", scrapedAt)).toBe("2026-07-18");
  });

  it("strips 'Diedit' prefix (Indonesian edited reviews)", () => {
    expect(parseRelativeDate("Diedit 3 tahun lalu", scrapedAt)).toBe("2023-07-23");
    expect(parseRelativeDate("diedit setahun lalu", scrapedAt)).toBe("2025-07-23");
  });

  it("strips 'Edited' prefix (English edited reviews)", () => {
    expect(parseRelativeDate("Edited 2 months ago", scrapedAt)).toBe("2026-05-23");
    expect(parseRelativeDate("edited a year ago", scrapedAt)).toBe("2025-07-23");
  });

  it("parses Indonesian: X jam lalu", () => {
    expect(parseRelativeDate("3 jam lalu", scrapedAt)).toBe("2026-07-23");
  });

  it("parses Indonesian: sejam lalu", () => {
    expect(parseRelativeDate("sejam lalu", scrapedAt)).toBe("2026-07-23");
  });

  it("parses Indonesian: X menit lalu", () => {
    expect(parseRelativeDate("15 menit lalu", scrapedAt)).toBe("2026-07-23");
  });

  it("parses Indonesian: baru saja", () => {
    expect(parseRelativeDate("baru saja", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: X hours ago", () => {
    expect(parseRelativeDate("5 hours ago", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: an hour ago", () => {
    expect(parseRelativeDate("an hour ago", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: X minutes ago", () => {
    expect(parseRelativeDate("30 minutes ago", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: a minute ago", () => {
    expect(parseRelativeDate("a minute ago", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: just now", () => {
    expect(parseRelativeDate("just now", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: today", () => {
    expect(parseRelativeDate("today", scrapedAt)).toBe("2026-07-23");
  });

  it("parses English: yesterday", () => {
    expect(parseRelativeDate("yesterday", scrapedAt)).toBe("2026-07-22");
  });

  it("parses Indonesian: kemarin (Y3 fix)", () => {
    expect(parseRelativeDate("kemarin", scrapedAt)).toBe("2026-07-22");
  });
});

describe("cleanReviewerName", () => {
  it("strips the ', original' aria-label suffix", () => {
    expect(cleanReviewerName("Budi Santoso, original")).toBe("Budi Santoso");
  });

  it("keeps names without the suffix", () => {
    expect(cleanReviewerName("Budi Santoso")).toBe("Budi Santoso");
  });

  it("returns Anonymous for null/undefined/empty", () => {
    expect(cleanReviewerName(null)).toBe("Anonymous");
    expect(cleanReviewerName(undefined)).toBe("Anonymous");
    expect(cleanReviewerName("   ")).toBe("Anonymous");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanReviewerName("  Budi, original  ")).toBe("Budi, original");
    expect(cleanReviewerName("  Budi  ")).toBe("Budi");
  });
});

describe("truncate", () => {
  it("returns empty string for null/undefined", () => {
    expect(truncate(null)).toBe("");
    expect(truncate(undefined)).toBe("");
  });

  it("returns short text unchanged", () => {
    expect(truncate("short", 120)).toBe("short");
  });

  it("truncates long text with an ellipsis", () => {
    expect(truncate("a".repeat(200), 120)).toBe("a".repeat(120) + "…");
  });

  it("uses a custom max", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });
});

describe("averageRating", () => {
  it("computes the rounded average", () => {
    expect(averageRating([5, 4, 4])).toBe(4.33);
  });

  it("ignores null/NaN entries", () => {
    expect(averageRating([5, null, NaN, 4])).toBe(4.5);
  });

  it("returns null when no valid ratings", () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([null, NaN])).toBeNull();
  });
});

describe("formatRating", () => {
  it("formats with one decimal", () => {
    expect(formatRating(4)).toBe("4.0");
    expect(formatRating(4.5)).toBe("4.5");
  });

  it("returns em-dash for null/undefined/NaN", () => {
    expect(formatRating(null)).toBe("—");
    expect(formatRating(undefined)).toBe("—");
    expect(formatRating(NaN)).toBe("—");
  });
});

describe("ratingColor", () => {
  it("maps high ratings to amber-500", () => {
    expect(ratingColor(4.6)).toBe("text-amber-500");
  });

  it("maps mid ratings to amber-600", () => {
    expect(ratingColor(4.0)).toBe("text-amber-600");
  });

  it("maps low-mid ratings to orange-500", () => {
    expect(ratingColor(3.0)).toBe("text-orange-500");
  });

  it("maps low ratings to destructive", () => {
    expect(ratingColor(2.0)).toBe("text-destructive");
  });

  it("returns muted for null/undefined", () => {
    expect(ratingColor(null)).toBe("text-muted-foreground");
    expect(ratingColor(undefined)).toBe("text-muted-foreground");
  });
});

describe("formatTimestamp", () => {
  it("returns em-dashes for null/undefined", () => {
    expect(formatTimestamp(null)).toEqual({ relative: "—", absolute: "—" });
    expect(formatTimestamp(undefined)).toEqual({ relative: "—", absolute: "—" });
  });

  it("falls back to the raw string on parse failure", () => {
    expect(formatTimestamp("not-a-date")).toEqual({
      relative: "not-a-date",
      absolute: "not-a-date",
    });
  });

  it("formats a valid ISO timestamp", () => {
    const result = formatTimestamp("2026-08-13T09:28:22.955153+00:00");
    expect(result.absolute).toContain("2026-08-13");
    expect(result.relative.length).toBeGreaterThan(0);
  });
});

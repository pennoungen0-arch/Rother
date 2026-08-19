import { describe, it, expect } from "vitest";
import {
  BUSINESS_CATEGORIES,
  searchCategories,
  getCategory,
} from "./categories";

describe("searchCategories", () => {
  it("returns all categories for an empty query", () => {
    expect(searchCategories("")).toHaveLength(BUSINESS_CATEGORIES.length);
    expect(searchCategories("   ")).toHaveLength(BUSINESS_CATEGORIES.length);
  });

  it("matches case-insensitively on labels", () => {
    const r = searchCategories("COFFEE");
    expect(r.some((c) => c.id === "coffee_shop")).toBe(true);
  });

  it("matches on id words (underscores → spaces)", () => {
    const r = searchCategories("coffee shop");
    expect(r.some((c) => c.id === "coffee_shop")).toBe(true);
  });

  it("returns empty for a no-match query", () => {
    expect(searchCategories("zzzznotacategoryzzz")).toEqual([]);
  });

  it("filters rather than returning everything", () => {
    const r = searchCategories("dentist");
    expect(r.length).toBeLessThan(BUSINESS_CATEGORIES.length);
    expect(r[0].id).toBe("dentist");
  });
});

describe("getCategory", () => {
  it("returns the category by id", () => {
    expect(getCategory("cafe")).toEqual({ id: "cafe", label: "Café" });
  });

  it("returns undefined for unknown id", () => {
    expect(getCategory("nope")).toBeUndefined();
  });

  it("returns undefined for undefined/empty input", () => {
    expect(getCategory(undefined)).toBeUndefined();
    expect(getCategory("")).toBeUndefined();
  });
});
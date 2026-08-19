import { describe, it, expect } from "vitest";
import { validateCompetitorId, ValidationError } from "./validate";

describe("validateCompetitorId", () => {
  it("accepts a valid id", () => {
    expect(validateCompetitorId("comp-seminyak-01")).toBe("comp-seminyak-01");
  });

  it("rejects empty string", () => {
    expect(() => validateCompetitorId("")).toThrow(ValidationError);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error — deliberately passing invalid types
    expect(() => validateCompetitorId(42)).toThrow(ValidationError);
    // @ts-expect-error — deliberately passing invalid types
    expect(() => validateCompetitorId(undefined)).toThrow(ValidationError);
  });

  it("rejects null byte", () => {
    expect(() => validateCompetitorId("comp\x00x")).toThrow(ValidationError);
  });

  it("rejects leading/trailing hyphens", () => {
    expect(() => validateCompetitorId("-comp")).toThrow(ValidationError);
    expect(() => validateCompetitorId("comp-")).toThrow(ValidationError);
  });

  it("rejects path traversal '..'", () => {
    expect(() => validateCompetitorId("..")).toThrow(ValidationError);
    expect(() => validateCompetitorId("a..b")).toThrow(ValidationError);
  });

  it("rejects path separators", () => {
    expect(() => validateCompetitorId("a/b")).toThrow(ValidationError);
    expect(() => validateCompetitorId("a\\b")).toThrow(ValidationError);
  });

  it("rejects ids over 64 chars", () => {
    expect(() => validateCompetitorId("a".repeat(65))).toThrow(ValidationError);
  });

  it("rejects disallowed characters", () => {
    expect(() => validateCompetitorId("comp.id")).toThrow(ValidationError);
    expect(() => validateCompetitorId("comp id")).toThrow(ValidationError);
    expect(() => validateCompetitorId("comp@x")).toThrow(ValidationError);
  });

  it("accepts underscores and digits", () => {
    expect(validateCompetitorId("comp_01_xyz")).toBe("comp_01_xyz");
  });
});
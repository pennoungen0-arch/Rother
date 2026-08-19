import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage, sanitizeError, safeError } from "./sanitize";

describe("sanitizeErrorMessage", () => {
  it("strips single-quoted paths", () => {
    expect(
      sanitizeErrorMessage("ENOENT: no such file, open 'C:\\data\\run_summary.json'"),
    ).toBe("ENOENT: no such file, open '<path>'");
  });

  it("strips double-quoted paths", () => {
    expect(
      sanitizeErrorMessage('ENOENT: no such file, open "/etc/config.json"'),
    ).toBe("ENOENT: no such file, open '<path>'");
  });

  it("strips backtick-quoted paths", () => {
    expect(sanitizeErrorMessage("failed at `C:\\secrets\\key.pem`")).toBe(
      "failed at '<path>'",
    );
  });

  it("leaves messages without paths untouched", () => {
    expect(sanitizeErrorMessage("connection refused")).toBe("connection refused");
  });
});

describe("sanitizeError", () => {
  it("extracts message from an Error", () => {
    const err = new Error("boom at 'C:\\x\\y.json'");
    expect(sanitizeError(err)).toBe("boom at '<path>'");
  });

  it("stringifies non-Error values", () => {
    expect(sanitizeError("plain string")).toBe("plain string");
    expect(sanitizeError(42)).toBe("42");
  });

  it("handles undefined", () => {
    expect(sanitizeError(undefined)).toBe("undefined");
  });
});

describe("safeError", () => {
  it("removes ': 'path'' suffixes", () => {
    expect(safeError("open: 'C:\\a\\b.json'")).toBe("open");
  });

  it("removes ': \"path\"' suffixes", () => {
    expect(safeError('parse: "config.json"')).toBe("parse");
  });

  it("leaves clean messages unchanged", () => {
    expect(safeError("invalid input")).toBe("invalid input");
  });
});
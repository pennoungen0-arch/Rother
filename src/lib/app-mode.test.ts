import { describe, it, expect } from "vitest";
import { appName, appVersion, getText } from "./app-mode";

describe("appName", () => {
  it("returns Rother for client mode", () => {
    expect(appName("client")).toBe("Rother");
  });

  it("returns Rother (Dev) for dev mode", () => {
    expect(appName("dev")).toBe("Rother (Dev)");
  });
});

describe("appVersion", () => {
  it("returns the current version", () => {
    expect(appVersion()).toBe("0.2.0");
  });
});

describe("getText", () => {
  it("client mode hides dev tabs and jargon", () => {
    const t = getText("client");
    expect(t.showConfigTab).toBe(false);
    expect(t.showRunLogsTab).toBe(false);
    expect(t.runButton).toBe("Update Now");
    expect(t.collectorNoun).toBe("data collection");
  });

  it("dev mode shows dev tabs and jargon", () => {
    const t = getText("dev");
    expect(t.showConfigTab).toBe(true);
    expect(t.showRunLogsTab).toBe(true);
    expect(t.runButton).toBe("Run Now");
    expect(t.collectorNoun).toBe("scraper");
  });

  it("both modes share the same base identity", () => {
    expect(getText("client").name).toBe("Rother");
    expect(getText("dev").version).toBe("0.2.0");
  });
});
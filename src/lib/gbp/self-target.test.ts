import { describe, expect, it } from "vitest";

import type { ActiveBusiness } from "./types";
import { withSelfEntry, pickMonitoredConfig } from "./self-target";

function makeActive(overrides: Partial<ActiveBusiness> = {}): ActiveBusiness {
  return {
    id: "crate-cafe",
    name: "Crate Cafe",
    location: "Canggu",
    place_id: "ChIJ_TEST_PLACE",
    gmaps_place_id: "ChIJ_TEST_PLACE",
    lat: -8.65,
    lng: 115.15,
    unverified: false,
    scrapedAt: "2026-08-22T00:00:00Z",
    branches: [
      {
        branch_id: "crate-cafe",
        branch_name: "Crate Cafe",
        competitors: [
          {
            competitor_id: "revolver-seminyak",
            name: "Revolver Seminyak",
            gmaps_url: "https://maps.app.goo.gl/xxx",
            place_id: "ChIJ_REVOLVER",
            verified: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("withSelfEntry", () => {
  it("returns [] for no active business", () => {
    expect(withSelfEntry(null)).toEqual([]);
    expect(withSelfEntry(undefined)).toEqual([]);
  });

  it("creates a synthetic branch when none exist", () => {
    const active = makeActive({ branches: [] });
    const out = withSelfEntry(active);
    expect(out).toHaveLength(1);
    expect(out[0].branch_id).toBe("crate-cafe");
    expect(out[0].competitors).toHaveLength(1);
    expect(out[0].competitors[0].self).toBe(true);
  });

  it("injects nothing when the business has no resolvable place id", () => {
    const storedBranch = { branch_id: "b", branch_name: "B", competitors: [] };
    const active = makeActive({
      place_id: undefined,
      gmaps_place_id: null,
      branches: [storedBranch],
    });
    const out = withSelfEntry(active);
    expect(out).toHaveLength(1);
    expect(out[0].competitors).toHaveLength(0);
    // honesty: never fabricate a target — original branch returned untouched
    expect(out[0]).toEqual(storedBranch);
  });

  it("prepends the self entry to the first branch", () => {
    const out = withSelfEntry(makeActive());
    expect(out[0].competitors[0].competitor_id).toBe("crate-cafe");
    expect(out[0].competitors[1].competitor_id).toBe("revolver-seminyak");
  });

  it("maps identity fields onto the self entry", () => {
    const out = withSelfEntry(makeActive());
    const self = out[0].competitors[0];
    expect(self.competitor_id).toBe("crate-cafe");
    expect(self.name).toBe("Crate Cafe");
    expect(self.gmaps_url).toBe(
      "https://www.google.com/maps/place/?q=place_id:ChIJ_TEST_PLACE",
    );
    expect(self.place_id).toBe("ChIJ_TEST_PLACE");
    expect(self.gmaps_place_id).toBe("ChIJ_TEST_PLACE");
    expect(self.lat).toBe(-8.65);
    expect(self.lng).toBe(115.15);
    expect(self.verified).toBe(true);
    expect(self.self).toBe(true);
  });

  it("marks the self entry unverified for manual anchors", () => {
    const out = withSelfEntry(makeActive({ unverified: true }));
    expect(out[0].competitors[0].verified).toBe(false);
  });

  it("does not duplicate when the user already listed the business itself", () => {
    const active = makeActive();
    active.branches?.[0].competitors.unshift({
      competitor_id: "crate-cafe",
      name: "Crate Cafe",
      gmaps_url: "",
      place_id: "ChIJ_USER_ENTERED",
    });
    const out = withSelfEntry(active);
    expect(out[0].competitors.filter((c) => c.competitor_id === "crate-cafe"))
      .toHaveLength(1);
    // user's own entry wins untouched (no self flag injected into it)
    expect(out[0].competitors[0].place_id).toBe("ChIJ_USER_ENTERED");
    expect(out[0].competitors[0].self).toBeUndefined();
  });

  it("detects duplicates across ANY branch", () => {
    const active = makeActive({
      branches: [
        { branch_id: "a", branch_name: "A", competitors: [] },
        {
          branch_id: "b",
          branch_name: "B",
          competitors: [
            {
              competitor_id: "crate-cafe",
              name: "Crate Cafe",
              gmaps_url: "",
            },
          ],
        },
      ],
    });
    const out = withSelfEntry(active);
    const total = out.flatMap((b) => b.competitors).filter(
      (c) => c.competitor_id === "crate-cafe",
    );
    expect(total).toHaveLength(1);
  });

  it("attaches self to exactly one branch in multi-branch setups", () => {
    const active = makeActive({
      branches: [
        { branch_id: "main", branch_name: "Main", competitors: [] },
        { branch_id: "sat", branch_name: "Sat", competitors: [] },
      ],
    });
    const out = withSelfEntry(active);
    expect(out[0].competitors).toHaveLength(1);
    expect(out[1].competitors).toHaveLength(0);
  });

  it("does not mutate the input business", () => {
    const active = makeActive();
    const before = JSON.stringify(active);
    withSelfEntry(active);
    expect(JSON.stringify(active)).toBe(before);
  });

  it("tolerates branches without competitors arrays", () => {
    const active = makeActive({
      branches: [
        { branch_id: "x", branch_name: "X" },
      ] as ActiveBusiness["branches"],
    });
    const out = withSelfEntry(active);
    expect(out[0].competitors[0].self).toBe(true);
  });

  it("falls back to place_id when gmaps_place_id is absent", () => {
    const active = makeActive({ gmaps_place_id: null });
    const out = withSelfEntry(active);
    expect(out[0].competitors[0].self).toBe(true);
  });
});

describe("pickMonitoredConfig", () => {
  const seedBranches = [
    {
      branch_id: "comp-canggu-01",
      branch_name: "Seed Canggu",
      competitors: [
        { competitor_id: "comp-canggu-01", name: "Seed Canggu", gmaps_url: "" },
      ],
    },
  ];

  it("returns tenant branches (with self) + source=tenant when a business is active", () => {
    const out = pickMonitoredConfig(makeActive(), seedBranches);
    expect(out.source).toBe("tenant");
    const ids = out.branches[0].competitors.map((c) => c.competitor_id);
    expect(ids).toContain("crate-cafe"); // self injected
    expect(ids).toContain("revolver-seminyak");
    expect(ids).not.toContain("comp-canggu-01"); // seed ignored
  });

  it("returns seed branches + source=seed-demo with no active business", () => {
    const out = pickMonitoredConfig(null, seedBranches);
    expect(out.source).toBe("seed-demo");
    expect(out.branches).toBe(seedBranches);
    expect(out.branches[0].competitors[0].competitor_id).toBe("comp-canggu-01");
  });

  it("returns seed branches for undefined active too", () => {
    const out = pickMonitoredConfig(undefined, seedBranches);
    expect(out.source).toBe("seed-demo");
  });

  it("never mixes seed competitors into tenant output", () => {
    const out = pickMonitoredConfig(makeActive(), seedBranches);
    const all = out.branches.flatMap((b) => b.competitors.map((c) => c.competitor_id));
    expect(all.filter((id) => id.startsWith("comp-"))).toHaveLength(0);
  });
});

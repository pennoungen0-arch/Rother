import { test, expect } from "@playwright/test";

import { mockPlacesApi } from "./helpers/places-mock";

/**
 * Regression — Tools › Config competitor add/remove persistence.
 *
 * Bug (2026-08-25): addCompetitor/removeCompetitor serialized a React
 * state-updater FUNCTION into JSON.stringify, which omits functions —
 * the POST body was literally `{}`, the server 400'd ("branches must be
 * an array"), and nothing persisted while the UI updated optimistically
 * and showed success toasts. Users saw removed competitors return on
 * reload (SYSTEMS audit session, S1 identity/config).
 *
 * State is seeded via API + localStorage (deterministic; the onboarding
 * flow's own POST choreography raced the removals in earlier attempts —
 * onboarding persistence is already covered by discovery-persistence.spec).
 */

const REVOLVER_LINK = "https://maps.app.goo.gl/FEkM7q8dPc8DrPiQ6";

const REVOLVER_COMPETITOR = {
  competitor_id: "revolver-seminyak",
  name: "Revolver Seminyak",
  gmaps_url: REVOLVER_LINK,
  place_id: "ChIJ9fhCoBBH0i0R4h17JYdA484",
  gmaps_place_id: "ChIJ9fhCoBBH0i0R4h17JYdA484",
  lat: -8.6843706,
  lng: 115.1579758,
  verified: true,
};

async function seedBusiness(page: import("@playwright/test").Page) {
  await page.request.post("/api/business", {
    data: {
      name: "Crate Cafe",
      location: "Jl. Tanah Barak, Canggu, Badung, Bali",
      categoryId: "cafe",
      gmaps_place_id: "ChIJOaEQDnk40i0Rzhou4NcRx-w",
      lat: -8.6478,
      lng: 115.1385,
    },
  });
}

async function seedCompetitor(
  page: import("@playwright/test").Page,
  competitorId: string,
) {
  await page.request.post("/api/business/branches", {
    data: {
      branches: [
        {
          branch_id: "crate-cafe",
          branch_name: "Crate Cafe",
          branch_kind: "business",
          competitors: [
            { ...REVOLVER_COMPETITOR, competitor_id: competitorId },
          ],
        },
      ],
    },
  });
}

async function seedClientState(page: import("@playwright/test").Page) {
  await mockPlacesApi(page);
  await page.addInitScript(() => {
    localStorage.setItem("rother.user", JSON.stringify({ name: "Owner", email: "o@x.co" }));
    localStorage.setItem("rother.mode", '"discovery"');
    localStorage.setItem(
      "rother.business",
      JSON.stringify({
        id: "crate-cafe",
        name: "Crate Cafe",
        location: "Jl. Tanah Barak, Canggu, Badung, Bali",
      }),
    );
    localStorage.setItem("rother.runStarted", "true");
  });
}

async function openConfig(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Tools Account, config and export/ }).click();
  await page.getByRole("button", { name: /Configuration/ }).first().click();
  await expect(page.getByText("Competitors").first()).toBeVisible({ timeout: 10_000 });
}

async function serverCompetitorIds(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  const stored = (await (await page.request.get("/api/business/branches")).json()) as {
    branches?: { competitors: { competitor_id: string }[] }[];
  };
  return (stored.branches ?? []).flatMap((b) => b.competitors.map((c) => c.competitor_id));
}

test("config: removed competitor stays removed after reload", async ({ page }) => {
  await seedBusiness(page);
  await seedCompetitor(page, "revolver-seminyak");
  await seedClientState(page);
  await openConfig(page);

  await expect(page.getByText("Revolver Seminyak").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Remove competitor" }).click();
  await expect(page.getByText("Competitor removed")).toBeVisible({ timeout: 10_000 });

  // Server truth: gone.
  await expect
    .poll(async () => (await serverCompetitorIds(page)).join(","), {
      timeout: 10_000,
      intervals: [500],
    })
    .not.toContain("revolver-seminyak");

  // And stays gone after a full reload (the original symptom).
  await page.reload();
  await openConfig(page);
  await expect(page.getByText("No competitors added yet")).toBeVisible({ timeout: 10_000 });
});

test("config: added competitor persists after reload (dedupe guard)", async ({ page }) => {
  await seedBusiness(page);
  await seedCompetitor(page, "revolver-seminyak");
  await seedClientState(page);
  await openConfig(page);

  await expect(page.getByText("Revolver Seminyak").first()).toBeVisible({ timeout: 10_000 });

  // Re-adding the SAME competitor via the config input must hit the dedupe
  // guard — no duplicate row may appear.
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(REVOLVER_LINK);
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText("Already added").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Remove competitor" })).toHaveCount(1);

  // Now add a DIFFERENT competitor (mock returns empty for unknown links, so
  // use the crate link which resolves to a different place).
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(
    "https://maps.app.goo.gl/dCBcNxfk2fDjbDUC9",
  );
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByRole("button", { name: "Remove competitor" })).toHaveCount(2, {
    timeout: 10_000,
  });

  // Reload — BOTH adds persist (the original bug: silent 400 on add).
  await page.reload();
  await openConfig(page);
  // Scope to the config list (role=list) — the TopBar also renders a hidden
  // "Crate Cafe" span that getByText().first() would match on Mobile.
  const configList = page.getByRole("list");
  await expect(configList.getByText("Revolver Seminyak")).toBeVisible({ timeout: 10_000 });
  await expect(configList.getByText("Crate Cafe")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Remove competitor" })).toHaveCount(2);
});

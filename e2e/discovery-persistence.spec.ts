import { test, expect } from "@playwright/test";

/**
 * P0-1 Fix A regression — Discovery persistence via the skip-branches path.
 *
 * Reproduces the exact user flow that dropped competitors before this fix:
 *   paste link → validate → continue → Step 1 continue
 *   → Step 2 SKIP (empty own-branches) → Step 3 add competitor
 *   → click Start Monitoring
 *
 * Asserts the POST /api/business/branches payload carries an auto-created
 * branch (derived from the business) containing the added competitor —
 * previously the whole block was gated behind branchList.length > 0 and
 * competitors were silently discarded.
 */

const CRATE_CAFE_LINK = "https://maps.app.goo.gl/dCBcNxfk2fDjbDUC9";
const REVOLVER_LINK = "https://maps.app.goo.gl/FEkM7q8dPc8DrPiQ6";

/**
 * Offline-deterministic /api/places mock. Live short-link resolution depends
 * on Google's redirect service, which throttles bursts — repeat-each runs of
 * these tests produced flaky "Could not resolve that link" failures
 * (SYSTEMS_FIX_PLAN.md Phase A). place_id uses the real ChIJ ids captured in
 * LIVE_SCRAPING_AUDIT_2026-08-20.md; the "gmaps/" prefix is what the
 * onboarding/login flows slice off.
 */
const MOCK_PLACES: Record<string, {
  place_id: string; name: string; formatted_address: string;
  lat: number; lng: number; provider: string;
}> = {
  [CRATE_CAFE_LINK]: {
    place_id: "gmaps/ChIJOaEQDnk40i0Rzhou4NcRx-w",
    name: "Crate Cafe",
    formatted_address: "Jl. Tanah Barak, Canggu, Badung, Bali",
    lat: -8.6478, lng: 115.1385, provider: "gmaps",
  },
  [REVOLVER_LINK]: {
    place_id: "gmaps/ChIJ9fhCoBBH0i0R4h17JYdA484",
    name: "Revolver Seminyak",
    formatted_address: "Jl. Kayu Aya No.X, Seminyak, Badung, Bali",
    lat: -8.6843706, lng: 115.1579758, provider: "gmaps",
  },
};

async function mockPlacesApi(page: import("@playwright/test").Page) {
  await page.route("**/api/places*", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    const entry = Object.entries(MOCK_PLACES).find(([link]) =>
      q.includes(link) || link.includes(q),
    );
    if (entry) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ places: [entry[1]], provider: "gmaps" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ places: [] }),
      });
    }
  });
}

test("skip-branches onboarding persists added competitors", async ({ page }) => {
  await mockPlacesApi(page);
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  // Landing → validate Crate Cafe short link.
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(CRATE_CAFE_LINK);
  await page.getByRole("button", { name: /Validate link/ }).click();
  await expect(page.getByText("Crate Cafe").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Continue to monitoring/ }).click();

  // Onboarding step 1 — business pre-filled → Continue.
  await expect(page.getByText("Crate Cafe").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^Continue/ }).click();

  // Step 2 — SKIP own branches (the path that used to drop competitors).
  await expect(page.getByText("Add your own branch locations")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Skip for now/ }).click();

  // Step 3 — add one competitor.
  await expect(page.getByText("Add competitors to monitor")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(REVOLVER_LINK);
  await page.getByRole("button", { name: /Add/ }).click();
  // Wait on the committed LIST ITEM (via its Remove button), not the raw
  // name text — the sonner "Competitor added" toast renders from an external
  // store BEFORE React commits competitorList, so a text-only wait can click
  // Start Monitoring with a stale empty closure under load
  // (SYSTEMS_FIX_PLAN.md Phase A).
  await expect(page.getByRole("button", { name: "Remove competitor" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Revolver Seminyak").first()).toBeVisible({ timeout: 15_000 });

  // Click Start Monitoring and capture the branches persistence call.
  // Force fixtures mode so the spawned scrape is instant — otherwise the
  // multi-minute LIVE run blocks every later test via Fix C's honest
  // "already running" state.
  await page.route("**/api/scrape/trigger*", async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("mode", "fixtures");
    await route.continue({ url: url.toString() });
  });
  const branchesPost = page.waitForResponse(
    (r) => r.url().includes("/api/business/branches") && r.request().method() === "POST",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: /Start Monitoring/ }).click();
  const resp = await branchesPost;

  const body = resp.request().postDataJSON() as {
    branches?: { branch_id: string; competitors: { competitor_id: string }[] }[];
  };
  expect(body.branches?.length).toBeGreaterThan(0);

  const auto = body.branches![0];
  expect(auto.branch_id).toBe("crate-cafe"); // auto-created from the business
  expect(auto.competitors.map((c) => c.competitor_id)).toContain("revolver-seminyak");

  // Server-side confirmation too — polled for the same shared-server-state
  // reasons documented in the self-monitoring test below.
  await expect
    .poll(
      async () => {
        const stored = (await (await page.request.get("/api/business/branches")).json()) as {
          branches?: { competitors: { competitor_id: string }[] }[];
        };
        return (stored.branches ?? []).flatMap(
          (b) => b.competitors.map((c) => c.competitor_id),
        );
      },
      { timeout: 15_000, intervals: [750] },
    )
    .toContain("revolver-seminyak");
});

test("self-monitoring: active business is always a scrape target + joins into overview", async ({ page }) => {
  await mockPlacesApi(page);
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  // Same skip-branches onboarding flow as the persistence test above.
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(CRATE_CAFE_LINK);
  await page.getByRole("button", { name: /Validate link/ }).click();
  await expect(page.getByText("Crate Cafe").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Continue to monitoring/ }).click();
  await expect(page.getByText("Crate Cafe").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByText("Add your own branch locations")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Skip for now/ }).click();
  await expect(page.getByText("Add competitors to monitor")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(REVOLVER_LINK);
  await page.getByRole("button", { name: /Add/ }).click();
  // Same committed-list-item wait as the sibling test (toast-vs-state race).
  await expect(page.getByRole("button", { name: "Remove competitor" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Revolver Seminyak").first()).toBeVisible({ timeout: 15_000 });

  await page.route("**/api/scrape/trigger*", async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("mode", "fixtures");
    await route.continue({ url: url.toString() });
  });
  // Race-safety: capture BOTH persistence calls BEFORE clicking Start
  // Monitoring, and await them before asserting. The original bug report for
  // this spec family was a Mobile-path flake where the GET assertions raced
  // ahead of the server-side persist (SYSTEMS_AUDIT_2026-08-24.md §1b).
  const branchesPost = page.waitForResponse(
    (r) => r.url().includes("/api/business/branches") && r.request().method() === "POST",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: /Start Monitoring/ }).click();
  await branchesPost;
  await expect(page.getByText(/Monitoring|Running|Dashboard/i).first()).toBeVisible({
    timeout: 20_000,
  });

  // INVARIANT 1 — stored config stays competitor-only (self is synthetic,
  // never persisted to user-business.json).
  //
  // expect.poll, not a single-shot GET: the dev server serves MULTIPLE tests
  // against ONE mutable `user-business.json`, and a PRIOR test's in-flight
  // onboarding chain (smoke's discovery flow posts the same endpoints) can
  // still be settling when this test reads. Windows also lacks atomic
  // writeFile, so a read racing a rewrite can transiently observe a
  // branches-less file (SYSTEMS_FIX_PLAN.md Phase A). Poll until the write
  // we caused is observable; only fail after the poll window expires.
  let lastFlat: string[] = [];
  await expect
    .poll(
      async () => {
        const res = await page.request.get("/api/business/branches");
        const text = await res.text();
        let stored: { branches?: { competitors: { competitor_id: string }[] }[] } = {};
        try {
          stored = JSON.parse(text);
        } catch {
          stored = {};
        }
        lastFlat = (stored.branches ?? []).flatMap(
          (b) => b.competitors.map((c) => c.competitor_id),
        );
        return lastFlat;
      },
      { timeout: 15_000, intervals: [750] },
    )
    .toContain("revolver-seminyak");
  expect(lastFlat).not.toContain("crate-cafe");

  // INVARIANT 2 — overview join includes BOTH the business itself
  // (self=true, honest zeros pre-scrape) and the real competitor.
  // Same eventual-consistency reasoning → poll until both rows appear.
  await expect
    .poll(
      async () => {
        const overview = (await (await page.request.get("/api/overview")).json()) as {
          totalCompetitors: number;
          competitorStats: { competitor_id: string; self?: boolean }[];
        };
        const stats = new Map(overview.competitorStats.map((s) => [s.competitor_id, s]));
        const ok =
          stats.get("crate-cafe")?.self === true &&
          stats.has("revolver-seminyak") &&
          !stats.get("revolver-seminyak")?.self &&
          overview.totalCompetitors >= 2;
        return ok;
      },
      { timeout: 15_000, intervals: [750] },
    )
    .toBe(true);

  // INVARIANT 3 — branches API carries the self flag through to the UI.
  await expect
    .poll(
      async () => {
        const b = (await (await page.request.get("/api/branches")).json()) as {
          branches: { competitors: { competitor_id: string; self?: boolean }[] }[];
        };
        return b.branches.flatMap((x) => x.competitors).find(
          (r) => r.competitor_id === "crate-cafe",
        )?.self;
      },
      { timeout: 15_000, intervals: [750] },
    )
    .toBe(true);
});

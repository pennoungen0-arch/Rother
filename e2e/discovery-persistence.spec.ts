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

test("skip-branches onboarding persists added competitors", async ({ page }) => {
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

  // Server-side confirmation too.
  const stored = await (await page.request.get("/api/business/branches")).json();
  const flat = (stored.branches ?? []).flatMap(
    (b: { competitors: { competitor_id: string }[] }) => b.competitors.map((c) => c.competitor_id),
  );
  expect(flat).toContain("revolver-seminyak");
});

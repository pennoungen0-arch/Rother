import { test, expect } from "@playwright/test";

/**
 * Smoke test — the critical first-run flow in FIXED-list mode (Phase 1):
 *   login (mock) → mode picker defaults to fixed → run gate → hub revealed.
 *
 * Requires a running dev server with the committed Aug-13 production data
 * (12 competitors / 5,021 reviews).
 */

test("fixed-mode flow: login → run gate → hub → feature renders data", async ({
  page,
}) => {
  // Clear any previous session so we start at the login screen.
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 1. Login screen with mode picker (default = fixed).
  await expect(page.getByText("Monitoring mode")).toBeVisible();
  await expect(page.getByText("Fixed competitor list")).toBeVisible();
  await expect(page.getByText("My business + discovery")).toBeVisible();

  // 2. Sign in (mock Gmail).
  await page.getByRole("button", { name: /Sign in with Gmail/ }).click();
  await page.getByText("Signing in…").waitFor({ state: "hidden", timeout: 10_000 });

  // Fixed mode skips onboarding → run gate.
  await expect(page.getByText("Start monitoring your competitor list")).toBeVisible();

  // 3. Press Run — reveals the hubs regardless of scrape outcome.
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("What do you want to look at?")).toBeVisible({
    timeout: 15_000,
  });

  // 4. Open the Competitors hub, then the Leaderboard feature.
  await page.getByRole("button", { name: /Competitors See how you stack up/ }).click();
  await page.getByRole("button", { name: /Leaderboard/ }).click();
  await expect(page.getByText("Competitor Leaderboard")).toBeVisible({
    timeout: 15_000,
  });
});

test("KPI feature renders the committed production dataset", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Sign in with Gmail/ }).click();
  await page.getByText("Signing in…").waitFor({ state: "hidden", timeout: 10_000 });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("What do you want to look at?")).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /Insights Your business health/ }).click();
  await page.getByRole("button", { name: /KPIs/ }).click();

  // The KPI row reads /api/overview — 5,001 total reviews + 12 competitors.
  await expect(page.getByText("5001")).toBeVisible({ timeout: 15_000 });
});
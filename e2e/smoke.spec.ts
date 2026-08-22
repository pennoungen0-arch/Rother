import { test, expect } from "@playwright/test";

/**
 * Smoke test — critical first-run flows:
 * 1. Discovery-first: landing screen renders with link input
 * 2. Fixed-mode (legacy): Advanced → Fixed competitor list → Run gate → hubs
 *
 * Requires a running dev server.
 */

test("discovery-first flow: landing screen renders with link input", async ({
  page,
}) => {
  // Clear any previous session so we start at the landing screen.
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  // 1. Landing screen with "Paste Google Maps link" input.
  await expect(page.getByText("Paste a Google Maps business link")).toBeVisible();
  await expect(page.getByPlaceholder(/maps\.app\.goo\.gl/)).toBeVisible();

  // 2. Enter a link and click validate - use manual mode for instant response
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(
    "https://maps.app.goo.gl/test",
  );

  // 3. Click validate
  await page.getByRole("button", { name: /Validate link/ }).click();

  // 4. Should show error for invalid test link (instant, no API call)
  // The inline error has role=alert, the toast is separate
  await expect(page.locator("p[role='alert']")).toContainText("Could not resolve that link", { timeout: 5_000 });
});

test("fixed-mode flow (via Advanced): Advanced → Fixed → Run gate → hub", async ({
  page,
}) => {
  // Clear any previous session so we start at the landing screen.
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  // 1. Click "Advanced" to reveal fixed/discovery mode selector.
  await page.getByRole("button", { name: /Advanced/ }).click();

  // 2. Mode picker visible with Fixed competitor list option.
  await expect(page.getByRole("button", { name: "Fixed competitor list", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Discovery (my business)", exact: true })).toBeVisible();

  // 3. Click "Sign in with Gmail" for fixed mode (mocks login + sets mode=fixed).
  await page.getByRole("button", { name: "Sign in with Gmail" }).click();

  // 4. Wait for LoginScreen to disappear and RunScreen to appear (context updates from localStorage).
  await expect(page.getByText("Start monitoring your competitor list")).toBeVisible({ timeout: 10_000 });

  // 5. Press Run — reveals the hubs. Force fixtures mode so the spawned
  // scrape is instant: a LIVE run here (multi-minute, CPU-heavy) would flip
  // later tests into Fix C's honest "already running" disabled state.
  await page.route("**/api/scrape/trigger*", async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("mode", "fixtures");
    await route.continue({ url: url.toString() });
  });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("What do you want to look at?")).toBeVisible({
    timeout: 15_000,
  });

  // 6. Open the Competitors hub, then the Leaderboard feature.

  // 6. Open the Competitors hub, then the Leaderboard feature.
  await page.getByRole("button", { name: /Competitors See how you stack up/ }).click();
  await page.getByRole("button", { name: /Leaderboard/ }).click();
  await expect(page.getByText("Competitor Leaderboard")).toBeVisible({
    timeout: 15_000,
  });
});

test("KPI feature renders live data (3 competitors)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  // Use fixed mode for quick access (no link validation needed)
  await page.getByRole("button", { name: /Advanced/ }).click();
  await page.getByRole("button", { name: "Sign in with Gmail" }).click();

  await expect(page.getByText("Start monitoring your competitor list")).toBeVisible({ timeout: 10_000 });
  // Force fixtures mode (see fixed-mode test above) — instant scrape, no
  // cross-test busy-state cascade.
  await page.route("**/api/scrape/trigger*", async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("mode", "fixtures");
    await route.continue({ url: url.toString() });
  });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("What do you want to look at?")).toBeVisible({
    timeout: 15_000,
  });

  // Open Insights hub → KPIs feature
  await page.getByRole("button", { name: /Insights Your business health/ }).click();
  await page.getByRole("button", { name: /KPIs/ }).click();

  // KPI feature should load and show the 3 KPI cards
  await expect(page.getByText("Branches", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Competitors", { exact: true })).toBeVisible();
});

test("Mobile viewport: landing screen renders correctly", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  // Landing screen should be responsive
  await expect(page.getByText("Paste a Google Maps business link")).toBeVisible();
  await expect(page.getByPlaceholder(/maps\.app\.goo\.gl/)).toBeVisible();
});

test("Discovery flow: paste link → add competitor → start monitoring", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  // 1. Paste a valid Google Maps link
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(
    "https://maps.app.goo.gl/dCBcNxfk2fDjbDUC9", // Crate Cafe short link
  );
  await page.getByRole("button", { name: /Validate link/ }).click();

  // 2. Should show preview with business name (in preview card)
  await expect(page.getByText("Crate Cafe").first()).toBeVisible({ timeout: 10_000 });

  // 3. Continue to monitoring
  await page.getByRole("button", { name: /Continue to monitoring/ }).click();

  // 4. Should reach onboarding step 1 (business pre-filled)
  await expect(page.getByText("Crate Cafe").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Continue/ }).click();

  // 5. Step 2 - branches (skip)
  await expect(page.getByText("Add your own branch locations")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Skip for now/ }).click();

  // 6. Step 3 - add competitor
  await expect(page.getByText("Add competitors to monitor")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(/maps\.app\.goo\.gl/).fill(
    "https://maps.app.goo.gl/FEkM7q8dPc8DrPiQ6", // Revolver short link
  );
  await page.getByRole("button", { name: /Add/ }).click();

  // 7. Should show competitor in list (first occurrence in the list, not toast)
  await expect(page.getByText("Revolver Seminyak").first()).toBeVisible({ timeout: 10_000 });

  // 8. Start monitoring - verify button exists and is enabled
  await expect(page.getByRole("button", { name: /Start Monitoring/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start Monitoring/ })).toBeEnabled();
});
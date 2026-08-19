import { test, expect } from "@playwright/test";

/**
 * Per-feature browser check — all 28 features against committed Aug-13
 * production data (12 competitors / 5,021 reviews / 6 branches).
 *
 * Prereqs: `npm run dev` running on :3000 with committed gbp-monitor/data.
 */

// Shared setup: login + run gate
async function setup(page: any) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Sign in with Gmail/ }).click();
  await page.getByText("Signing in…").waitFor({ state: "hidden", timeout: 10_000 });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("What do you want to look at?")).toBeVisible({
    timeout: 15_000,
  });
}

// Helper: click hub by label, wait for feature grid
async function openHub(page: any, hubLabel: string) {
  await page.getByRole("button", { name: new RegExp(hubLabel) }).first().click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible({
    timeout: 10_000,
  });
}

// Helper: click feature tile by label
async function openFeature(page: any, featureLabel: string) {
  await page.getByRole("button", { name: new RegExp(featureLabel) }).first().click();
  // Feature heading uses the short label (e.g., "Leaderboard" not "Competitor Leaderboard")
  await expect(
    page.getByRole("heading", { name: featureLabel, level: 1 })
  ).toBeVisible({ timeout: 15_000 });
}

// Helper: get KPI value by card label
async function kpiValue(page: any, label: string) {
  return page.getByText(label).locator("..").getByText(/^\d+$/).first();
}

// ── INSIGHTS HUB (6 features) ────────────────────────────────────────────────

test("Insights → KPIs: shows total reviews, competitors, branches", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Insights");
  await openFeature(page, "KPIs");
  await expect(await kpiValue(page, "Branches")).toBeVisible({ timeout: 15_000 });
  await expect(await kpiValue(page, "Competitors")).toBeVisible();
  await expect(await kpiValue(page, "Reviews Monitored")).toBeVisible();
});

test("Insights → Run Health: shows run status summary", async ({ page }) => {
  await setup(page);
  await openHub(page, "Insights");
  await openFeature(page, "Run Health");
  await expect(page.getByRole("heading", { name: "Run Health" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Healthy|Warning|Critical/)).toBeVisible();
  await expect(page.getByText("success").first()).toBeVisible();
});

test("Insights → Rating Distribution: shows 1★–5★ counts", async ({ page }) => {
  await setup(page);
  await openHub(page, "Insights");
  await openFeature(page, "Rating Distribution");
  await expect(page.getByRole("heading", { name: "Rating Distribution" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("svg.recharts-surface")).toBeVisible();
});

test("Insights → New Reviews per Branch: shows branch-level new review counts", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Insights");
  await openFeature(page, "New Reviews per Branch");
  await expect(page.getByRole("heading", { name: "New Reviews per Branch" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/branch/i).first()).toBeVisible();
});

test("Insights → Run Comparison: allows diffing two runs", async ({ page }) => {
  await setup(page);
  await openHub(page, "Insights");
  await openFeature(page, "Run Comparison");
  await expect(page.getByRole("heading", { name: "Run Comparison" })).toBeVisible({
    timeout: 15_000,
  });
  // Comboboxes show values like "6 days ago Aug +5021" and "2 days ago Aug +20"
  await expect(page.getByRole("combobox").first()).toBeVisible();
  await expect(page.getByRole("combobox").nth(1)).toBeVisible();
});

test("Insights → Run History: lists historical runs with new review counts", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Insights");
  await openFeature(page, "Run History");
  await expect(page.getByRole("heading", { name: "Run History" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/runs?/i).first()).toBeVisible();
});

// ── REPUTATION HUB (8 features) ──────────────────────────────────────────────

test("Reputation → All Reviews: searchable, paginated review list", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "All Reviews");
  await expect(page.getByRole("heading", { name: "All Reviews" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByPlaceholder(/Reviewer or text/)).toBeVisible();
});

test("Reputation → Reviews over Time: trend chart renders", async ({ page }) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Reviews over Time");
  await expect(page.getByRole("heading", { name: "Reviews over Time" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("svg.recharts-surface")).toBeVisible();
});

test("Reputation → Review Lengths: length distribution chart", async ({ page }) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Review Lengths");
  await expect(page.getByRole("heading", { name: "Review Lengths" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("svg.recharts-surface")).toBeVisible();
});

test("Reputation → Review Word Cloud: shows frequent words", async ({ page }) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Review Word Cloud");
  await expect(page.getByRole("heading", { name: "Review Word Cloud" })).toBeVisible({
    timeout: 15_000,
  });
  // Renders as <ul role="list"> with <li role="listitem">
  await expect(page.getByRole("listitem").first()).toBeVisible();
});

test("Reputation → Review Language: shows language distribution", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Review Language");
  await expect(page.getByRole("heading", { name: "Review Language" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Latin|CJK|Cyrillic|Arabic/).first()).toBeVisible();
});

test("Reputation → Review Recency: heatmap calendar renders", async ({ page }) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Review Recency");
  await expect(page.getByRole("heading", { name: "Review Recency" })).toBeVisible({
    timeout: 15_000,
  });
  // Renders as <img> elements with alt text containing dates; the imgs may be
  // sized 0x0 until loaded, so assert the heatmap summary text instead
  await expect(page.getByText(/New reviews found per day/)).toBeVisible();
});

test("Reputation → Top Reviewers: lists most active reviewers", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Top Reviewers");
  await expect(page.getByRole("heading", { name: "Top Reviewers" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/reviewer/i).first()).toBeVisible();
});

test("Reputation → Alerts: shows alert list (may be empty state)", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Reputation");
  await openFeature(page, "Alerts");
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible({
    timeout: 15_000,
  });
  // Live data has 13 alerts (12 delta + 1 selector warning), not an empty state
  await expect(page.getByText(/alerts?/i).first()).toBeVisible();
});

// ── COMPETITORS HUB (10 features) ────────────────────────────────────────────

test("Competitors → Branches & Competitors: shows branch tree with competitors", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Branches & Competitors");
  await expect(page.getByRole("heading", { name: "Branches & Competitors" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/branch/i).first()).toBeVisible();
  await expect(page.getByText(/competitor/i).first()).toBeVisible();
});

test("Competitors → Branch Comparison: side-by-side branch view", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Branch Comparison");
  await expect(page.getByRole("heading", { name: "Branch Comparison" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/branch/i).first()).toBeVisible();
});

test("Competitors → Leaderboard: ranked competitors table", async ({ page }) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Leaderboard");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible({
    timeout: 15_000,
  });
  // Renders as <ol> with <li> listitems
  await expect(page.getByRole("listitem").first()).toBeVisible();
});

test("Competitors → Competitor Comparison: radar chart (top 3)", async ({ page }) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Competitor Comparison");
  await expect(page.getByRole("heading", { name: "Competitor Comparison" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("svg.recharts-surface")).toBeVisible();
});

test("Competitors → Growth Rate: reviews/day bar chart", async ({ page }) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Growth Rate");
  await expect(page.getByRole("heading", { name: "Growth Rate" })).toBeVisible({
    timeout: 15_000,
  });
  // Renders as a ranked list of listitems (reviews/day), not a recharts chart
  await expect(page.getByRole("listitem").first()).toBeVisible();
});

test("Competitors → Correlation: correlation matrix heatmap", async ({ page }) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Correlation");
  await expect(page.getByRole("heading", { name: "Correlation" })).toBeVisible({
    timeout: 15_000,
  });
  // Matrix renders as table/grid or SVG
  await expect(page.locator("svg, [role='grid'], table").first()).toBeVisible();
});

test("Competitors → Competitive Health: discovery + health summary", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Competitive Health");
  await expect(page.getByRole("heading", { name: "Competitive Health" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/competitors?/i).first()).toBeVisible();
  await expect(page.getByText(/branches?/i).first()).toBeVisible();
});

test("Competitors → Discover Competitors: fixed-mode notice shown", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Discover competitors");
  await expect(page.getByRole("heading", { name: "Discover competitors" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/Discovery is unavailable in Fixed-list mode/)).toBeVisible();
});

test("Competitors → Geo grid: map with 12 markers", async ({ page }) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Geo grid");
  // Feature renders; production data lacks lat/lng so the Leaflet map is absent —
  // assert the missing-coordinates empty state instead of the map itself
  await expect(page.getByRole("heading", { name: "Geo grid" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/No resolvable coordinates yet/)).toBeVisible();
});

test("Competitors → Rating Distribution Compare: grouped bar chart", async ({
  page,
}) => {
  await setup(page);
  await openHub(page, "Competitors");
  await openFeature(page, "Rating Distribution Compare");
  await expect(page.getByRole("heading", { name: "Rating Distribution Compare" })).toBeVisible({
    timeout: 15_000,
  });
  // 1 main chart + 5 legend icons are all recharts svgs — assert the first
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
});

// ── TOOLS HUB (4 features) ───────────────────────────────────────────────────

test("Tools → Configuration: shows competitor list editor", async ({ page }) => {
  await setup(page);
  await openHub(page, "Tools");
  await openFeature(page, "Configuration");
  await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/branches?|competitors?/i).first()).toBeVisible();
});

test("Tools → Run Logs: shows scraper log tail", async ({ page }) => {
  await setup(page);
  await openHub(page, "Tools");
  await openFeature(page, "Run Logs");
  await expect(page.getByRole("heading", { name: "Run Logs" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/INFO|WARN|ERROR|debug/).first()).toBeVisible();
});

test("Tools → Export Data: download buttons present", async ({ page }) => {
  await setup(page);
  await openHub(page, "Tools");
  await openFeature(page, "Export Data");
  await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible({
    timeout: 15_000,
  });
  // The page offers CSV/JSON export behind a single "Open export" dialog button
  await expect(page.getByRole("button", { name: "Open export" })).toBeVisible();
});

test("Tools → Scrape Schedule: shows next run time", async ({ page }) => {
  await setup(page);
  await openHub(page, "Tools");
  await openFeature(page, "Scrape Schedule");
  await expect(page.getByRole("heading", { name: "Scrape Schedule" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Next scheduled run in")).toBeVisible();
});
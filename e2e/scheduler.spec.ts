import { test, expect } from "@playwright/test";

/**
 * Scheduler e2e (Phase C coverage gap from VERSION_AUDIT §6).
 *
 * The Scheduler card lives inside Tools › Configuration and renders only in
 * discovery mode (t-config's fixed branch returns before it). To reach it
 * deterministically — without walking link-validation + 3-step onboarding —
 * we seed the localStorage-backed app state directly:
 *   user + business + mode=discovery + runStarted → AppShell lands on Hub.
 *
 * Also verifies persistence through GET/PATCH /api/schedule, restoring the
 * original config at the end.
 */

const SEED_USER = { name: "Business Owner", email: "owner@gmail.com" };
const SEED_BUSINESS = {
  id: "crate-cafe",
  name: "Crate Cafe",
  location: "Crate Cafe",
};

async function seedDiscoverySession(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.evaluate(
    ([user, business]) => {
      localStorage.setItem("rother.user", JSON.stringify(user));
      localStorage.setItem("rother.business", JSON.stringify(business));
      localStorage.setItem("rother.mode", JSON.stringify("discovery"));
      localStorage.setItem("rother.runStarted", JSON.stringify(true));
    },
    [SEED_USER, SEED_BUSINESS],
  );
  await page.reload();
}

test("scheduler card: toggle + interval persist to /api/schedule", async ({
  page,
}) => {
  const initial = await (await page.request.get("/api/schedule")).json();

  await seedDiscoverySession(page);

  // Hub revealed directly (runStarted seeded).
  await expect(page.getByText("What do you want to look at?")).toBeVisible({
    timeout: 15_000,
  });

  // Tools hub → Configuration feature.
  await page.getByRole("button", { name: /Tools Account, config/ }).click();
  await page.getByRole("button", { name: /Configuration Manage monitored/ }).click();

  // Scheduler card renders below the business card.
  const autoScraping = page.getByText("Automatic scraping");
  await expect(autoScraping).toBeVisible({ timeout: 15_000 });

  // ── Toggle ────────────────────────────────────────────────────────────
  const toggle = page.getByRole("button", { name: /^(Enabled|Disabled)$/ });
  const wasEnabled = (await toggle.textContent())?.includes("Enabled");
  await toggle.click();
  await expect(
    page.getByRole("button", {
      name: wasEnabled ? /^Disabled$/ : /^Enabled$/,
    }),
  ).toBeVisible({ timeout: 10_000 });

  let after = await (await page.request.get("/api/schedule")).json();
  expect(after.enabled).toBe(!wasEnabled);

  // ── Interval select (radix) ───────────────────────────────────────────
  // The Select only renders while enabled — flip back ON if the toggle hid it.
  if (!after.enabled) {
    await page.getByRole("button", { name: /^Disabled$/ }).click();
    await expect(
      page.getByRole("button", { name: /^Enabled$/ }),
    ).toBeVisible({ timeout: 10_000 });
  }
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Every 6 hours" }).click();
  await expect(
    page.getByRole("combobox").filter({ hasText: "Every 6 hours" }),
  ).toBeVisible({ timeout: 10_000 });

  after = await (await page.request.get("/api/schedule")).json();
  expect(after.intervalHours).toBe(6);

  // ── Restore original config so the test is side-effect free ──────────
  await page.request.patch("/api/schedule", {
    data: {
      enabled: initial.enabled,
      intervalHours: initial.intervalHours,
    },
  });
  const restored = await (await page.request.get("/api/schedule")).json();
  expect(restored.enabled).toBe(initial.enabled);
  expect(restored.intervalHours).toBe(initial.intervalHours);
});

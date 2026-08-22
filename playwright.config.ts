import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke tests for the converged dashboard (v2 shell on v1 pipeline).
 *
 * Requires a running dev server on :3000 (fixed-list mode is the default).
 * Run: `npx playwright test`
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  projects: [
    { name: "Desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } } },
  ],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  reporter: "list",
});
import { defineConfig } from "@playwright/test";

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
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  reporter: "list",
});
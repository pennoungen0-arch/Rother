import type { Page } from "@playwright/test";

/**
 * Offline-deterministic /api/places mock — shared by e2e specs.
 *
 * Live short-link resolution depends on Google's redirect service, which
 * throttles bursts; repeat runs produced flaky "Could not resolve that link"
 * failures (SYSTEMS_FIX_PLAN.md Phase A). place_id values are the real ChIJ
 * ids captured in LIVE_SCRAPING_AUDIT_2026-08-20.md; the "gmaps/" prefix is
 * what the onboarding/login flows slice off.
 */
export const MOCK_PLACES: Record<
  string,
  {
    place_id: string;
    name: string;
    formatted_address: string;
    lat: number;
    lng: number;
    provider: string;
  }
> = {
  "https://maps.app.goo.gl/dCBcNxfk2fDjbDUC9": {
    place_id: "gmaps/ChIJOaEQDnk40i0Rzhou4NcRx-w",
    name: "Crate Cafe",
    formatted_address: "Jl. Tanah Barak, Canggu, Badung, Bali",
    lat: -8.6478,
    lng: 115.1385,
    provider: "gmaps",
  },
  "https://maps.app.goo.gl/FEkM7q8dPc8DrPiQ6": {
    place_id: "gmaps/ChIJ9fhCoBBH0i0R4h17JYdA484",
    name: "Revolver Seminyak",
    formatted_address: "Jl. Kayu Aya No.X, Seminyak, Badung, Bali",
    lat: -8.6843706,
    lng: 115.1579758,
    provider: "gmaps",
  },
};

export async function mockPlacesApi(page: Page) {
  await page.route("**/api/places*", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    const entry = Object.entries(MOCK_PLACES).find(
      ([link]) => q.includes(link) || link.includes(q),
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

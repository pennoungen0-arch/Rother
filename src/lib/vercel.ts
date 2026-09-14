/**
 * Vercel environment detection for client-side code.
 * Uses NEXT_PUBLIC_VERCEL env var set in vercel.json.
 */
export function isVercel(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_VERCEL === "1";
}

/**
 * Check if a feature should be hidden on Vercel.
 * Features that require Python, Playwright, or filesystem writes.
 */
export function isVercelOnlyFeature(featureId: string): boolean {
  const vercelBlockedFeatures = new Set([
    "t-setup",           // Scraper Setup Wizard - needs Python/pip/Playwright
    "t-scheduler",       // Scheduler - writes schedule.json + triggers scrape
  ]);
  return isVercel() && vercelBlockedFeatures.has(featureId);
}
/**
 * Remote data fetcher for Vercel deployment.
 * Fetches scraped data from GitHub data branch via raw.githubusercontent.com.
 * Used when running on Vercel (no local filesystem access to gbp-monitor/data).
 */

import type {
  HarvestInfo,
  ListingsConfig,
  Review,
  RunSummary,
  SelectorsConfig,
  SnapshotEntry,
} from "./types";

const GITHUB_REPO = "pennoungen0-arch/Rother";
const DATA_BRANCH = "data";
const DATA_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${DATA_BRANCH}/gbp-monitor`;

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; ts: number }>();

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.value as T;
  }
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`[remote-data] ${res.status} ${res.statusText}: ${url}`);
      return fallback;
    }
    const data = (await res.json()) as T;
    cache.set(url, { value: data, ts: now });
    return data;
  } catch (err) {
    console.error(`[remote-data] fetch failed: ${url}`, err);
    return fallback;
  }
}

export async function fetchListings(): Promise<ListingsConfig> {
  return fetchJson<ListingsConfig>(`${DATA_BASE_URL}/config/listings.json`, { branches: [] });
}

export async function fetchSelectors(): Promise<SelectorsConfig | null> {
  return fetchJson<SelectorsConfig | null>(`${DATA_BASE_URL}/config/selectors.json`, null);
}

export async function fetchRunSummary(): Promise<RunSummary | null> {
  return fetchJson<RunSummary | null>(`${DATA_BASE_URL}/data/run_summary.json`, null);
}

export async function fetchRunLog(): Promise<string> {
  try {
    const res = await fetch(`${DATA_BASE_URL}/data/run.log`, { next: { revalidate: 60 } });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

export async function fetchAllSnapshots(): Promise<Map<string, Review[]>> {
  const listings = await fetchListings();
  const out = new Map<string, Review[]>();
  for (const branch of listings.branches) {
    for (const comp of branch.competitors ?? []) {
      const competitorId = comp.competitor_id;
      if (!competitorId) continue;
      const reviews = await fetchSnapshot(competitorId);
      if (reviews.length > 0) {
        out.set(competitorId, reviews);
      }
    }
  }
  return out;
}

export async function fetchSnapshot(competitorId: string): Promise<Review[]> {
  // latest.json is a pointer to the actual snapshot file (e.g. "2026-09-13T11-32-32Z.json")
  const filename = await fetchJson<string | null>(
    `${DATA_BASE_URL}/data/snapshots/${competitorId}/latest.json`,
    null
  );
  if (!filename || typeof filename !== "string") return [];
  return fetchJson<Review[]>(
    `${DATA_BASE_URL}/data/snapshots/${competitorId}/${filename}`,
    []
  );
}

export async function fetchHarvestInfo(competitorId: string): Promise<HarvestInfo | null> {
  // Get the actual snapshot filename from the pointer, then fetch its metadata
  const filename = await fetchJson<string | null>(
    `${DATA_BASE_URL}/data/snapshots/${competitorId}/latest.json`,
    null
  );
  if (!filename || typeof filename !== "string") return null;
  const metaFilename = filename.replace(/\.json$/, ".metadata.json");
  return fetchJson<HarvestInfo | null>(
    `${DATA_BASE_URL}/data/snapshots/${competitorId}/${metaFilename}`,
    null
  );
}

export async function fetchAllDeltas(): Promise<Array<{
  competitor_id: string;
  run_timestamp: string;
  filename: string;
  reviews: Review[];
}>> {
  const listings = await fetchListings();
  const out: Array<{
    competitor_id: string;
    run_timestamp: string;
    filename: string;
    reviews: Review[];
  }> = [];
  for (const branch of listings.branches) {
    for (const comp of branch.competitors ?? []) {
      const competitorId = comp.competitor_id;
      if (!competitorId) continue;
      try {
        const res = await fetch(`${DATA_BASE_URL}/data/reviews_new/`, { next: { revalidate: 60 } });
        if (!res.ok) continue;
        await res.text();
        // GitHub directory listing returns HTML, not JSON. 
        // For simplicity, we'll skip deltas in remote mode or use a different approach.
      } catch {
        // ignore
      }
    }
  }
  return out;
}

export async function listSnapshotTimestamps(competitorId: string): Promise<SnapshotEntry[]> {
  try {
    const res = await fetch(`${DATA_BASE_URL}/data/snapshots/${competitorId}/`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    await res.text();
    // Parse directory listing HTML for .json files
    // This is a fallback - in practice we'd want a manifest file
    return [];
  } catch {
    return [];
  }
}

export function isVercel(): boolean {
  return process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL === "1";
}

export function shouldUseRemoteData(): boolean {
  return isVercel() || process.env.USE_REMOTE_DATA === "true";
}
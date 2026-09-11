import * as React from "react";

/**
 * Data fetching utility that works in both local (API routes) and
 * static (GitHub Pages) modes.
 *
 * In local mode: fetches from /api/<route>
 * In static mode: fetches from /api/<route>.json (static files in public/api/)
 *
 * Detection: if API fetch returns 404, falls back to .json
 */

export interface FetchResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetch data that works in both local and static modes.
 * Returns a Response object (compatible with .ok / .json() pattern).
 * Tries /api/route first, falls back to /api/route.json for static export.
 */
export async function fetchAPI(path: string): Promise<Response> {
  const res = await fetch(path, { cache: "no-store" });
  if (res.ok) return res;

  // Fallback for static export: try .json file
  // Handles URLs with query params: /api/reviews?page=1 → /api/reviews.json?page=1
  if (res.status === 404) {
    const [basePath, queryString] = path.includes("?")
      ? path.split("?")
      : [path, ""];
    const jsonUrl = queryString ? `${basePath}.json?${queryString}` : `${basePath}.json`;
    const fallback = await fetch(jsonUrl, { cache: "no-store" });
    return fallback;
  }

  return res;
}

/**
 * Client hook that fetches data in dual-mode (API routes or static JSON).
 * Returns data, error, and loading state.
 * @param path The API route path (e.g., "/api/overview")
 * @param deps Dependency array for re-fetching
 */
export function useStaticData<T>(path: string, deps: React.DependencyList = []): FetchResult<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPI(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = (await res.json()) as T;
        if (!cancelled) {
          setData(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
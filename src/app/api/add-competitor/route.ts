/**
 * POST /api/add-competitor
 *
 * Adds a competitor to the monitored list via GitHub API.
 * This is the core of the Vercel paste-link flow:
 *   Client pastes Google Maps link → resolve to place_id → commit to data branch → trigger scraper
 *
 * Requires: GITHUB_PAT env var (GitHub Personal Access Token with contents:write scope)
 */

import { NextRequest, NextResponse } from "next/server";

const GITHUB_REPO = "pennoungen0-arch/Rother";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;
const DATA_BRANCH = "data";
const LISTINGS_PATH = "gbp-monitor/config/listings.json";

const PLACE_ID_RE = /^ChIJ[A-Za-z0-9_-]{20,}$/;

interface CompetitorConfig {
  competitor_id: string;
  name: string;
  gmaps_url: string;
  place_id: string;
}

interface BranchConfig {
  branch_id: string;
  branch_name: string;
  competitors: CompetitorConfig[];
}

interface ListingsConfig {
  _comment?: string;
  branches: BranchConfig[];
}

/**
 * Resolve a Google Maps URL to a place_id + name using the existing /api/places logic.
 */
async function resolveGmapsUrl(
  url: string,
): Promise<{ place_id: string; name: string } | null> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/places?q=${encodeURIComponent(url)}&limit=1`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.places || data.places.length === 0) return null;
    const place = data.places[0];
    const rawPlaceId = (place.place_id as string).replace(/^gmaps\//, "");
    if (!PLACE_ID_RE.test(rawPlaceId)) return null;
    return { place_id: rawPlaceId, name: place.name || "Unknown Business" };
  } catch {
    return null;
  }
}

/**
 * Generate a competitor_id from a business name.
 */
function makeCompetitorId(name: string): string {
  return (
    "comp-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
  );
}

/**
 * GET listings.json from the data branch via GitHub API.
 */
async function getListings(pat: string): Promise<{
  json: ListingsConfig;
  sha: string | null;
}> {
  const res = await fetch(
    `${GITHUB_API}/contents/${LISTINGS_PATH}?ref=${DATA_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );
  if (res.status === 404) {
    return { json: { branches: [] }, sha: null };
  }
  if (!res.ok) {
    throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { json: JSON.parse(content), sha: data.sha };
}

/**
 * PUT updated listings.json to the data branch via GitHub API.
 */
async function putListings(
  pat: string,
  listings: ListingsConfig,
  sha: string | null,
  message: string,
): Promise<void> {
  const content = Buffer.from(JSON.stringify(listings, null, 2)).toString(
    "base64",
  );
  const body: Record<string, unknown> = {
    message,
    content,
    branch: DATA_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${GITHUB_API}/contents/${LISTINGS_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Trigger the scraper workflow via GitHub API (workflow_dispatch).
 */
async function triggerWorkflow(pat: string): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/actions/workflows/scraper.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { mode: "manual" },
      }),
    },
  );
  // workflow_dispatch returns 204 on success, 422 if workflow isn't on default branch
  if (!res.ok && res.status !== 204) {
    console.warn(`[add-competitor] workflow dispatch failed: ${res.status}`);
    // Non-fatal — data is already committed, scraper will pick it up on next cron run
  }
}

export async function POST(request: NextRequest) {
  try {
    const pat = process.env.GITHUB_PAT;
    if (!pat) {
      return NextResponse.json(
        { error: "Server not configured: GITHUB_PAT missing" },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body?.url || typeof body.url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url (Google Maps link)" },
        { status: 400 },
      );
    }

    const url = body.url.trim();

    // Basic validation: must look like a Google Maps URL
    if (
      !url.includes("maps.app.goo.gl") &&
      !url.includes("goo.gl/maps") &&
      !url.includes("google.com/maps") &&
      !url.includes("maps.google.com")
    ) {
      return NextResponse.json(
        { error: "Not a valid Google Maps URL" },
        { status: 400 },
      );
    }

    // Step 1: Resolve URL to place_id
    const resolved = await resolveGmapsUrl(url);
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            "Could not resolve this Google Maps link to a business. Try a different link.",
        },
        { status: 422 },
      );
    }

    // Step 2: Get current listings from data branch
    const { json: listings, sha } = await getListings(pat);

    // Step 3: Check for duplicate place_id
    const allCompetitors = listings.branches.flatMap((b) => b.competitors ?? []);
    const existing = allCompetitors.find(
      (c) => c.place_id === resolved.place_id,
    );
    if (existing) {
      return NextResponse.json(
        {
          error: `"${existing.name}" is already being monitored.`,
          existing: { name: existing.name, competitor_id: existing.competitor_id },
        },
        { status: 409 },
      );
    }

    // Step 4: Build new competitor entry
    const competitorId = makeCompetitorId(resolved.name);
    const newCompetitor: CompetitorConfig = {
      competitor_id: competitorId,
      name: resolved.name,
      gmaps_url: url,
      place_id: resolved.place_id,
    };

    // Step 5: Add to first branch (or create one if empty)
    if (listings.branches.length === 0) {
      listings.branches.push({
        branch_id: "monitored",
        branch_name: "Monitored Businesses",
        competitors: [newCompetitor],
      });
    } else {
      listings.branches[0].competitors = listings.branches[0].competitors || [];
      listings.branches[0].competitors.push(newCompetitor);
    }

    // Step 6: Commit updated listings to data branch
    await putListings(
      pat,
      listings,
      sha,
      `feat: add ${resolved.name} via web dashboard`,
    );

    // Step 7: Trigger scraper workflow (non-blocking)
    triggerWorkflow(pat).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `"${resolved.name}" added! First scrape will run within 10 minutes.`,
      competitor: {
        name: resolved.name,
        competitor_id: competitorId,
        place_id: resolved.place_id,
      },
    });
  } catch (err) {
    console.error("[add-competitor] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import type { ScrapeTriggerAsyncResponse, ScrapeTriggerErrorResponse } from "@/lib/gbp/types";
import { scrapeRunManager } from "@/lib/gbp/scrape-runner";
import { sanitizeError } from "@/lib/gbp/sanitize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request?: Request) {
  let mode = "live";
  if (request) {
    const url = new URL(request.url);
    mode = url.searchParams.get("mode") || "live";
  }
  if (mode !== "fixtures" && mode !== "live") {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid mode: ${mode}`,
        stderr: "",
        stage: "validation",
        probable_cause: "Invalid mode parameter",
        suggested_fix: "Use 'fixtures' or 'live'",
      } satisfies ScrapeTriggerErrorResponse,
      { status: 400 },
    );
  }

  let runId: string;
  try {
    const result = await scrapeRunManager.start(mode as "fixtures" | "live");
    if (result === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "A scrape run is already in progress. Wait for it to complete before triggering another.",
          stderr: "",
          stage: "concurrent_run",
          probable_cause: "A previous scrape run is still active.",
          suggested_fix: "Wait for the current run to finish, or check /api/scrape/status for progress.",
        } satisfies ScrapeTriggerErrorResponse,
        { status: 409 },
      );
    }
    runId = result;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeError(err),
        stderr: "",
        stage: "spawn_failed",
        probable_cause: "Could not start scraper process.",
        suggested_fix: "Verify Python is installed and accessible from PATH, and GBP_ROOT is configured correctly.",
      } satisfies ScrapeTriggerErrorResponse,
      { status: 500 },
    );
  }

  const body: ScrapeTriggerAsyncResponse = { ok: true, runId };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

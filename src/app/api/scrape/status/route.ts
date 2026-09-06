import { NextRequest, NextResponse } from "next/server";
import { scrapeRunManager } from "@/lib/gbp/scrape-runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // P1-4 Fix C — lightweight "is anything running?" probe so the RunScreen
  // can detect an in-flight scrape from other sessions before offering Run.
  const active = request.nextUrl.searchParams.get("active");
  if (active === "1") {
    // R2 fix (TAURI_AUDIT_2026-09-06): include runId so the persistent
    // TopBar indicator can show per-competitor progress across
    // navigations and after server restarts.
    const runId = scrapeRunManager.getActiveRunId();
    return NextResponse.json(
      { ok: true, active: runId !== null, runId },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json(
      { ok: false, error: "Missing runId query parameter" },
      { status: 400 },
    );
  }

  const status = await scrapeRunManager.getStatus(runId);
  if (!status) {
    return NextResponse.json(
      { ok: false, error: "Run not found or expired" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...status }, {
    headers: { "Cache-Control": "no-store" },
  });
}

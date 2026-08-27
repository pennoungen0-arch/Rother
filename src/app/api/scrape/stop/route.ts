import { NextRequest, NextResponse } from "next/server";
import { scrapeRunManager } from "@/lib/gbp/scrape-runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Stop a specific run or all running runs. */
export async function DELETE(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");

  if (runId) {
    const stopped = scrapeRunManager.stopRun(runId);
    return NextResponse.json(
      { ok: stopped, stopped: stopped ? 1 : 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const stopped = scrapeRunManager.stopAllRuns();
  return NextResponse.json(
    { ok: true, stopped },
    { headers: { "Cache-Control": "no-store" } },
  );
}

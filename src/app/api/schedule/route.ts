import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { GBP_CONFIG_DIR } from "@/lib/gbp/paths";

const SCHEDULE_PATH = `${GBP_CONFIG_DIR}/schedule.json`;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await fs.readFile(SCHEDULE_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { enabled: false, intervalHours: 24, nextRun: null, lastRun: null, lastRunStatus: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const current = JSON.parse(await fs.readFile(SCHEDULE_PATH, "utf-8"));
    const updated = { ...current, ...body };
    await fs.writeFile(SCHEDULE_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update schedule", detail: String(err) },
      { status: 500 },
    );
  }
}
import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import {
  GBP_ROOT,
  GBP_DATA_DIR,
  GBP_LISTINGS_PATH,
  GBP_SELECTORS_PATH,
} from "@/lib/gbp/paths";

const startTime = Date.now();

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV ?? "development",
    apiKeyConfigured: !!process.env.API_KEY,
    pythonScraperAvailable: existsSync(join(GBP_ROOT, "orchestration", "run_all.py")),
    configPresent: {
      listings: existsSync(GBP_LISTINGS_PATH),
      selectors: existsSync(GBP_SELECTORS_PATH),
    },
    dataDirectory: existsSync(GBP_DATA_DIR),
    version: "0.2.0",
  });
}

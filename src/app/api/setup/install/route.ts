import { NextResponse } from "next/server";
import { spawn, type ChildProcess, spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  GBP_ROOT,
} from "@/lib/gbp/paths";

export const dynamic = "force-dynamic";

function findPython(): string | null {
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const result = spawnSync(/*turbopackIgnore: true*/ cmd, ["--version"], {
        encoding: "utf-8",
        timeout: 5_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.error || result.status !== 0) continue;
      return cmd;
    } catch {
      continue;
    }
  }
  return null;
}

function runProcess(
  python: string,
  args: string[],
): Promise<{ lines: string[]; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn(/*turbopackIgnore: true*/ python, args, {
      cwd: GBP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const lines: string[] = [];

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) lines.push(text);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) lines.push(text);
    });

    child.on("close", (code: number | null) => {
      resolve({ lines, exitCode: code });
    });
    child.on("error", (err: Error) => {
      lines.push(`Error: ${err.message}`);
      resolve({ lines, exitCode: -1 });
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const step: string | undefined = body.step;

    const python = findPython();
    if (!python) {
      return NextResponse.json(
        { ok: false, error: "Python not found. Install Python and try again." },
        { status: 400 },
      );
    }

    if (step === "packages" || !step) {
      const requirementsPath = join(GBP_ROOT, "requirements.txt");
      const result = await runProcess(python, [
        "-m", "pip", "install", "-r", requirementsPath,
      ]);
      return NextResponse.json({
        ok: true,
        step: "packages",
        exitCode: result.exitCode,
        output: result.lines,
        message: result.exitCode === 0
          ? "Python packages installed successfully"
          : `pip install exited with code ${result.exitCode}`,
      });
    }

    if (step === "chromium") {
      const result = await runProcess(python, [
        "-m", "playwright", "install", "chromium",
      ]);
      return NextResponse.json({
        ok: true,
        step: "chromium",
        exitCode: result.exitCode,
        output: result.lines,
        message: result.exitCode === 0
          ? "Chromium installed successfully"
          : `playwright install exited with code ${result.exitCode}`,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown step: ${step}` },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

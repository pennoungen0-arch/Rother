import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const GBP_ROOT = path.join(ROOT, "gbp-monitor");
const DATA_DIR = path.join(GBP_ROOT, "data");
const OUTPUT_DIR = path.join(ROOT, "public", "data");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readJsonSafe(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

async function writeJson(p, data) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

export async function exportStaticData() {
  await ensureDir(OUTPUT_DIR);

  // Read key data files if they exist
  const runSummary = await readJsonSafe(path.join(DATA_DIR, "run_summary.json"));
  const reviewsNewDir = path.join(DATA_DIR, "reviews_new");
  const snapshotsDir = path.join(DATA_DIR, "snapshots");

  // Export run summary
  if (runSummary) {
    await writeJson(path.join(OUTPUT_DIR, "run_summary.json"), runSummary);
  }

  // Export snapshots (per competitor)
  try {
    const competitors = await fs.readdir(snapshotsDir);
    for (const compId of competitors) {
      const compDir = path.join(snapshotsDir, compId);
      const stat = await fs.stat(compDir);
      if (!stat.isDirectory()) continue;

      const latestPtr = await readJsonSafe(path.join(compDir, "latest.json"));
      if (latestPtr) {
        const snapshot = await readJsonSafe(
          path.join(compDir, latestPtr),
        );
        if (snapshot) {
          await writeJson(
            path.join(OUTPUT_DIR, "snapshots", `${compId}.json`),
            snapshot,
          );
        }
      }
    }
  } catch {
    // snapshots dir may not exist
  }

  // Export deltas (new reviews)
  try {
    const files = await fs.readdir(reviewsNewDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const content = await readJsonSafe(path.join(reviewsNewDir, file));
      if (content) {
        await writeJson(path.join(OUTPUT_DIR, "deltas", file), content);
      }
    }
  } catch {
    // reviews_new dir may not exist
  }

  // Export listings config
  const listings = await readJsonSafe(
    path.join(GBP_ROOT, "config", "listings.json"),
  );
  if (listings) {
    await writeJson(path.join(OUTPUT_DIR, "listings.json"), listings);
  }

  // Export run log
  try {
    const log = await fs.readFile(
      path.join(DATA_DIR, "run.log"),
      "utf-8",
    );
    const lines = log.split("\n").filter((l) => l.length > 0);
    await writeJson(path.join(OUTPUT_DIR, "run_log.json"), { lines });
  } catch {
    // no run.log
  }

  console.log("Static data export complete.");
}

if (process.argv[1] && process.argv[1].endsWith("export-static-data.mjs")) {
  exportStaticData().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

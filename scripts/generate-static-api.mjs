import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const GBP_ROOT = path.join(ROOT, "gbp-monitor");
const DATA_DIR = path.join(GBP_ROOT, "data");
const OUTPUT_API_DIR = path.join(ROOT, "public", "api");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const REVIEWS_NEW_DIR = path.join(DATA_DIR, "reviews_new");

async function readJsonSafe(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

async function writeJson(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

/** Read all snapshots from disk, handling directory-based and flat-file formats. */
async function readAllSnapshots() {
  const out = new Map();
  try {
    const entries = await fs.readdir(SNAPSHOTS_DIR, { withFileTypes: true });

    // Pass 1: subdirectories with latest.json pointers
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const compDir = path.join(SNAPSHOTS_DIR, entry.name);
      const latestPtr = await readJsonSafe(path.join(compDir, "latest.json"));
      if (latestPtr) {
        const snapshot = await readJsonSafe(path.join(compDir, latestPtr));
        if (snapshot && Array.isArray(snapshot)) out.set(entry.name, snapshot);
      }
    }

    // Pass 2: direct JSON files in snapshots root (e.g., comp-canggu-01.json)
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const compId = entry.name.replace(/\.json$/, "");
      if (out.has(compId)) continue;
      const snapshot = await readJsonSafe(path.join(SNAPSHOTS_DIR, entry.name));
      if (snapshot && Array.isArray(snapshot)) out.set(compId, snapshot);
    }

    // Pass 3: subdirectories without latest.json — read newest timestamped file
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (out.has(entry.name)) continue;
      const compDir = path.join(SNAPSHOTS_DIR, entry.name);
      try {
        const files = await fs.readdir(compDir);
        const jsonFiles = files.filter(f => f.endsWith(".json") && f !== "latest.json").sort().reverse();
        if (jsonFiles.length > 0) {
          const snapshot = await readJsonSafe(path.join(compDir, jsonFiles[0]));
          if (snapshot && Array.isArray(snapshot)) out.set(entry.name, snapshot);
        }
      } catch {}
    }
  } catch {}
  return out;
}

/** Get latest delta for a competitor from reviews_new/ directory. */
async function readLatestDelta(competitorId) {
  try {
    const files = await fs.readdir(REVIEWS_NEW_DIR);
    const matching = files
      .filter(f => {
        if (!f.endsWith(".json") || !f.startsWith(`${competitorId}_`)) return false;
        return true;
      })
      .sort().reverse();
    if (matching.length > 0) {
      const content = await readJsonSafe(path.join(REVIEWS_NEW_DIR, matching[0]));
      return content || [];
    }
  } catch {}
  return [];
}

/** Map competitor_id → {competitor_name, branch_name} from listings. */
function buildNameMaps(listings) {
  const compIdToName = new Map();
  const compIdToBranchName = new Map();
  const compIdToBranchId = new Map();
  for (const branch of listings.branches) {
    for (const comp of branch.competitors) {
      compIdToName.set(comp.competitor_id, comp.name);
      compIdToBranchName.set(comp.competitor_id, branch.branch_name);
      compIdToBranchId.set(comp.competitor_id, branch.branch_id);
    }
  }
  return { compIdToName, compIdToBranchName, compIdToBranchId };
}

/** Compute cosine similarity between two distribution vectors. */
function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

/** Generate static JSON files in public/api/ matching API route responses. */
export async function generateStaticAPI() {
  const filesWritten = [];
  const snapshots = await readAllSnapshots();
  const runSummary = await readJsonSafe(path.join(DATA_DIR, "run_summary.json"));
  const listings = await readJsonSafe(path.join(GBP_ROOT, "config", "listings.json"));
  const selectors = await readJsonSafe(path.join(GBP_ROOT, "config", "selectors.json"));

  const { compIdToName, compIdToBranchName, compIdToBranchId } = listings
    ? buildNameMaps(listings)
    : { compIdToName: new Map(), compIdToBranchName: new Map(), compIdToBranchId: new Map() };

  // ── /api/overview ──────────────────────────────────────────────────────────
  {
    const ratingBuckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    for (const reviews of snapshots.values()) {
      for (const r of reviews) {
        totalReviews++;
        if (r.rating && r.rating >= 1 && r.rating <= 5) {
          ratingBuckets[Math.round(r.rating)]++;
        }
      }
    }

    // Competitor stats (same as branches route competitor entries)
    const competitorStats = [];
    let newReviewsLastRun = 0;
    if (listings) {
      for (const branch of listings.branches) {
        for (const comp of branch.competitors) {
          const reviews = snapshots.get(comp.competitor_id) ?? [];
          const validRatings = reviews
            .map(r => r.rating)
            .filter(r => r !== null && !Number.isNaN(r));
          const average_rating =
            validRatings.length === 0
              ? null
              : Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 100) / 100;
          const delta = await readLatestDelta(comp.competitor_id);
          newReviewsLastRun += delta.length;
          competitorStats.push({
            competitor_id: comp.competitor_id,
            name: comp.name,
            branch_name: branch.branch_name,
            total_reviews: reviews.length,
            average_rating,
            new_reviews_count: delta.length,
          });
        }
      }
    }

    const newReviewsPerBranch = [];
    if (listings) {
      for (const branch of listings.branches) {
        let branchNew = 0;
        for (const comp of branch.competitors) {
          const delta = await readLatestDelta(comp.competitor_id);
          branchNew += delta.length;
        }
        newReviewsPerBranch.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          count: branchNew,
        });
      }
    }

    const overview = {
      runSummary,
      selectorVerification: {
        verified_by: selectors?._meta?.verified_by ?? selectors?.verified_by ?? "seed",
        last_verified: selectors?._meta?.last_verified ?? selectors?.last_verified ?? null,
        isUnproven: true,
        note: selectors?._verification_note,
      },
      totalBranches: listings?.branches.length ?? 0,
      totalCompetitors: listings ? Array.from(listings.branches).reduce((acc, b) => acc + b.competitors.length, 0) : 0,
      totalReviews,
      newReviewsLastRun,
      ratingDistribution: [1, 2, 3, 4, 5].map(r => ({ rating: r, count: ratingBuckets[r] })),
      errors: runSummary?.errors ?? [],
      isAlert: !!(runSummary && runSummary.failed > 0 && runSummary.failed >= runSummary.success),
      newReviewsPerBranch,
      competitorStats,
    };

    await writeJson(path.join(OUTPUT_API_DIR, "overview.json"), overview);
    filesWritten.push("/api/overview.json");
  }

  // ── /api/branches ──────────────────────────────────────────────────────────
  {
    const branches = [];
    let totalCompetitors = 0;
    let totalReviews = 0;

    if (listings) {
      for (const branch of listings.branches) {
        const competitors = [];
        let branchTotal = 0;
        let branchNew = 0;

        for (const comp of branch.competitors) {
          totalCompetitors++;
          const reviews = snapshots.get(comp.competitor_id) ?? [];
          const validRatings = reviews
            .map(r => r.rating)
            .filter(r => r !== null && !Number.isNaN(r));
          const average_rating =
            validRatings.length === 0
              ? null
              : Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 100) / 100;
          const scrapedDates = reviews
            .map(r => r.scraped_at)
            .filter(Boolean)
            .sort();
          const last_scraped_at = scrapedDates.length > 0 ? scrapedDates[scrapedDates.length - 1] : null;
          const delta = await readLatestDelta(comp.competitor_id);

          branchTotal += reviews.length;
          branchNew += delta.length;
          totalReviews += reviews.length;

          competitors.push({
            competitor_id: comp.competitor_id,
            name: comp.name,
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            gmaps_url: comp.gmaps_url,
            total_reviews: reviews.length,
            average_rating,
            last_scraped_at,
            new_reviews_count: delta.length,
          });
        }

        branches.push({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
          competitors,
          total_reviews: branchTotal,
          new_reviews_count: branchNew,
        });
      }
    }

    await writeJson(path.join(OUTPUT_API_DIR, "branches.json"), {
      branches,
      totalCompetitors,
      totalReviews,
    });
    filesWritten.push("/api/branches.json");
  }

  // ── /api/reviews ───────────────────────────────────────────────────────────
  {
    const allReviews = [];
    for (const [compId, reviews] of snapshots.entries()) {
      for (const r of reviews) allReviews.push({ ...r, competitor_id: compId });
    }

    // Sort newest scraped_at first
    allReviews.sort((a, b) => {
      const sa = a.scraped_at || "";
      const sb = b.scraped_at || "";
      if (sa !== sb) return sb.localeCompare(sa);
      return (b.review_id || "").localeCompare(a.review_id || "");
    });

    await writeJson(path.join(OUTPUT_API_DIR, "reviews.json"), {
      data: allReviews,
      total: allReviews.length,
      page: 1,
      pageSize: 100,
    });
    filesWritten.push("/api/reviews.json");
  }

  // ── /api/reviews-over-time ─────────────────────────────────────────────────
  {
    const byDate = new Map();
    for (const reviews of snapshots.values()) {
      for (const r of reviews) {
        const ts = r.scraped_at;
        if (!ts) continue;
        const date = ts.slice(0, 10);
        byDate.set(date, (byDate.get(date) || 0) + 1);
      }
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    let cumulative = 0;
    const data = sortedDates.map(date => {
      const newReviews = byDate.get(date) || 0;
      cumulative += newReviews;
      return { date, new_reviews: newReviews, cumulative };
    });

    await writeJson(path.join(OUTPUT_API_DIR, "reviews-over-time.json"), {
      data,
      totalPoints: data.length,
      totalReviews: cumulative,
    });
    filesWritten.push("/api/reviews-over-time.json");
  }

  // ── /api/review-lengths ────────────────────────────────────────────────────
  {
    const textLengths = [];
    let emptyCount = 0;
    for (const reviews of snapshots.values()) {
      for (const r of reviews) {
        if (r.text && r.text.trim().length > 0) {
          textLengths.push(r.text.length);
        } else {
          emptyCount++;
        }
      }
    }

    const buckets = [
      { label: "Short", range: "0–50", count: textLengths.filter(l => l <= 50).length, color: "oklch(0.65 0.12 230)" },
      { label: "Medium", range: "51–200", count: textLengths.filter(l => l >= 51 && l <= 200).length, color: "oklch(0.55 0.13 165)" },
      { label: "Long", range: "201–400", count: textLengths.filter(l => l >= 201 && l <= 400).length, color: "oklch(0.62 0.14 35)" },
      { label: "Very Long", range: "401+", count: textLengths.filter(l => l >= 401).length, color: "oklch(0.58 0.22 320)" },
    ];

    const total = textLengths.length + emptyCount;
    const withText = textLengths.length;
    const average = withText > 0 ? Math.round(textLengths.reduce((s, l) => s + l, 0) / withText) : 0;
    const sorted = [...textLengths].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const min = sorted.length > 0 ? sorted[0] : 0;
    const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

    await writeJson(path.join(OUTPUT_API_DIR, "review-lengths.json"), {
      buckets,
      stats: { total, withText, average, median, min, max },
    });
    filesWritten.push("/api/review-lengths.json");
  }

  // ── /api/history ───────────────────────────────────────────────────────────
  {
    const allDeltas = [];
    try {
      const files = await fs.readdir(REVIEWS_NEW_DIR);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const content = await readJsonSafe(path.join(REVIEWS_NEW_DIR, file));
        if (content && Array.isArray(content) && content.length > 0) {
          const base = file.replace(/\.json$/, "");
          const idx = base.lastIndexOf("_");
          const compId = idx > 0 ? base.slice(0, idx) : base;
          const ts = idx > 0 ? base.slice(idx + 1) : "";
          const m = ts.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
          const run_timestamp = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : ts;
          allDeltas.push({
            competitor_id: compId,
            run_timestamp,
            filename: file,
            reviews: content,
          });
        }
      }
    } catch {}

    // Group by run_timestamp
    const byRun = new Map();
    for (const d of allDeltas) {
      if (!byRun.has(d.run_timestamp)) byRun.set(d.run_timestamp, []);
      byRun.get(d.run_timestamp).push(d);
    }

    const runs = Array.from(byRun.entries())
      .map(([ts, deltas]) => {
        const breakdown = deltas.map(d => ({
          competitor_id: d.competitor_id,
          competitor_name: compIdToName.get(d.competitor_id) ?? d.competitor_id,
          branch_id: compIdToBranchId.get(d.competitor_id) ?? "",
          branch_name: compIdToBranchName.get(d.competitor_id) ?? "",
          count: d.reviews.length,
        }));
        const branches_affected = Array.from(new Set(deltas.map(d => compIdToBranchId.get(d.competitor_id) ?? "").filter(Boolean)));
        const total_new_reviews = breakdown.reduce((s, b) => s + b.count, 0);
        return {
          run_timestamp: ts,
          total_new_reviews,
          competitors_with_new: breakdown.length,
          branches_affected,
          breakdown,
        };
      })
      .sort((a, b) => b.run_timestamp.localeCompare(a.run_timestamp));

    await writeJson(path.join(OUTPUT_API_DIR, "history.json"), {
      runs,
      totalRuns: runs.length,
    });
    filesWritten.push("/api/history.json");
  }

  // ── /api/health-trend ─────────────────────────────────────────────────────
  {
    const points = [];
    if (runSummary) {
      const ts = runSummary.finished_at || runSummary.started_at;
      if (ts) {
        let level = "ok";
        if (runSummary.failed > 0 && runSummary.failed >= runSummary.success) level = "alert";
        else if (runSummary.failed > 0) level = "warn";
        points.push({
          success: runSummary.success,
          failed: runSummary.failed,
          skipped: runSummary.skipped,
          timestamp: ts,
          level,
        });
      }
    }

    // Also check run_log.json for previous runs
    try {
      const log = await readJsonSafe(path.join(DATA_DIR, "run_log.json"));
      if (log && Array.isArray(log)) {
        for (const entry of log) {
          if (entry && typeof entry === "object" && entry.timestamp && entry.success !== undefined) {
            points.push({
              success: entry.success,
              failed: entry.failed ?? 0,
              skipped: entry.skipped ?? 0,
              timestamp: entry.timestamp,
              level: entry.failed > 0 && entry.failed >= entry.success ? "alert" : entry.failed > 0 ? "warn" : "ok",
            });
          }
        }
      }
    } catch {}

    const recent = points.slice(-20);
    const latest = recent.length > 0 ? recent[recent.length - 1] : null;

    await writeJson(path.join(OUTPUT_API_DIR, "health-trend.json"), {
      points: recent,
      latest,
      isMultiPoint: recent.length > 1,
    });
    filesWritten.push("/api/health-trend.json");
  }

  // ── /api/competitor-correlation ────────────────────────────────────────────
  {
    const competitors = [];
    const compIds = Array.from(snapshots.keys());

    for (const compId of compIds) {
      const reviews = snapshots.get(compId) || [];
      const distribution = [0, 0, 0, 0, 0];
      for (const r of reviews) {
        if (r.rating && r.rating >= 1 && r.rating <= 5) {
          distribution[Math.round(r.rating) - 1]++;
        }
      }
      const total = distribution.reduce((s, c) => s + c, 0);
      if (total === 0) continue;
      competitors.push({
        competitor_id: compId,
        name: compIdToName.get(compId) ?? compId,
        branch_name: compIdToBranchName.get(compId) ?? "",
        distribution,
        total,
      });
    }

    competitors.sort((a, b) => b.total - a.total);
    const capped = competitors.slice(0, 12);

    const matrix = [];
    for (let i = 0; i < capped.length; i++) {
      const row = [];
      for (let j = 0; j < capped.length; j++) {
        if (i === j) {
          row.push(1);
        } else {
          row.push(Math.round(cosineSimilarity(capped[i].distribution, capped[j].distribution) * 100) / 100);
        }
      }
      matrix.push(row);
    }

    await writeJson(path.join(OUTPUT_API_DIR, "competitor-correlation.json"), {
      competitors: capped.map(c => ({
        competitor_id: c.competitor_id,
        name: c.name,
        branch_name: c.branch_name,
        distribution: c.distribution,
      })),
      matrix,
      maxCompetitors: 12,
    });
    filesWritten.push("/api/competitor-correlation.json");
  }

  // ── /api/config/listings ───────────────────────────────────────────────────
  if (listings) {
    await writeJson(path.join(OUTPUT_API_DIR, "config", "listings.json"), listings);
    filesWritten.push("/api/config/listings.json");
  }

  // ── /api/config/selectors ──────────────────────────────────────────────────
  if (selectors) {
    await writeJson(path.join(OUTPUT_API_DIR, "config", "selectors.json"), selectors);
    filesWritten.push("/api/config/selectors.json");
  }

  // ── /api/logs ──────────────────────────────────────────────────────────────
  {
    try {
      const log = await fs.readFile(path.join(DATA_DIR, "run.log"), "utf-8");
      const allLines = log.split("\n").filter(l => l.length > 0);
      const requestedLines = Math.min(2000, allLines.length);
      const lines = allLines.slice(-requestedLines);

      await writeJson(path.join(OUTPUT_API_DIR, "logs.json"), {
        lines,
        totalLines: allLines.length,
        requestedLines,
      });
    } catch {
      await writeJson(path.join(OUTPUT_API_DIR, "logs.json"), {
        lines: [],
        totalLines: 0,
        requestedLines: 200,
      });
    }
    filesWritten.push("/api/logs.json");
  }

  console.log(`Generated ${filesWritten.length} static API files.`);
  filesWritten.forEach(f => console.log(`  ✓ ${f}`));
}

if (process.argv[1] && process.argv[1].endsWith("generate-static-api.mjs")) {
  generateStaticAPI().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

/**
 * Unified data source abstraction — switches between local filesystem (dev/Tauri)
 * and remote GitHub data branch (Vercel) based on environment.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  ActiveBusiness,
  BranchConfig,
  BusinessEntry,
  BusinessesFile,
  DataStatus,
  HarvestInfo,
  ListingsConfig,
  Review,
  RunSummary,
  SelectorsConfig,
  SnapshotEntry,
} from "./types";
import {
  GBP_DATA_DIR,
  GBP_LISTINGS_PATH,
  GBP_REVIEWS_NEW_DIR,
  GBP_RUN_LOG_PATH,
  GBP_RUN_SUMMARY_PATH,
  GBP_SELECTORS_PATH,
  GBP_SNAPSHOTS_DIR,
  GBP_USER_BUSINESS_PATH,
} from "./paths";
import { validateCompetitorId } from "./validate";
import { businessDataDir } from "./paths";
import { withSelfEntry, pickMonitoredConfig, type ConfigSource } from "./self-target";
import {
  fetchAllDeltas as remoteFetchAllDeltas,
  fetchAllSnapshots as remoteFetchAllSnapshots,
  fetchHarvestInfo as remoteFetchHarvestInfo,
  fetchListings as remoteFetchListings,
  fetchRunLog as remoteFetchRunLog,
  fetchRunSummary as remoteFetchRunSummary,
  fetchSelectors as remoteFetchSelectors,
  fetchSnapshot as remoteFetchSnapshot,
  listSnapshotTimestamps as remoteListSnapshotTimestamps,
  shouldUseRemoteData,
} from "./remote-data";

function isRemoteMode(): boolean {
  return shouldUseRemoteData();
}

/** Strip `, original` suffix from a reviewer name if present. */
function cleanReviewerName(name: string | null): string | null {
  if (!name) return name;
  return name.replace(/,\s*original$/i, "").trim() || name;
}

function cleanReviewNames(reviews: Review[]): Review[] {
  return reviews.map((r) => ({ ...r, reviewer_name: cleanReviewerName(r.reviewer_name) }));
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(filePath, "utf-8");
    return JSON.parse(buf) as T;
  } catch (err) {
    const isPointer = filePath.endsWith("latest.json") || filePath.endsWith(".json");
    if (isPointer && (err as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.debug(`[server-data] no file (using fallback): ${filePath}`);
    } else {
      console.error(`[server-data] read failed: ${filePath}`, err);
    }
    return fallback;
  }
}

export async function readListings(): Promise<ListingsConfig> {
  if (isRemoteMode()) {
    return remoteFetchListings();
  }
  const raw = await readJsonFile<BusinessesFile | ListingsConfig>(GBP_LISTINGS_PATH, { branches: [] });
  if ("businesses" in raw && Array.isArray(raw.businesses)) {
    const seeded = raw.businesses.find((b: BusinessEntry) => b.isSeeded) ?? raw.businesses[0];
    return { branches: seeded?.branches ?? [] };
  }
  return { branches: (raw as ListingsConfig).branches ?? [] };
}

export async function readSelectors(): Promise<SelectorsConfig | null> {
  if (isRemoteMode()) {
    return remoteFetchSelectors();
  }
  try {
    const buf = await fs.readFile(GBP_SELECTORS_PATH, "utf-8");
    return JSON.parse(buf) as SelectorsConfig;
  } catch {
    return null;
  }
}

export async function readRunSummary(businessId?: string): Promise<RunSummary | null> {
  if (isRemoteMode()) {
    return remoteFetchRunSummary();
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  const summaryPath = id
    ? path.join(businessDataDir(id), "run_summary.json")
    : GBP_RUN_SUMMARY_PATH;
  return readJsonFile<RunSummary | null>(summaryPath, null);
}

async function readLatestSnapshotLocal(
  competitorId: string,
  businessId?: string,
): Promise<Review[]> {
  validateCompetitorId(competitorId);
  const root = businessId ? path.join(businessDataDir(businessId), "snapshots") : GBP_SNAPSHOTS_DIR;
  const compDir = path.join(root, competitorId);
  const latestPtr = path.join(compDir, "latest.json");
  const latestFilename = await readJsonFile<string | null>(latestPtr, null);
  if (latestFilename) {
    const snapshotPath = path.join(compDir, latestFilename);
    return cleanReviewNames(await readJsonFile<Review[]>(snapshotPath, []));
  }
  const legacy = path.join(root, `${competitorId}.json`);
  if (await fileExists(legacy)) {
    return cleanReviewNames(await readJsonFile<Review[]>(legacy, []));
  }
  return [];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const SNAPSHOTS_CACHE_TTL_MS = 10_000;
let _snapshotsCache: { value: Map<string, Review[]>; ts: number } | null = null;

export async function readAllSnapshots(businessId?: string): Promise<Map<string, Review[]>> {
  if (isRemoteMode()) {
    const remote = await remoteFetchAllSnapshots();
    const cleaned = new Map<string, Review[]>();
    for (const [k, v] of remote) cleaned.set(k, cleanReviewNames(v));
    return cleaned;
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  if (active && !id) return new Map<string, Review[]>();

  const root = id ? path.join(businessDataDir(id), "snapshots") : GBP_SNAPSHOTS_DIR;
  const now = Date.now();
  if (!id && _snapshotsCache && now - _snapshotsCache.ts < SNAPSHOTS_CACHE_TTL_MS) {
    return _snapshotsCache.value;
  }

  const out = new Map<string, Review[]>();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true }).then(
      (dirents) => dirents.filter((d) => d.isDirectory()).map((d) => d.name),
    );
    for (const competitorId of entries) {
      const reviews = await readLatestSnapshotLocal(competitorId, id);
      out.set(competitorId, reviews);
    }
  } catch {
    // data dir might not exist yet
  }
  try {
    const all = await fs.readdir(root);
    for (const entry of all) {
      if (!entry.endsWith(".json") || entry === "latest.json") continue;
      const competitorId = entry.replace(/\.json$/, "");
      if (out.has(competitorId)) continue;
      const full = path.join(root, entry);
      const reviews = await readJsonFile<Review[]>(full, []);
      out.set(competitorId, reviews);
    }
  } catch {
    // ignore
  }
  if (!id) _snapshotsCache = { value: out, ts: now };
  return out;
}

export async function readHarvestInfo(competitorId: string, businessId?: string): Promise<HarvestInfo | null> {
  if (isRemoteMode()) {
    return remoteFetchHarvestInfo(competitorId);
  }
  validateCompetitorId(competitorId);
  const root = businessId ? path.join(businessDataDir(businessId), "snapshots") : GBP_SNAPSHOTS_DIR;
  const compDir = path.join(root, competitorId);
  const latestPtr = path.join(compDir, "latest.json");
  const latestFilename = await readJsonFile<string | null>(latestPtr, null);
  if (!latestFilename) return null;
  const metaPath = path.join(compDir, latestFilename.replace(/\.json$/, ".metadata.json"));
  return readJsonFile<HarvestInfo | null>(metaPath, null);
}

export async function listSnapshots(competitorId: string): Promise<SnapshotEntry[]> {
  if (isRemoteMode()) {
    return remoteListSnapshotTimestamps(competitorId);
  }
  validateCompetitorId(competitorId);
  const compDir = path.join(GBP_SNAPSHOTS_DIR, competitorId);
  try {
    const files = await fs.readdir(compDir);
    const snapshots: SnapshotEntry[] = [];
    for (const f of files) {
      if (!f.endsWith(".json") || f === "latest.json") continue;
      const tsRaw = f.replace(/\.json$/, "");
      const ts = tsRaw.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");
      const full = path.join(compDir, f);
      const reviews = await readJsonFile<Review[]>(full, []);
      snapshots.push({ timestamp: ts, filename: f, review_count: reviews.length });
    }
    snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return snapshots;
  } catch {
    return [];
  }
}

export async function readSnapshotAt(competitorId: string, timestamp: string): Promise<Review[]> {
  if (isRemoteMode()) {
    return cleanReviewNames(await remoteFetchSnapshot(competitorId));
  }
  validateCompetitorId(competitorId);
  if (timestamp === "latest") {
    return readLatestSnapshotLocal(competitorId);
  }
  const safe = timestamp.replace(/:/g, "-");
  const compDir = path.join(GBP_SNAPSHOTS_DIR, competitorId);
  const snapshotPath = path.join(compDir, `${safe}.json`);
  return cleanReviewNames(await readJsonFile<Review[]>(snapshotPath, []));
}

const DELTAS_CACHE_TTL_MS = 10_000;
let _deltasCache: { value: Array<{ competitor_id: string; run_timestamp: string; filename: string; reviews: Review[] }>; ts: number } | null = null;

export async function readAllDeltas(businessId?: string): Promise<Array<{
  competitor_id: string;
  run_timestamp: string;
  filename: string;
  reviews: Review[];
}>> {
  if (isRemoteMode()) {
    return remoteFetchAllDeltas();
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  if (active && !id) return [];
  const root = id ? path.join(businessDataDir(id), "reviews_new") : GBP_REVIEWS_NEW_DIR;

  const now = Date.now();
  if (!id && _deltasCache && now - _deltasCache.ts < DELTAS_CACHE_TTL_MS) {
    return _deltasCache.value;
  }

  const out: Array<{ competitor_id: string; run_timestamp: string; filename: string; reviews: Review[] }> = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return out;
  }
  for (const filename of entries) {
    if (!filename.endsWith(".json")) continue;
    const base = filename.replace(/\.json$/, "");
    const m = base.match(/^(.*)_(\d{8}T\d{6}Z)$/);
    if (!m) continue;
    const competitorId = m[1];
    const tsRaw = m[2];
    const ts = tsRaw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    const run_timestamp = ts ? `${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:${ts[5]}:${ts[6]}Z` : tsRaw;
    const full = path.join(root, filename);
    const reviews = cleanReviewNames(await readJsonFile<Review[]>(full, []));
    out.push({ competitor_id: competitorId, run_timestamp, filename, reviews });
  }
  out.sort((a, b) => b.run_timestamp.localeCompare(a.run_timestamp));
  if (!id) _deltasCache = { value: out, ts: now };
  return out;
}

export async function readLatestDelta(
  competitorId: string,
  businessId?: string,
): Promise<Review[]> {
  if (isRemoteMode()) {
    return [];
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  if (active && !id) return [];
  const root = id ? path.join(businessDataDir(id), "reviews_new") : GBP_REVIEWS_NEW_DIR;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const matching = entries
    .filter((f) => f.startsWith(`${competitorId}_`) && f.endsWith(".json"))
    .sort()
    .reverse();
  if (matching.length === 0) return [];
  const full = path.join(root, matching[0]);
  return cleanReviewNames(await readJsonFile<Review[]>(full, []));
}

export async function tailLog(lines = 200, businessId?: string): Promise<{ lines: string[]; totalLines: number }> {
  if (isRemoteMode()) {
    const log = await remoteFetchRunLog();
    const all = log.split("\n").filter((l) => l.length > 0);
    return { lines: all.slice(-lines), totalLines: all.length };
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  const logPath = id ? path.join(businessDataDir(id), "run.log") : GBP_RUN_LOG_PATH;
  try {
    const buf = await fs.readFile(logPath, "utf-8");
    const all = buf.split("\n").filter((l) => l.length > 0);
    return { lines: all.slice(-lines), totalLines: all.length };
  } catch {
    return { lines: [], totalLines: 0 };
  }
}

export async function assessDataStatus(businessId?: string): Promise<DataStatus> {
  if (isRemoteMode()) {
    const listings = await remoteFetchListings();
    return listings.branches.length > 0 ? "ok" : "missing";
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  if (active && id) {
    try {
      const entries = await fs.readdir(path.join(businessDataDir(id), "snapshots"));
      if (entries.length > 0) return "ok";
      return "missing";
    } catch {
      return "missing";
    }
  }
  let listingsPresent = false;
  try {
    await fs.access(GBP_LISTINGS_PATH);
    listingsPresent = true;
    JSON.parse(await fs.readFile(GBP_LISTINGS_PATH, "utf-8"));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      listingsPresent = false;
    } else if (listingsPresent) {
      return "corrupt";
    }
  }
  if (!active && !listingsPresent) return "missing";
  return "ok";
}

export async function resolveMonitoredConfig(): Promise<{ branches: BranchConfig[]; source: ConfigSource }> {
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  if (active) return pickMonitoredConfig(active, []);
  const seed = await readListings();
  return pickMonitoredConfig(null, seed.branches);
}

export async function readActiveBusinessBranches(): Promise<BranchConfig[]> {
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  if (Array.isArray(active?.branches) && active.branches.length > 0) {
    return active.branches;
  }
  if (active) return [];
  return (await readListings()).branches;
}

export async function writeActiveBusinessBranches(branches: BranchConfig[]): Promise<ActiveBusiness> {
  const { readActiveBusiness } = await import("./server-data");
  const existing = await readActiveBusiness();
  if (!existing) throw new Error("No active business selected — cannot persist branches.");
  const updated: ActiveBusiness = { ...existing, branches };
  await fs.writeFile(GBP_USER_BUSINESS_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function writeEffectiveListings(businessId?: string | null): Promise<{ path: string; totalCompetitors: number } | null> {
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  if (!active) return null;
  const id = businessId ?? active.id;
  const branches = withSelfEntry(active);
  const totalCompetitors = branches.reduce((n, b) => n + (b.competitors?.length ?? 0), 0);
  if (branches.length === 0 || totalCompetitors === 0) return null;
  const effective: ListingsConfig = {
    _comment: `Auto-generated for business "${active.name}" (${id}) — do not edit; regenerated on every scrape trigger.`,
    branches,
  };
  const outPath = path.join(businessDataDir(id), "effective_listings.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(effective, null, 2), "utf-8");
  return { path: outPath, totalCompetitors };
}

export async function readCategoryScan(businessId?: string): Promise<import("./types").CategoryScanResponse | null> {
  if (isRemoteMode()) {
    return null;
  }
  const { readActiveBusiness } = await import("./server-data");
  const active = await readActiveBusiness();
  const id = businessId ?? active?.id;
  const dir = id ? businessDataDir(id) : GBP_DATA_DIR;
  const scanDir = path.join(dir, "category_scan");
  const latest = await readJsonFile<string | null>(path.join(scanDir, "latest.json"), null);
  if (!latest) return null;
  return readJsonFile<import("./types").CategoryScanResponse | null>(path.join(scanDir, latest), null);
}

export async function readActiveBusiness(): Promise<ActiveBusiness | null> {
  if (isRemoteMode()) {
    return null;
  }
  return readJsonFile<ActiveBusiness | null>(GBP_USER_BUSINESS_PATH, null);
}
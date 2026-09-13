/**
 * Server-side helpers for reading Rother's JSON files — RE-EXPORTS ONLY.
 *
 * The actual implementations are in data-source.ts which provides a unified
 * local/remote data access layer. This file exists for backward compatibility
 * with all existing API routes that import from "@/lib/gbp/server-data".
 *
 * All functions are defensive: a missing or corrupt file returns a safe
 * empty value rather than throwing, so the dashboard always renders.
 */

import "server-only";

export {
  readListings,
  readSelectors,
  readRunSummary,
  readAllSnapshots,
  readHarvestInfo,
  listSnapshots,
  readSnapshotAt,
  readAllDeltas,
  readLatestDelta,
  tailLog,
  assessDataStatus,
  resolveMonitoredConfig,
  readActiveBusinessBranches,
  writeActiveBusinessBranches,
  writeEffectiveListings,
  readCategoryScan,
  readActiveBusiness,
} from "./data-source";

// Re-export types that were previously defined here
export type {
  ActiveBusiness,
  BranchConfig,
  BusinessEntry,
  BusinessesFile,
  CategoryScanResponse,
  DataStatus,
  HarvestInfo,
  ListingsConfig,
  OpeningHour,
  Review,
  RunSummary,
  SelectorsConfig,
  SnapshotEntry,
} from "./types";

// Re-export paths for any consumers that need them
export {
  GBP_ROOT,
  GBP_DATA_DIR,
  GBP_CONFIG_DIR,
  GBP_SNAPSHOTS_DIR,
  GBP_REVIEWS_NEW_DIR,
  GBP_RAW_HTML_DIR,
  GBP_RUN_LOG_PATH,
  GBP_RUN_SUMMARY_PATH,
  GBP_LISTINGS_PATH,
  GBP_SELECTORS_PATH,
  GBP_USER_BUSINESS_PATH,
  businessDataDir,
} from "./paths";

// Re-export readJsonFile for internal consumers
export { readJsonFile } from "./data-source";
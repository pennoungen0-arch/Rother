"use client";

import * as React from "react";

import { useLocalStorageState } from "@/lib/use-external-store";
import { FEATURES } from "@/lib/features";

export type User = { name: string; email: string; avatar?: string };
export type BusinessProfile = {
  id: string;
  name: string;
  location: string;
  category?: string;
  categoryId?: string;
  /** P4 / geo-grid: business HQ coordinates (decimal degrees). */
  lat?: number;
  lng?: number;
  /** Canonical OSM anchor (`osm_type/osm_id`). */
  osm_place_id?: string;
  /** Best-effort Google `ChIJ…` place_id; needed by the review collector. */
  gmaps_place_id?: string | null;
  city?: string;
  country?: string;
  postcode?: string;
  unverified?: boolean;
};
export type HubId = "insights" | "reputation" | "competitors" | "tools";

/**
 * Monitoring mode (Phase 1 / Option C hybrid).
 * - `fixed`: watch the configured competitor list from listings.json (v1 model).
 * - `discovery`: onboard the user's own business + auto-discover competitors (v2 model).
 */
export type MonitoringMode = "fixed" | "discovery";

interface AppState {
  user: User | null;
  business: BusinessProfile | null;
  mode: MonitoringMode;
  runStarted: boolean;
  hub: HubId | null;
  feature: string | null;
  showHubs: boolean;
  showToday: boolean;
  paletteOpen: boolean;
  /** GMBE-inspired: keyword search term that can be set by the word cloud
   *  and consumed by the reviews filter bar (cross-feature communication). */
  searchTerm: string | null;
  login: (u: User) => void;
  logout: () => void;
  setMode: (m: MonitoringMode) => void;
  setBusiness: (b: BusinessProfile) => void;
  setActiveBusiness: (b: BusinessProfile) => void;
  startRun: () => void;
  openHub: (h: HubId) => void;
  openFeature: (id: string) => void;
  setHub: (h: HubId | null) => void;
  setFeature: (id: string | null) => void;
  setShowHubs: (v: boolean) => void;
  setShowToday: (v: boolean) => void;
  setSearchTerm: (term: string | null) => void;
  back: () => void;
  setPaletteOpen: (v: boolean) => void;
}

const KEY_USER = "rother.user";
const KEY_BIZ = "rother.business";
const KEY_RUN = "rother.runStarted";
const KEY_MODE = "rother.mode";

const Ctx = React.createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // B6 / C1: localStorage-backed state via useSyncExternalStore. No mount-time
  // `setState` effect, so there is no hydration flash and no
  // `set-state-in-effect` eslint-disable.
  const [user, setUser] = useLocalStorageState<User | null>(KEY_USER, null);
  const [business, setBusinessState] = useLocalStorageState<BusinessProfile | null>(KEY_BIZ, null);
  const [mode, setModeState] = useLocalStorageState<MonitoringMode>(KEY_MODE, "fixed");
  const [runStarted, setRunStarted] = useLocalStorageState<boolean>(KEY_RUN, false);
  const [hub, setHubState] = React.useState<HubId | null>(null);
  const [feature, setFeatureState] = React.useState<string | null>(null);
  const [showHubs, setShowHubsState] = React.useState(false);
  const [showToday, setShowTodayState] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [searchTerm, setSearchTermState] = React.useState<string | null>(null);

  const login = React.useCallback((u: User) => {
    setUser(u);
  }, [setUser]);

  const logout = React.useCallback(() => {
    setUser(null);
    setBusinessState(null);
    setRunStarted(false);
    setHubState(null);
    setFeatureState(null);
    setShowHubsState(false);
    setPaletteOpen(false);
  }, [setUser, setBusinessState, setRunStarted]);

  const setBusiness = React.useCallback((b: BusinessProfile) => {
    // Selecting (or re-selecting) a business resets the run gate — the user
    // must run a scrape for the new business before the hubs are revealed.
    setBusinessState(b);
    setRunStarted(false);
  }, [setBusinessState, setRunStarted]);

  const setActiveBusiness = setBusiness;

  const setMode = React.useCallback((m: MonitoringMode) => {
    setModeState(m);
    // Switching modes resets the run gate so the user re-runs a scrape for
    // the newly selected target (fixed list or their own business).
    setRunStarted(false);
  }, [setModeState, setRunStarted]);

  const startRun = React.useCallback(() => {
    setRunStarted(true);
  }, [setRunStarted]);

  const openHub = React.useCallback((h: HubId) => {
    setHubState(h);
    setFeatureState(null);
    setShowHubsState(false);
    setPaletteOpen(false);
  }, []);

  const openFeature = React.useCallback((id: string) => {
    const f = FEATURES.find((x) => x.id === id);
    if (f) setHubState(f.hub);
    setFeatureState(id);
    setShowHubsState(false);
    setPaletteOpen(false);
  }, []);

  const setHubCallback = React.useCallback((h: HubId | null) => {
    setHubState(h);
  }, []);

  const setFeatureCallback = React.useCallback((id: string | null) => {
    setFeatureState(id);
  }, []);

  const setShowHubsCallback = React.useCallback((v: boolean) => {
    setShowHubsState(v);
  }, []);

  const setShowTodayCallback = React.useCallback((v: boolean) => {
    setShowTodayState(v);
  }, []);

  const setSearchTerm = React.useCallback((term: string | null) => {
    setSearchTermState(term);
  }, []);

  const back = React.useCallback(() => {
    setFeatureState((f) => {
      if (f) return null;
      setHubState(null);
      setShowTodayState(false);
      return null;
    });
  }, []);

  const value = React.useMemo<AppState>(
    () => ({
      user,
      business,
      mode,
      runStarted,
      hub,
      feature,
      showHubs,
    showToday,
    paletteOpen,
    searchTerm,
    login,
    logout,
    setMode,
    setBusiness,
    setActiveBusiness,
    startRun,
    openHub,
    openFeature,
    setHub: setHubCallback,
    setFeature: setFeatureCallback,
    setShowHubs: setShowHubsCallback,
    setShowToday: setShowTodayCallback,
    setSearchTerm,
    back,
    setPaletteOpen,
  }),
  [user, business, mode, runStarted, hub, feature, showHubs, showToday, paletteOpen, searchTerm, login, logout, setMode, setBusiness, setActiveBusiness, startRun, openHub, openFeature, setHubCallback, setFeatureCallback, setShowHubsCallback, setShowTodayCallback, setSearchTerm, back],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

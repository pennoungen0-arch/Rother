"use client";

import * as React from "react";
import { ArrowRight, Check, ChevronDown, MapPin, Search, Store, Plus, Trash2, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { getCategory, searchCategories, type BusinessCategory } from "@/lib/categories";
import type { BranchConfig } from "@/lib/gbp/types";
import { osmCategoryToAppCategory, manualPlace, type Place } from "@/lib/places";
import { resolveOsmToGmaps } from "@/lib/gbp/resolve";
import type { GmapsResolution } from "@/lib/gbp/types";
import { AutocompleteInput, AddressAutocomplete } from "@/components/shell/AutocompleteInput";
import { PlaceConfirmCard } from "@/components/shell/PlaceConfirmCard";
import { PasteFromMapsParser, type ResolvedMaps } from "@/components/shell/PasteFromMapsParser";
import { toast } from "sonner";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

type GeocodeFn = (name: string, location: string) => Promise<{ lat: number; lng: number } | null>;
async function tryGeocode(name: string, location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const mod = (await import("@/lib/gbp/geocode")) as { geocodeFromText?: GeocodeFn };
    if (typeof mod.geocodeFromText === "function") return await mod.geocodeFromText(name, location);
  } catch {
    // geocode unavailable — proceed without coords
  }
  return null;
}

interface BranchDraft {
  slug: string;
  place: Place;
  gmapsPlaceId?: string;
  /** "business" = named place; "address" = address-only branch. */
  kind?: "business" | "address";
}

interface CompetitorDraft {
  competitor_id: string;
  name: string;
  gmaps_url: string;
  place_id?: string | null;
  gmaps_place_id?: string | null;
  osm_place_id?: string | null;
  lat?: number;
  lng?: number;
  category?: string;
  verified?: boolean;
}

export function Onboarding() {
  const { business, setBusiness, startRun } = useAppState();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedPlace, setSelectedPlace] = React.useState<Place | null>(null);
  const [gmapsBusinessId, setGmapsBusinessId] = React.useState<string | null>(null);
  const [categoryId, setCategoryId] = React.useState<string | undefined>(business?.categoryId);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showManual, setShowManual] = React.useState(false);
  const [showPaste, setShowPaste] = React.useState(false);
  const [manualName, setManualName] = React.useState("");
  const [manualLocation, setManualLocation] = React.useState("");

  const [branchInput, setBranchInput] = React.useState("");
  const [branchList, setBranchList] = React.useState<BranchDraft[]>([]);

  // Phase B: Competitor management
  const [competitorInput, setCompetitorInput] = React.useState("");
  const [competitorList, setCompetitorList] = React.useState<CompetitorDraft[]>([]);
  const [addingCompetitor, setAddingCompetitor] = React.useState(false);

  // Phase B: pick up the seed place from the landing screen's link validation
  React.useEffect(() => {
    const raw = sessionStorage.getItem("rother_seed_place");
    if (raw) {
      try {
        const seed = JSON.parse(raw) as Place;
        if (seed && (seed.name || seed.formatted_address)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from sessionStorage
          setSelectedPlace(seed);
          // Extract gmaps place_id if present (e.g., "gmaps/ChIJ...")
          if (seed.place_id?.startsWith("gmaps/")) {
            setGmapsBusinessId(seed.place_id.slice(6));
          }
        }
      } catch {
        // invalid JSON — ignore
      }
      sessionStorage.removeItem("rother_seed_place");
    }
  }, []);

  const valid = Boolean(selectedPlace) || (showManual && manualName.trim().length > 1 && manualLocation.trim().length > 3);

  const persistBusiness = React.useCallback(async (payload: Record<string, unknown>) => {
    try {
      await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // network failure — onboarding continues regardless
    }
  }, []);

  const onPlaceSelected = React.useCallback((place: Place) => {
    setSelectedPlace(place);
    setShowManual(false);
    const cat = osmCategoryToAppCategory(place.category);
    if (cat) setCategoryId(cat);
  }, []);

  const onMapsResolved = React.useCallback(
    (r: ResolvedMaps) => {
      setSelectedPlace(r.place);
      setGmapsBusinessId(r.gmapsPlaceId ?? null);
      const cat = osmCategoryToAppCategory(r.place.category);
      if (cat) setCategoryId(cat);
    },
    [],
  );

  // Phase B: Competitor management helpers
  const addCompetitor = React.useCallback(async (gmapsUrl: string) => {
    setAddingCompetitor(true);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(gmapsUrl)}`);
      const data = await res.json();
      if (data.places?.length > 0) {
        const place = data.places[0];
        const compId = slugify(place.name ?? gmapsUrl);
        if (competitorList.some((c) => c.competitor_id === compId)) {
          toast.info("Already added", { description: `${place.name ?? "This competitor"} is already in your list` });
        } else {
          setCompetitorList((list) => [
            ...list,
            {
              competitor_id: compId,
              name: place.name ?? gmapsUrl,
              gmaps_url: gmapsUrl,
              place_id: place.place_id?.startsWith("gmaps/") ? place.place_id.slice(6) : null,
              gmaps_place_id: place.place_id?.startsWith("gmaps/") ? place.place_id.slice(6) : null,
              osm_place_id: place.place_id?.startsWith("coord/") || place.place_id?.startsWith("osm/") ? place.place_id : null,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
              verified: place.provider === "gmaps",
            },
          ]);
          toast.success("Competitor added", { description: place.name ?? "Added to monitoring list" });
        }
        setCompetitorInput("");
      } else {
        toast.error("Could not resolve link", { description: "Try a different Google Maps link" });
      }
    } catch {
      toast.error("Failed to add competitor", { description: "Network error" });
    } finally {
      setAddingCompetitor(false);
    }
  }, [competitorList]);

  const removeCompetitor = React.useCallback((competitorId: string) => {
    const removed = competitorList.find((c) => c.competitor_id === competitorId);
    setCompetitorList((list) => list.filter((c) => c.competitor_id !== competitorId));
    if (removed) {
      toast.success("Competitor removed", { description: `${removed.name} removed from monitoring list` });
    }
  }, [competitorList]);

  const addBranch = React.useCallback((place: Place) => {
    const slug = slugify(place.name ?? place.formatted_address);
    setBranchList((list) =>
      list.some((b) => b.slug === slug) ? list : [...list, { slug, place }],
    );
  }, []);

  const removeBranch = React.useCallback((slug: string) => {
    setBranchList((list) => list.filter((b) => b.slug !== slug));
  }, []);

  // Address-only branch: a branch entered as an address rather than a named
  // business. Tagged so the data layer can distinguish branch *kinds* later
  // (address-only branches are plot-only until resolved to a place_id).
  const addAddressBranch = React.useCallback((place: Place) => {
    const slug = slugify(`${place.formatted_address}-${place.lat},${place.lng}`);
    setBranchList((list) =>
      list.some((b) => b.slug === slug)
        ? list
        : [...list, { slug, place, kind: "address" }],
    );
  }, []);

  const resolveFor = React.useCallback(
    async (place: Place, existingId?: string | null): Promise<GmapsResolution | undefined> => {
      if (!place) return undefined;
      return resolveOsmToGmaps({
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        existingGmapsId: existingId ?? null,
      });
    },
    [],
  );

  const submit = React.useCallback(async () => {
    setTouched(true);
    if (!valid) return;
    const cat = getCategory(categoryId);
    setBusy(true);

    let place = selectedPlace;
    if (showManual && !place) place = manualPlace(`${manualName.trim()}, ${manualLocation.trim()}`);

    let lat = place?.lat || undefined;
    let lng = place?.lng || undefined;
    if ((!lat || !lng) && place) {
      const c = await tryGeocode(
        showManual ? manualName.trim() : (place.name ?? ""),
        showManual ? manualLocation.trim() : (place.formatted_address ?? ""),
      );
      if (c) {
        lat = c.lat;
        lng = c.lng;
        if (showManual) place = { ...place, lat: c.lat, lng: c.lng };
      }
    }

    const finalPlace = place!;
    const resolution = await resolveFor(
      { ...finalPlace, lat: lat ?? finalPlace.lat, lng: lng ?? finalPlace.lng },
      gmapsBusinessId,
    );
    const payload: Record<string, unknown> = {
      id: slugify(finalPlace.name ?? finalPlace.formatted_address),
      name: finalPlace.name ?? finalPlace.formatted_address,
      location: finalPlace.formatted_address,
      category: cat?.label,
      categoryId: cat?.id,
      osm_place_id: finalPlace.place_id.startsWith("manual/") ? undefined : finalPlace.place_id,
      gmaps_place_id: gmapsBusinessId ?? null,
      gmaps_resolution: resolution,
      lat,
      lng,
      city: finalPlace.city,
      country: finalPlace.country,
      postcode: finalPlace.postcode,
      unverified: finalPlace.unverified ?? false,
    };
    await persistBusiness(payload);
    setBusy(false);
    setStep(2);
  }, [valid, selectedPlace, showManual, manualName, manualLocation, categoryId, gmapsBusinessId, persistBusiness, resolveFor]);

  const finish = React.useCallback(
    async (includeBranches: boolean) => {
      setBusy(true);
      const cat = getCategory(categoryId);
      const place = selectedPlace ?? manualPlace(`${manualName.trim()}, ${manualLocation.trim()}`);

      const bizResolution = await resolveFor(place, gmapsBusinessId);
      const payload: Record<string, unknown> = {
        id: slugify(place.name ?? place.formatted_address),
        name: place.name ?? place.formatted_address,
        location: place.formatted_address,
        category: cat?.label,
        categoryId: cat?.id,
        osm_place_id: place.place_id.startsWith("manual/") ? undefined : place.place_id,
        gmaps_place_id: gmapsBusinessId ?? null,
        gmaps_resolution: bizResolution,
        lat: place.lat || undefined,
        lng: place.lng || undefined,
        city: place.city,
        country: place.country,
        postcode: place.postcode,
        unverified: place.unverified ?? false,
      };
      await persistBusiness(payload);

      if (includeBranches && branchList.length > 0) {
        const resolutions = await Promise.all(branchList.map((b) => resolveFor(b.place, b.gmapsPlaceId)));
        const branches: BranchConfig[] = branchList.map((b, i) => ({
          branch_id: b.slug,
          branch_name: b.place.formatted_address || b.place.name || "",
          lat: b.place.lat || undefined,
          lng: b.place.lng || undefined,
          osm_place_id: b.place.place_id.startsWith("manual/") ? undefined : b.place.place_id,
          gmaps_place_id: b.gmapsPlaceId ?? null,
          gmaps_resolution: resolutions[i],
          city: b.place.city,
          country: b.place.country,
          postcode: b.place.postcode,
          unverified: b.place.unverified ?? false,
          branch_kind: b.kind ?? "business",
          // Phase B: include competitors in each branch
          competitors: competitorList.map((c) => ({
            competitor_id: c.competitor_id,
            name: c.name,
            gmaps_url: c.gmaps_url,
            place_id: c.place_id,
            gmaps_place_id: c.gmaps_place_id,
            osm_place_id: c.osm_place_id,
            lat: c.lat,
            lng: c.lng,
            category: c.category,
            verified: c.verified,
          })),
        }));
        try {
          await fetch("/api/business/branches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branches }),
          });
        } catch {
          // branches POST failed — non-blocking
        }
      }

      const profile: Record<string, unknown> = {
        id: slugify(place.name ?? place.formatted_address),
        name: place.name ?? place.formatted_address,
        location: place.formatted_address,
        category: cat?.label,
        categoryId: cat?.id,
        osm_place_id: place.place_id.startsWith("manual/") ? undefined : place.place_id,
        gmaps_place_id: gmapsBusinessId ?? null,
        gmaps_resolution: bizResolution,
        lat: place.lat || undefined,
        lng: place.lng || undefined,
        city: place.city,
        country: place.country,
        postcode: place.postcode,
        unverified: place.unverified ?? false,
      };
      setBusiness(profile as Parameters<typeof setBusiness>[0]);
      setBusy(false);
    },
    [selectedPlace, manualName, manualLocation, categoryId, gmapsBusinessId, branchList, competitorList, persistBusiness, setBusiness, resolveFor],
  );

  // Phase B: Start monitoring — triggers first scrape with the configured business + competitors
  const startMonitoring = React.useCallback(async () => {
    setBusy(true);
    try {
      // First, ensure business and branches are persisted
      await finish(true);
      
      // Then trigger the scrape
      const cat = getCategory(categoryId);
      const place = selectedPlace ?? manualPlace(`${manualName.trim()}, ${manualLocation.trim()}`);
      
      const body = {
        name: place.name ?? place.formatted_address,
        location: place.formatted_address,
        category: cat?.label,
        categoryId: cat?.id,
        place_id: place.place_id.startsWith("manual/") ? undefined : place.place_id,
        osm_place_id: place.place_id.startsWith("manual/") ? undefined : place.place_id,
        gmaps_place_id: gmapsBusinessId ?? null,
        lat: place.lat,
        lng: place.lng,
        city: place.city,
        country: place.country,
        postcode: place.postcode,
        unverified: place.unverified ?? false,
        branches: branchList.map((b) => ({
          branch_id: b.slug,
          branch_name: b.place.formatted_address || b.place.name || "",
          lat: b.place.lat,
          lng: b.place.lng,
          osm_place_id: b.place.place_id.startsWith("manual/") ? undefined : b.place.place_id,
          gmaps_place_id: b.gmapsPlaceId ?? null,
          branch_kind: b.kind ?? "business",
          competitors: competitorList.map((c) => ({
            competitor_id: c.competitor_id,
            name: c.name,
            gmaps_url: c.gmaps_url,
            place_id: c.place_id,
            gmaps_place_id: c.gmaps_place_id,
            osm_place_id: c.osm_place_id,
            lat: c.lat,
            lng: c.lng,
            category: c.category,
            verified: c.verified,
          })),
        })),
      };
      
      const res = await fetch("/api/scrape/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        startRun();
      }
    } catch (err) {
      console.error("Failed to start monitoring:", err);
    } finally {
      setBusy(false);
    }
  }, [selectedPlace, manualName, manualLocation, categoryId, gmapsBusinessId, branchList, competitorList, finish, startRun]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      {step === 1 ? (
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your business</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for YOUR business so we anchor the real place.
            </p>
          </div>

          <div className="space-y-5">
            {selectedPlace ? (
              <PlaceConfirmCard place={selectedPlace} onClear={() => { setSelectedPlace(null); setGmapsBusinessId(null); }} />
            ) : (
              <AutocompleteInput
                label="Your business name or address?"
                icon={<Store className="size-4" />}
                hint="Pick the matching place from OpenStreetMap. You can paste a Google Maps link below."
                placeholder="e.g. Warung Ibu Yati, Ubud"
                onSelect={onPlaceSelected}
                autoFocus
              />
            )}

            <div>
              <button
                type="button"
                onClick={() => setShowPaste((s) => !s)}
                className="text-xs text-primary hover:underline"
              >
                {showPaste ? "Hide" : "Paste a Google Maps link instead"}
              </button>
              {showPaste && (
                <div className="mt-2">
                  <PasteFromMapsParser onResolved={onMapsResolved} />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowManual((s) => !s)}
              className="text-xs text-muted-foreground hover:underline"
            >
              {showManual ? "Use search" : "Can't find it? Enter details manually"}
            </button>
            {showManual && !selectedPlace && (
              <div className="space-y-4">
                <Field icon={<Store className="size-4" />} label="Business name" hint="As customers would search for it.">
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Warung Ibu Yati"
                    aria-label="Business name"
                  />
                </Field>
                <Field icon={<MapPin className="size-4" />} label="Business location" hint="Full address so we can locate it.">
                  <Input
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="e.g. Ubud, Bali"
                    aria-label="Business location"
                  />
                </Field>
              </div>
            )}

            <Field icon={<Search className="size-4" />} label="What type of business is it?" hint="Auto-filled from the place; you can change it.">
              <CategorySelect value={categoryId} onChange={setCategoryId} />
            </Field>
          </div>

          <Button type="submit" size="lg" className="mt-7 w-full" disabled={!valid || busy} onClick={() => void submit()}>
            Continue
            <ArrowRight className="size-4" />
          </Button>

          {touched && !valid && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Search for your business (or enter it manually) to continue.
            </p>
          )}
        </div>
      ) : step === 2 ? (
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Add your own branch locations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional. Add any of your own branches so they&apos;re plotted and monitored. You can skip this for now.
            </p>
          </div>

          <div className="space-y-4">
            {!branchInput && (
              <AutocompleteInput
                label="Add a branch"
                icon={<MapPin className="size-4" />}
                hint="Each branch is anchored to its real place."
                placeholder="e.g. Warung Ibu Yati — Canggu"
                onSelect={(p) => {
                  addBranch(p);
                  setBranchInput("");
                }}
              />
            )}

            {!branchInput && (
              <AddressAutocomplete
                icon={<MapPin className="size-4" />}
                hint="Partial typing is fine — live suggestions will appear (e.g. 'Jl. Raya Seminyak 12')."
                biasLat={selectedPlace?.lat}
                biasLng={selectedPlace?.lng}
                onSelect={(p) => {
                  addAddressBranch(p);
                  setBranchInput("");
                }}
              />
            )}

            {branchList.length > 0 && (
              <ul className="space-y-2">
                {branchList.map((b) => (
                  <li key={b.slug}>
                    <PlaceConfirmCard place={b.place} onClear={() => removeBranch(b.slug)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-2">
            <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => { setStep(3); }}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setStep(3); }}>
              Skip for now
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Add competitors to monitor</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a Google Maps link for each competitor. We&apos;ll validate and add them to your monitoring list.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://maps.app.goo.gl/... or https://maps.google.com/place/..."
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && competitorInput.trim() && addCompetitor(competitorInput)}
                disabled={addingCompetitor}
                aria-label="Competitor Google Maps link"
              />
              <Button
                type="button"
                onClick={() => competitorInput.trim() && addCompetitor(competitorInput)}
                disabled={!competitorInput.trim() || addingCompetitor}
              >
                {addingCompetitor ? (
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <>
                    <Plus className="size-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>

            {competitorList.length > 0 && (
              <ul className="space-y-2">
                {competitorList.map((c) => (
                  <li key={c.competitor_id} className="flex items-center justify-between gap-2 p-2 border border-border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.gmaps_url}</p>
                      {c.verified && <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Verified</span>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCompetitor(c.competitor_id)}
                      aria-label="Remove competitor"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {competitorList.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No competitors added yet. Add at least one to start monitoring.
              </p>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={busy || competitorList.length === 0}
              onClick={() => void startMonitoring()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Starting monitoring…
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  Start Monitoring
                </>
              )}
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => void finish(false)}>
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selected = getCategory(value);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const results = React.useMemo<BusinessCategory[]>(() => searchCategories(query), [query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.label : "Select a category"}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              aria-label="Search categories"
              className="h-9"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No categories found.</li>
            )}
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {c.label}
                  {c.id === value && <Check className="size-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

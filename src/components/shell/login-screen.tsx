"use client";

import * as React from "react";
import { MapPin, ShieldCheck, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { toast } from "sonner";

/**
 * Landing screen — Discovery-first flow.
 *
 * Primary action: Paste a Google Maps link → validate → preview → start monitoring.
 * Secondary: "Advanced" link for Fixed competitor list mode (legacy listings.json).
 */
export function LoginScreen() {
  const { setMode, login } = useAppState();
  const [busy, setBusy] = React.useState(false);
  const [link, setLink] = React.useState("");
  const [validating, setValidating] = React.useState(false);
  const [place, setPlace] = React.useState<{
    name: string | null;
    formatted_address: string;
    lat: number;
    lng: number;
    provider: string;
    place_id: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const validateLink = React.useCallback(async () => {
    const trimmed = link.trim();
    if (!trimmed) return;
    setValidating(true);
    setError(null);
    setPlace(null);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.places?.length > 0) {
        setPlace(data.places[0]);
        toast.success("Link validated", {
          description: `Found ${data.places[0].name ?? "business"} at ${data.places[0].formatted_address ?? "unknown address"}`,
        });
      } else {
        const msg = "Could not resolve that link. Try a full Google Maps place URL or short link.";
        setError(msg);
        toast.error("Invalid link", { description: msg });
      }
    } catch {
      const msg = "Network error validating link.";
      setError(msg);
      toast.error("Validation failed", { description: msg });
    } finally {
      setValidating(false);
    }
  }, [link]);

  const handleContinue = React.useCallback(async () => {
    if (!place) return;
    setBusy(true);
    // Store the validated place for onboarding to pick up
    sessionStorage.setItem("rother_seed_place", JSON.stringify(place));
    // Sign in (mock) and switch to discovery mode (the onboarding flow).
    // Without a user, AppShell keeps rendering LoginScreen and the flow dead-ends.
    login({
      name: "Business Owner",
      email: "owner@gmail.com",
    });
    setMode("discovery");
    toast.success("Starting monitoring setup", {
      description: `${place.name ?? "Business"} will be configured in onboarding`,
    });
    setBusy(false);
  }, [place, login, setMode]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {/* Rother mark */}
            <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
              <circle cx="16" cy="16" r="13" fill="currentColor" opacity="0.15" />
              <path
                d="M9 22V10h4.2c3 0 5 1.7 5 4.6 0 2.9-2 4.6-5 4.6H12V22h-3zm3.2-7.1h.9c1.3 0 2.1-.7 2.1-2s-.8-2-2.1-2h-.9v4zm8.1 7.1V10h3v12h-3z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Rother</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Competitor review intelligence for your business.
          </p>
        </div>

        {place ? (
          <div className="mb-5 space-y-3 animate-in slide-in-from-top-2">
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {place.name ?? "Unnamed business"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {place.formatted_address || `${place.lat}, ${place.lng}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Provider: {place.provider} • {place.place_id}
                  </p>
                </div>
              </div>
              <Button size="lg" className="w-full mt-2" onClick={handleContinue} disabled={busy}>
                <ArrowRight className="size-4 mr-2" />
                {busy ? "Starting…" : "Continue to monitoring"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setPlace(null)}
            >
              <ArrowRight className="size-3.5 mr-1.5 rotate-180" />
              Change link
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-5 space-y-3">
              <label className="block text-sm font-medium" htmlFor="maps-link">
                Paste a Google Maps business link
              </label>
              <div className="flex gap-2">
                <Input
                  id="maps-link"
                  type="url"
                  placeholder="https://maps.app.goo.gl/... or https://maps.google.com/place/..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && validateLink()}
                  disabled={validating}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={validateLink}
                  disabled={validating || !link.trim()}
                  aria-label="Validate link"
                >
                  {validating ? (
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="31.4 31.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Works with: <code className="px-1 bg-muted rounded">maps.app.goo.gl/…</code>,{" "}
              <code className="px-1 bg-muted rounded">google.com/maps/place/…</code>,{" "}
              <code className="px-1 bg-muted rounded">goo.gl/maps/…</code>
            </p>
          </>
        )}

        <div className="mt-6 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced: Fixed competitor list (uses listings.json)
          </Button>

          {showAdvanced && (
            <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
              <p className="text-xs text-muted-foreground">
                Use this if you already have a <code className="px-1 bg-muted rounded">gbp-monitor/config/listings.json</code> with configured branches and competitors.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode("fixed")}
                >
                  Fixed competitor list
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode("discovery")}
                >
                  Discovery (my business)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Or sign in directly for Fixed mode:
              </p>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => {
                  setMode("fixed");
                  // Mock login for fixed mode (uses context login which dispatches custom event)
                  login({
                    name: "Business Owner",
                    email: "owner@gmail.com",
                    avatar: "https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png",
                  });
                }}
              >
                Sign in with Gmail
              </Button>
            </div>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Your data stays on this device.
        </p>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Demo build — Google sign-in is mocked for local preview.
      </p>
    </div>
  );
}

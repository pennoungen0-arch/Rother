"use client";

import * as React from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  Package,
  Play,
  Terminal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/lib/gbp/use-api-query";
import { useApiMutation } from "@/lib/gbp/use-api-mutation";
import { useAppState } from "@/lib/app-state";

interface DetectionStatus {
  python: {
    available: boolean;
    executable: string | null;
    version: string | null;
  };
  packages: {
    allInstalled: boolean;
    missing: string[];
    checked: string[];
  };
  chromium: {
    available: boolean;
    message: string;
  };
  config: {
    listings: boolean;
    selectors: boolean;
    requirements: boolean;
  };
  gbpRoot: string;
}

type InstallStep = "packages" | "chromium";

export default function SetupWizard() {
  const { openFeature } = useAppState();
  const [activeStep, setActiveStep] = React.useState<InstallStep | null>(null);
  const [installLog, setInstallLog] = React.useState<string[]>([]);
  const [elapsed, setElapsed] = React.useState(0);

  const {
    data: detection,
    loading: detecting,
    refresh,
  } = useApiQuery<DetectionStatus>("setup-detect", "/api/setup/detect", {
    static: false,
  });

  const mutation = useApiMutation("/api/setup/install", {
    onSuccess: (data: { ok: boolean; step: string; output: string[]; message: string }) => {
      setInstallLog(data.output ?? []);
      refresh();
    },
  });

  // P3-U8: Elapsed time counter during install
  React.useEffect(() => {
    if (!mutation.isPending) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [mutation.isPending, setElapsed]);
  // Reset elapsed when install starts (mutation becomes pending)
  const wasPendingRef = React.useRef(false);
  React.useEffect(() => {
    if (mutation.isPending && !wasPendingRef.current) {
      setElapsed(0);
    }
    wasPendingRef.current = mutation.isPending;
  }, [mutation.isPending, setElapsed]);

  const allOk = detection && detection.python.available && detection.packages.allInstalled && detection.chromium.available;

  const runInstall = (step: InstallStep) => {
    setActiveStep(step);
    setInstallLog([]);
    mutation.mutate({ step });
  };

  const resetInstall = () => {
    setActiveStep(null);
    setInstallLog([]);
  };

  if (detecting) {
    return (
      <div className="p-6">
        <p>Checking Python, packages, and Chromium...</p>
      </div>
    );
  }

  if (!detection) {
    return (
      <div className="p-6">
        <p>Failed to detect setup status.</p>
        <Button onClick={() => refresh()} variant="outline" size="sm">
          Retry detection
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scraper Setup Wizard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verify Python, dependencies, and Chromium are ready for live scraping.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detection Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="h-5 w-5 text-primary" />
              <span>Python</span>
            </div>
            <div className="flex items-center gap-2">
              {detection.python.available ? (
                <>
                  <span className="text-sm text-green-600 font-medium">Available</span>
                  <span className="text-xs text-muted-foreground">{detection.python.version}</span>
                </>
              ) : (
                <span className="text-sm text-red-600 font-medium">Not found</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <span>Python packages</span>
            </div>
            <div className="flex items-center gap-2">
              {detection.packages.allInstalled ? (
                <span className="text-sm text-green-600 font-medium">All installed</span>
              ) : (
                <>
                  <span className="text-sm text-orange-600 font-medium">Missing</span>
                  <span className="text-xs text-muted-foreground">
                    {detection.packages.missing.join(", ")}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-primary" />
              <span>Chromium (Playwright)</span>
            </div>
            <div className="flex items-center gap-2">
              {detection.chromium.available ? (
                <span className="text-sm text-green-600 font-medium">Ready</span>
              ) : (
                <span className="text-sm text-red-600 font-medium">Not installed</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Copy className="h-5 w-5 text-primary" />
              <span>Config files</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={detection.config.listings ? "text-green-600" : "text-red-600"}>
                {detection.config.listings ? "listings ✓" : "listings ✗"}
              </span>
              <span className={detection.config.selectors ? "text-green-600" : "text-red-600"}>
                {detection.config.selectors ? "selectors ✓" : "selectors ✗"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!allOk && detection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guided Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fix issues in order. Each step runs a command and shows its output.
            </p>

            <div className="space-y-3">
              {!detection.packages.allInstalled && detection.python.available && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Install missing Python packages</span>
                  {activeStep === "packages" ? (
                    mutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full w-full rounded-full bg-primary animate-pulse" />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{elapsed}s</span>
                      </div>
                    ) : (
                      <Button onClick={resetInstall} variant="ghost" size="sm">
                        Reset
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={() => runInstall("packages")}
                      disabled={mutation.isPending}
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run pip install
                    </Button>
                  )}
                </div>
              )}

              {!detection.chromium.available && detection.python.available && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Install Playwright Chromium</span>
                  {activeStep === "chromium" ? (
                    mutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full w-full rounded-full bg-primary animate-pulse" />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{elapsed}s</span>
                      </div>
                    ) : (
                      <Button onClick={resetInstall} variant="ghost" size="sm">
                        Reset
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={() => runInstall("chromium")}
                      disabled={mutation.isPending}
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run playwright install
                    </Button>
                  )}
                </div>
              )}
            </div>

            {installLog.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <h4 className="text-xs font-semibold mb-2">Install output:</h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {installLog.join("\n")}
                </pre>
              </div>
            )}

            {!detection.python.available && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                Python was not found. Install Python 3.10+ and ensure it is on your PATH.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {allOk && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">All setup checks passed</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Your scraper is ready. Navigate to the Config or Onboarding hub to start monitoring.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => refresh()} size="sm">
          Re-run detection
        </Button>
        {allOk && (
          <Button size="sm" onClick={() => openFeature("t-config")}>
            Continue to Config
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

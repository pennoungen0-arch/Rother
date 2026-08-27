"use client";

import * as React from "react";
import { Activity, GitCompare, History, ScrollText } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunHealthCard } from "@/components/dashboard/run-health";
import { RunHistoryTimeline } from "@/components/dashboard/run-history-timeline";
import { RunComparisonCard } from "@/components/dashboard/run-comparison-card";
import { LogsSection } from "@/components/dashboard/logs-section";

const TABS = [
  { id: "health", label: "Health", icon: Activity },
  { id: "history", label: "History", icon: History },
  { id: "compare", label: "Compare", icon: GitCompare },
  { id: "logs", label: "Logs", icon: ScrollText },
] as const;

export default function RunsFeature() {
  const [activeTab, setActiveTab] = React.useState("health");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-muted-foreground">
          Scrape run health, history, comparison, and logs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="size-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="health">
          <RunHealthCard />
        </TabsContent>

        <TabsContent value="history">
          <RunHistoryTimeline refreshKey={0} />
        </TabsContent>

        <TabsContent value="compare">
          <RunComparisonCard refreshKey={0} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

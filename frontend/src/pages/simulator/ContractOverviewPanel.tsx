import { useEffect, useState } from "react";
import { Activity, Clock, Database, FileCheck, ShieldAlert, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { fetchContractHealth, type ContractHealth } from "../../api/adminHealth";
import type { SimulatorContract } from "./simulatorShared";

type ContractOverviewPanelProps = {
  contract: SimulatorContract;
};

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function ContractOverviewPanel({ contract }: ContractOverviewPanelProps) {
  const [health, setHealth] = useState<ContractHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchContractHealth(contract.id, controller.signal)
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [contract.id]);

  if (loading) {
    return (
      <div className="sim-panel p-6">
        <p className="text-[0.75rem] text-slate-500">Loading health data...</p>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="sim-panel p-6">
        <p className="text-[0.75rem] text-rose-300">Failed to load contract health.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Last Update</span>
            <Clock className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value text-[1.1rem]">
            {formatRelativeTime(health.lastUpdateAt)}
          </p>
          <p className="sim-stat-card__sub">
            {health.staleSinceMinutes != null ? `${health.staleSinceMinutes} min ago` : "No data received"}
          </p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Ingests</span>
            <Database className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value text-[1.1rem]">{health.totalUpdates}</p>
          <p className="sim-stat-card__sub">
            {health.processedCount} processed, {health.unprocessedCount} unprocessed
          </p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Update Frequency</span>
            <Activity className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value text-[1.1rem]">
            {health.updateFrequencyMinutes != null ? `${health.updateFrequencyMinutes} min` : "—"}
          </p>
          <p className="sim-stat-card__sub">Avg interval (last 24h)</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Active Alerts</span>
            <ShieldAlert className={cn("size-4", health.activeAlertCount > 0 ? "text-rose-500" : "text-slate-600")} />
          </div>
          <p className={cn("sim-stat-card__value text-[1.1rem]", health.activeAlertCount > 0 && "text-rose-400")}>
            {health.activeAlertCount}
          </p>
          <p className="sim-stat-card__sub">Unresolved</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Milestones</span>
            <Workflow className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value text-[1.1rem]">
            {health.milestonesCompleted}/{health.milestonesTotal}
          </p>
          <p className="sim-stat-card__sub">
            {health.overdueMilestoneCount > 0
              ? `${health.overdueMilestoneCount} overdue`
              : "On track"}
          </p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Ingest Profile</span>
            <FileCheck className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value text-[1.1rem]">
            {health.ingestProfileKey ?? "None"}
          </p>
          <p className="sim-stat-card__sub">
            {health.ingestProfileVersion != null ? `v${health.ingestProfileVersion}` : "No binding"}
          </p>
        </div>
      </div>

      {/* Last Known State */}
      <div className="sim-panel">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.82rem] font-semibold text-white">Last Known State</h3>
            <Badge className="border-white/[0.06] bg-white/[0.04] text-[0.6rem] text-slate-500">
              From ingested data
            </Badge>
          </div>
        </div>
        <div className="p-4">
          {Object.keys(health.lastKnownState).length === 0 ? (
            <p className="text-[0.72rem] text-slate-500">No state data received yet.</p>
          ) : (
            <ScrollArea className="max-h-[24rem]">
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(health.lastKnownState).map(([key, value]) => (
                  <div
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    key={key}
                  >
                    <p className="text-[0.62rem] uppercase tracking-wider text-slate-500">{key}</p>
                    <p className="mt-0.5 text-[0.78rem] font-medium tabular-nums text-white">
                      {typeof value === "object" ? prettyJson(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

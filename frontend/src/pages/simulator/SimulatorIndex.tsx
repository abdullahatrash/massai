import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  Clock,
  HeartPulse,
  Plus,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import {
  fetchContractsHealthSummary,
  type ContractHealthSummary,
} from "../../api/adminHealth";
import { CreateContractDialog } from "./CreateContractDialog";
import {
  type SimulatorOutletContext,
  getPilotMeta,
  getPilotTheme,
} from "./simulatorShared";

const STALE_THRESHOLD_MINUTES = 30;

type HealthLevel = "critical" | "healthy" | "stale" | "unknown";

function deriveHealthLevel(item: ContractHealthSummary): HealthLevel {
  if (item.activeAlertCount > 0) return "critical";
  if (item.staleSinceMinutes != null && item.staleSinceMinutes > STALE_THRESHOLD_MINUTES) return "stale";
  if (item.totalUpdates > 0) return "healthy";
  return "unknown";
}

function getHealthAccentClass(level: HealthLevel) {
  if (level === "critical") return "from-rose-400 to-rose-500";
  if (level === "stale") return "from-amber-400 to-orange-500";
  if (level === "healthy") return "from-emerald-400 to-cyan-500";
  return "from-slate-500 to-slate-600";
}

function getHealthDotClass(level: HealthLevel) {
  if (level === "critical") return "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]";
  if (level === "stale") return "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]";
  if (level === "healthy") return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]";
  return "bg-slate-500";
}

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

export function SimulatorIndex() {
  const { connectionState, contractsState, refreshSimulatorData } =
    useOutletContext<SimulatorOutletContext>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [healthData, setHealthData] = useState<ContractHealthSummary[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);

  const contracts = contractsState.status === "success" ? contractsState.contracts : [];

  useEffect(() => {
    const controller = new AbortController();
    setHealthLoading(true);
    fetchContractsHealthSummary(controller.signal)
      .then((data) => {
        setHealthData(data);
        setHealthLoading(false);
      })
      .catch(() => {
        setHealthLoading(false);
      });
    return () => controller.abort();
  }, [contractsState]);

  // Compute stats from health data
  const healthyCount = healthData.filter((h) => deriveHealthLevel(h) === "healthy").length;
  const staleCount = healthData.filter((h) => deriveHealthLevel(h) === "stale").length;
  const totalAlerts = healthData.reduce((sum, h) => sum + h.activeAlertCount, 0);

  // Build a lookup map for health data by contractId
  const healthByContractId = new Map(healthData.map((h) => [h.contractId, h]));

  return (
    <div className="space-y-6">
      {/* ── HERO STRIP ── */}
      <section className="sim-hero">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.4rem] font-semibold tracking-tight text-white">
            Operations Deck
          </h2>
          <p className="max-w-xl text-[0.82rem] leading-relaxed text-slate-400">
            Monitor contract health, inspect ingested data, debug issues,
            and launch lightweight contract testing from one operator console.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            type="button"
          >
            <Plus data-icon="inline-start" />
            New Contract
          </Button>
          <Link to="/admin/guide">
            <Button size="sm" type="button" variant="outline">
              <BookOpen data-icon="inline-start" />
              Guide
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-[0.68rem]">
            <span className="text-slate-400">{connectionState.details}</span>
          </div>
        </div>
      </section>

      <CreateContractDialog
        onClose={() => setShowCreateDialog(false)}
        onCreated={refreshSimulatorData}
        open={showCreateDialog}
      />

      {/* ── HEALTH STAT CARDS ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Contracts</span>
            <Boxes className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value">{contracts.length}</p>
          <p className="sim-stat-card__sub">Total active</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Healthy</span>
            <HeartPulse className="size-4 text-emerald-600" />
          </div>
          <p className="sim-stat-card__value text-emerald-400">
            {healthLoading ? "—" : healthyCount}
          </p>
          <p className="sim-stat-card__sub">Recent updates, no alerts</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Stale</span>
            <Clock className="size-4 text-amber-600" />
          </div>
          <p className="sim-stat-card__value text-amber-400">
            {healthLoading ? "—" : staleCount}
          </p>
          <p className="sim-stat-card__sub">No updates in 30+ min</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Active Alerts</span>
            <ShieldAlert className="size-4 text-rose-600" />
          </div>
          <p className="sim-stat-card__value text-rose-400">
            {healthLoading ? "—" : totalAlerts}
          </p>
          <p className="sim-stat-card__sub">Unresolved across all contracts</p>
        </div>
      </div>

      {/* ── CONTRACT GRID ── */}
      {contractsState.status === "success" && contracts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Contract Health
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contracts.map((contract) => {
              const pilotMeta = getPilotMeta(contract.pilotType);
              const pilotTheme = getPilotTheme(contract.pilotType);
              const health = healthByContractId.get(contract.id);
              const level = health ? deriveHealthLevel(health) : "unknown";
              const progressValue =
                contract.milestonesTotal > 0
                  ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
                  : 0;

              return (
                <Link key={contract.id} to={`/admin/contracts/${contract.id}/overview`}>
                  <div className="sim-contract-card group">
                    {/* Health accent line */}
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity group-hover:opacity-100 bg-gradient-to-r",
                        getHealthAccentClass(level),
                      )}
                    />

                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-lg text-[0.65rem] font-bold tracking-wide",
                          pilotTheme.iconClassName,
                        )}
                      >
                        {pilotMeta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-[0.58rem]", pilotTheme.badgeClassName)}>
                            {pilotMeta.label}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("size-1.5 rounded-full", getHealthDotClass(level))} />
                            <span className="text-[0.58rem] capitalize text-slate-500">{level}</span>
                          </div>
                        </div>
                        <p className="mt-2 truncate text-[0.88rem] font-semibold text-white">
                          {contract.productName ?? contract.id}
                        </p>
                        <p className="mt-0.5 truncate text-[0.7rem] text-slate-500">{contract.id}</p>
                      </div>
                    </div>

                    {/* Health indicators */}
                    {health && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                          <p className="text-[0.68rem] font-medium tabular-nums text-slate-300">
                            {formatRelativeTime(health.lastUpdateAt)}
                          </p>
                          <p className="text-[0.55rem] text-slate-600">Last update</p>
                        </div>
                        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                          <p className={cn(
                            "text-[0.68rem] font-medium tabular-nums",
                            health.activeAlertCount > 0 ? "text-rose-400" : "text-slate-300",
                          )}>
                            {health.activeAlertCount}
                          </p>
                          <p className="text-[0.55rem] text-slate-600">Alerts</p>
                        </div>
                        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                          <p className="text-[0.68rem] font-medium tabular-nums text-slate-300">
                            {health.totalUpdates}
                          </p>
                          <p className="text-[0.55rem] text-slate-600">Ingests</p>
                        </div>
                      </div>
                    )}

                    {/* Milestone progress (secondary) */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[0.65rem]">
                        <span className="text-slate-500">Milestones</span>
                        <span className="tabular-nums text-slate-400">
                          {contract.milestonesCompleted}/{contract.milestonesTotal}
                          {health && health.overdueMilestoneCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400">
                              <AlertTriangle className="inline size-2.5" />
                              {health.overdueMilestoneCount} overdue
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress className={cn("h-1", pilotTheme.progressClassName)} value={progressValue}>
                        <span className="sr-only">Milestone progress</span>
                      </Progress>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[0.72rem] text-slate-400 transition group-hover:border-white/10 group-hover:text-white">
                      <span>Inspect contract</span>
                      <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {contractsState.status === "loading" && (
        <div className="sim-empty-state">
          Loading contract data from backend...
        </div>
      )}

      {contractsState.status === "error" && (
        <div className="sim-empty-state sim-empty-state--error">
          {contractsState.message}
        </div>
      )}
    </div>
  );
}

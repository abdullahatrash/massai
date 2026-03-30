import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, AudioLines, Boxes, Gauge, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import {
  type SimulatorOutletContext,
  getPilotMeta,
  getPilotTheme,
} from "./simulatorShared";

export function SimulatorIndex() {
  const { connectionState, contractsState } = useOutletContext<SimulatorOutletContext>();
  const contracts = contractsState.status === "success" ? contractsState.contracts : [];

  const pilotCount = new Set(contracts.map((c) => c.pilotType ?? "UNKNOWN")).size;
  const averageCompletion =
    contracts.length > 0
      ? Math.round(
          contracts.reduce((total, contract) => {
            if (contract.milestonesTotal === 0) return total;
            return total + contract.milestonesCompleted / contract.milestonesTotal;
          }, 0) /
            contracts.length *
            100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* ── HERO STRIP ── */}
      <section className="sim-hero">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.4rem] font-semibold tracking-tight text-white">
            Operations Deck
          </h2>
          <p className="max-w-xl text-[0.82rem] leading-relaxed text-slate-400">
            Test sends, scenario playback, milestone triggers, and live socket
            telemetry — all inside one controlled operator workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[0.68rem]">
          <Badge className="border-amber-400/20 bg-amber-400/8 text-amber-300">
            Dev only
          </Badge>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{connectionState.details}</span>
        </div>
      </section>

      {/* ── STAT CARDS ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Contracts</span>
            <Boxes className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value">{contracts.length}</p>
          <p className="sim-stat-card__sub">Seeded & available</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Pilots</span>
            <Radar className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value">{pilotCount}</p>
          <p className="sim-stat-card__sub">Distinct types</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Completion</span>
            <Gauge className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value">{averageCompletion}%</p>
          <p className="sim-stat-card__sub">Milestone average</p>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Telemetry</span>
            <AudioLines className="size-4 text-slate-600" />
          </div>
          <p className="sim-stat-card__value">
            {contracts.length > 0 ? "Ready" : "Idle"}
          </p>
          <p className="sim-stat-card__sub">Live socket feed</p>
        </div>
      </div>

      {/* ── CONTRACT GRID ── */}
      {contractsState.status === "success" && contracts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Select a contract
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contracts.map((contract) => {
              const pilotMeta = getPilotMeta(contract.pilotType);
              const pilotTheme = getPilotTheme(contract.pilotType);
              const progressValue =
                contract.milestonesTotal > 0
                  ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
                  : 0;

              return (
                <Link key={contract.id} to={`/simulator/${contract.id}`}>
                  <div className="sim-contract-card group">
                    {/* Accent line */}
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity group-hover:opacity-100",
                        pilotTheme.iconClassName.includes("sky")
                          ? "bg-gradient-to-r from-sky-400 to-blue-500"
                          : pilotTheme.iconClassName.includes("amber")
                            ? "bg-gradient-to-r from-amber-400 to-orange-500"
                            : pilotTheme.iconClassName.includes("emerald")
                              ? "bg-gradient-to-r from-emerald-400 to-cyan-500"
                              : "bg-gradient-to-r from-white/40 to-white/20",
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
                          <Badge className="border-white/8 bg-white/[0.04] text-[0.58rem] text-slate-400">
                            {contract.statusBadge}
                          </Badge>
                        </div>
                        <p className="mt-2 truncate text-[0.88rem] font-semibold text-white">
                          {contract.productName ?? contract.id}
                        </p>
                        <p className="mt-0.5 truncate text-[0.7rem] text-slate-500">{contract.id}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-[0.68rem]">
                        <span className="text-slate-400">Milestones</span>
                        <span className="font-medium tabular-nums text-slate-300">
                          {contract.milestonesCompleted}/{contract.milestonesTotal}
                        </span>
                      </div>
                      <Progress className={cn("h-1.5", pilotTheme.progressClassName)} value={progressValue}>
                        <span className="sr-only">Readiness</span>
                      </Progress>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[0.72rem] text-slate-400 transition group-hover:border-white/10 group-hover:text-white">
                      <span>Open workspace</span>
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

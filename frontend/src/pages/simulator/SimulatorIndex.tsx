import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, AudioLines, Boxes, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <section className="grid gap-5">
      <Card className="overflow-hidden border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <CardHeader className="relative gap-5 border-b border-white/8 pb-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.18),transparent_28%)] opacity-60" />
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <Badge className="border-white/15 bg-white/8 text-white/70">Control room</Badge>
              <CardTitle className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                Pick a seeded contract and drop into a dedicated operator deck
              </CardTitle>
              <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Each pilot keeps its own scenario runner, manual update form, milestone tools, and
                live event stream while staying visually consistent across the simulator.
              </CardDescription>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Backend signal
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{connectionState.details}</p>
              <p className="mt-2 text-sm text-slate-300">
                Use this page as the staging layer before opening a specific contract workspace.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Seeded contracts
              </span>
              <Boxes className="text-slate-500" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              {contracts.length}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Live telemetry
              </span>
              <AudioLines className="text-slate-500" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              {contracts.length > 0 ? "Ready" : "Idle"}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Factory posture
              </span>
              <Radar className="text-slate-500" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              {contractsState.status === "success" ? "Online" : "Waiting"}
            </p>
          </div>
        </CardContent>
      </Card>

      {contractsState.status === "success" ? (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {contracts.map((contract) => {
            const pilotMeta = getPilotMeta(contract.pilotType);
            const pilotTheme = getPilotTheme(contract.pilotType);
            const progressValue =
              contract.milestonesTotal > 0
                ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
                : 0;

            return (
              <Link key={contract.id} to={`/simulator/${contract.id}`}>
                <Card className="group h-full overflow-hidden border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:border-white/18 hover:bg-white/[0.07]">
                  <CardHeader className="relative gap-4 border-b border-white/8 pb-4">
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                        pilotTheme.highlightClassName,
                      )}
                    />
                    <div className="relative flex items-start gap-3">
                      <span
                        className={cn(
                          "grid size-14 place-items-center rounded-2xl border text-sm font-semibold tracking-[0.18em]",
                          pilotTheme.iconClassName,
                        )}
                      >
                        {pilotMeta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={pilotTheme.badgeClassName}>{pilotMeta.label}</Badge>
                          <Badge className="border-white/12 bg-white/8 text-white/70">
                            {contract.statusBadge}
                          </Badge>
                        </div>
                        <CardTitle className="mt-4 truncate text-2xl text-white">
                          {contract.productName ?? contract.id}
                        </CardTitle>
                        <CardDescription className="mt-2 truncate text-slate-300">
                          {contract.id}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-5">
                    <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      <span>Milestone progression</span>
                      <span className="font-medium text-white">
                        {contract.milestonesCompleted}/{contract.milestonesTotal}
                      </span>
                    </div>
                    <Progress className={cn("gap-2", pilotTheme.progressClassName)} value={progressValue}>
                      <span className="text-sm font-medium text-white">Readiness</span>
                      <span className="ml-auto text-sm text-slate-300">{progressValue}%</span>
                    </Progress>
                    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
                      <span>Open simulator deck</span>
                      <ArrowRight className="transition duration-200 group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

import { startTransition, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { CalendarDays, RadioTower, Sparkles, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { EventLogPanel } from "./EventLogPanel";
import { MilestoneTriggerPanel } from "./MilestoneTriggerPanel";
import {
  type SimulatorOutletContext,
  getPilotMeta,
  getPilotTheme,
} from "./simulatorShared";
import { ManualSendForm } from "./ManualSendForm";
import { ScenarioRunner } from "./ScenarioRunner";

function formatDeliveryDate(deliveryDate: string | null) {
  if (!deliveryDate) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(deliveryDate));
}

type SimulatorTab = "manual" | "milestones" | "scenarios";

export function ContractSimulator() {
  const { contractId } = useParams();
  const { contractsState, refreshSimulatorData } = useOutletContext<SimulatorOutletContext>();
  const [activeTab, setActiveTab] = useState<SimulatorTab>("scenarios");

  if (contractsState.status === "loading") {
    return (
      <Card className="border-white/10 bg-white/[0.045] text-white shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <CardHeader>
          <CardTitle>Loading contract simulator</CardTitle>
          <CardDescription className="text-slate-300">
            Waiting for the seeded contract list before mounting the operator workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (contractsState.status === "error") {
    return (
      <Card className="border-rose-300/15 bg-rose-950/25 text-white shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <CardHeader>
          <CardTitle>Simulator unavailable</CardTitle>
          <CardDescription className="text-rose-100/85">{contractsState.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const contract = contractsState.contracts.find((entry) => entry.id === contractId);

  if (!contract) {
    return (
      <Card className="border-rose-300/15 bg-rose-950/25 text-white shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <CardHeader>
          <CardTitle>Contract not found</CardTitle>
          <CardDescription className="text-rose-100/85">
            The requested seeded contract is not available in this simulator session.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pilotMeta = getPilotMeta(contract.pilotType);
  const pilotTheme = getPilotTheme(contract.pilotType);
  const progressRatio =
    contract.milestonesTotal > 0
      ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
      : 0;

  return (
    <section className="grid gap-5">
      <Card className="overflow-hidden border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <CardHeader className="relative gap-5 border-b border-white/8 pb-5">
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-85",
              pilotTheme.highlightClassName,
            )}
          />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={pilotTheme.badgeClassName}>{pilotMeta.label}</Badge>
                <Badge className="border-white/12 bg-white/8 text-white/70">
                  {contract.statusBadge}
                </Badge>
              </div>
              <CardTitle className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                {pilotMeta.simulatorHeading} for {contract.productName ?? contract.id}
              </CardTitle>
              <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Scenario playback, manual sends, milestone transitions, and live socket feedback all
                stay scoped to this single seeded contract workspace.
              </CardDescription>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Contract identity
              </p>
              <p className="mt-3 truncate text-lg font-semibold text-white">{contract.id}</p>
              <p className="mt-2 text-sm text-slate-300">
                Provider: {contract.providerId ?? "Not configured"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Delivery target
              </span>
              <CalendarDays className="text-slate-500" />
            </div>
            <p className="mt-4 text-xl font-semibold text-white">
              {formatDeliveryDate(contract.deliveryDate)}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Provider status
              </span>
              <RadioTower className="text-slate-500" />
            </div>
            <p className="mt-4 text-xl font-semibold text-white">
              {contract.providerId ? "Configured" : "Needs credentials"}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Operator mode
              </span>
              <Sparkles className="text-slate-500" />
            </div>
            <p className="mt-4 text-xl font-semibold text-white">Live simulation</p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Milestone progress
              </span>
              <Workflow className="text-slate-500" />
            </div>
            <div className="mt-4">
              <Progress className={cn("gap-2", pilotTheme.progressClassName)} value={progressRatio}>
                <span className="text-sm font-medium text-white">Readiness</span>
                <span className="ml-auto text-sm text-slate-300">
                  {contract.milestonesCompleted}/{contract.milestonesTotal}
                </span>
              </Progress>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs
          className="gap-4"
          onValueChange={(value) =>
            startTransition(() => setActiveTab(value as SimulatorTab))
          }
          value={activeTab}
        >
          <TabsList
            className="w-full justify-start rounded-[22px] border border-white/10 bg-white/[0.05] p-1"
            variant="default"
          >
            <TabsTrigger className="rounded-[18px] px-4" value="scenarios">
              Scenarios
            </TabsTrigger>
            <TabsTrigger className="rounded-[18px] px-4" value="manual">
              Manual send
            </TabsTrigger>
            <TabsTrigger className="rounded-[18px] px-4" value="milestones">
              Milestones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios">
            <ScenarioRunner contract={contract} onPlaybackSettled={refreshSimulatorData} />
          </TabsContent>

          <TabsContent value="manual">
            <ManualSendForm contract={contract} onSubmitSettled={refreshSimulatorData} />
          </TabsContent>

          <TabsContent value="milestones">
            <MilestoneTriggerPanel
              contract={contract}
              onSubmissionSettled={refreshSimulatorData}
            />
          </TabsContent>
        </Tabs>

        <EventLogPanel contractId={contract.id} />
      </div>
    </section>
  );
}

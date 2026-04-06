import { startTransition, useCallback, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Radio, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { deleteDemoContract } from "../../api/adminContracts";
import { ContractAlertsPanel } from "./ContractAlertsPanel";
import { ContractMilestonesPanel } from "./ContractMilestonesPanel";
import { ContractOverviewPanel } from "./ContractOverviewPanel";
import { EventLogPanel, useEventLogStream } from "./EventLogPanel";
import { IngestHistoryPanel } from "./IngestHistoryPanel";
import { SimulationWorkspace } from "./SimulationWorkspace";
import {
  type SimulatorOutletContext,
  getPilotMeta,
  getPilotTheme,
} from "./simulatorShared";

type InspectorTab = "alerts" | "history" | "milestones" | "overview" | "simulation";

export function ContractSimulator() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { contractsState, refreshSimulatorData } = useOutletContext<SimulatorOutletContext>();
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [deleting, setDeleting] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleEventCountChange = useCallback(
    (count: number) => {
      setEventCount(count);
      if (!sheetOpen && count > 0) {
        setHasNewEvents(true);
      }
    },
    [sheetOpen],
  );

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (open) {
      setHasNewEvents(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!contractId || deleting) return;
    if (!window.confirm("Delete this contract and all its data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteDemoContract(contractId);
      refreshSimulatorData();
      navigate("/simulator");
    } catch {
      setDeleting(false);
    }
  };

  const eventLogState = useEventLogStream(contractId, handleEventCountChange);

  if (contractsState.status === "loading") {
    return (
      <div className="sim-empty-state">
        Loading contract data...
      </div>
    );
  }

  if (contractsState.status === "error") {
    return (
      <div className="sim-empty-state sim-empty-state--error">
        {contractsState.message}
      </div>
    );
  }

  const contract = contractsState.contracts.find((entry) => entry.id === contractId);

  if (!contract) {
    return (
      <div className="sim-empty-state sim-empty-state--error">
        The requested contract is not available in this session.
      </div>
    );
  }

  const pilotMeta = getPilotMeta(contract.pilotType);
  const pilotTheme = getPilotTheme(contract.pilotType);

  const accentGradient = pilotTheme.iconClassName.includes("sky")
    ? "from-sky-400/10 via-blue-500/5 to-transparent"
    : pilotTheme.iconClassName.includes("amber")
      ? "from-amber-400/10 via-orange-500/5 to-transparent"
      : pilotTheme.iconClassName.includes("emerald")
        ? "from-emerald-400/10 via-cyan-500/5 to-transparent"
        : "from-white/5 via-white/[0.02] to-transparent";

  const accentLine = pilotTheme.iconClassName.includes("sky")
    ? "bg-gradient-to-r from-sky-400 to-blue-500"
    : pilotTheme.iconClassName.includes("amber")
      ? "bg-gradient-to-r from-amber-400 to-orange-500"
      : pilotTheme.iconClassName.includes("emerald")
        ? "bg-gradient-to-r from-emerald-400 to-cyan-500"
        : "bg-gradient-to-r from-white/40 to-white/20";

  return (
    <div className="space-y-5">
      {/* ── CONTRACT HEADER ── */}
      <section className="sim-contract-header relative overflow-hidden">
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", accentGradient)} />
        <div className={cn("absolute inset-x-0 top-0 h-[2px]", accentLine)} />

        <div className="relative flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl text-sm font-bold tracking-wide",
                pilotTheme.iconClassName,
              )}
            >
              {pilotMeta.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("text-[0.6rem]", pilotTheme.badgeClassName)}>{pilotMeta.label}</Badge>
                <Badge className="border-white/8 bg-white/[0.04] text-[0.6rem] text-slate-400">
                  {contract.statusBadge}
                </Badge>
              </div>
              <h2 className="mt-2 text-[1.2rem] font-semibold tracking-tight text-white">
                {contract.productName ?? contract.id}
              </h2>
              <p className="mt-0.5 text-[0.72rem] text-slate-500">{contract.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Delete Contract */}
            <Button
              className="text-slate-500 hover:text-rose-400"
              disabled={deleting}
              onClick={() => void handleDeleteContract()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-3.5" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>

            {/* Event Log Trigger */}
            <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
              <SheetTrigger className="sim-event-trigger group">
                <Radio className={cn(
                  "size-4 text-slate-400 transition group-hover:text-white",
                  hasNewEvents && "text-emerald-400 animate-pulse",
                )} />
                <span className="text-[0.72rem] text-slate-400 transition group-hover:text-white">
                  Events
                </span>
                {eventCount > 0 && (
                  <span className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[0.55rem] font-bold tabular-nums",
                    hasNewEvents
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                      : "bg-white/[0.08] text-slate-400",
                  )}>
                    {eventCount > 99 ? "99+" : eventCount}
                  </span>
                )}
              </SheetTrigger>

              <SheetContent
                className="flex w-[420px] flex-col border-white/[0.06] bg-[#0a0f16] p-0 text-white sm:max-w-[420px]"
                showCloseButton={false}
                side="right"
              >
                <SheetTitle className="sr-only">Event Log</SheetTitle>
                <EventLogPanel state={eventLogState} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </section>

      {/* ── INSPECTOR TABS ── */}
      <Tabs
        className="gap-4"
        onValueChange={(value) =>
          startTransition(() => setActiveTab(value as InspectorTab))
        }
        value={activeTab}
      >
        <TabsList
          className="w-fit rounded-xl border border-white/[0.06] bg-white/[0.03] p-1"
          variant="default"
        >
          <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="history">
            Ingest History
          </TabsTrigger>
          <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="alerts">
            Alerts
          </TabsTrigger>
          <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="milestones">
            Milestones
          </TabsTrigger>
          <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="simulation">
            Simulation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContractOverviewPanel contract={contract} />
        </TabsContent>

        <TabsContent value="history">
          <IngestHistoryPanel contract={contract} />
        </TabsContent>

        <TabsContent value="alerts">
          <ContractAlertsPanel contract={contract} />
        </TabsContent>

        <TabsContent value="milestones">
          <ContractMilestonesPanel contract={contract} />
        </TabsContent>

        <TabsContent value="simulation">
          <SimulationWorkspace contract={contract} refreshSimulatorData={refreshSimulatorData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

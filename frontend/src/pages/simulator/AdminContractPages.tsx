import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Radio, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { deleteDemoContract } from "../../api/adminContracts";
import { ContractAlertsPanel } from "./ContractAlertsPanel";
import { ContractMilestonesPanel } from "./ContractMilestonesPanel";
import { ContractOverviewPanel } from "./ContractOverviewPanel";
import { EventLogPanel, useEventLogStream } from "./EventLogPanel";
import { IngestHistoryPanel } from "./IngestHistoryPanel";
import { SimulationWorkspace } from "./SimulationWorkspace";
import {
  type SimulatorContract,
  type SimulatorOutletContext,
  getPilotMeta,
  getPilotTheme,
} from "./simulatorShared";

type AdminContractContext = {
  contract: SimulatorContract;
  refreshSimulatorData: () => void;
};

const contractSectionLinks = [
  { label: "Overview", to: "overview" },
  { label: "Ingest", to: "ingest" },
  { label: "Alerts", to: "alerts" },
  { label: "Milestones", to: "milestones" },
  { label: "Events", to: "events" },
  { label: "Testing", to: "testing" },
] as const;

export function AdminContractLayout() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { contractsState, refreshSimulatorData } = useOutletContext<SimulatorOutletContext>();
  const [deleting, setDeleting] = useState(false);

  const contract = useMemo(() => {
    if (contractsState.status !== "success" || !contractId) {
      return null;
    }
    return contractsState.contracts.find((entry) => entry.id === contractId) ?? null;
  }, [contractId, contractsState]);

  if (contractsState.status === "loading") {
    return <div className="sim-empty-state">Loading contract data...</div>;
  }

  if (contractsState.status === "error") {
    return (
      <div className="sim-empty-state sim-empty-state--error">
        {contractsState.message}
      </div>
    );
  }

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

  const handleDeleteContract = async () => {
    if (!contractId || deleting) return;
    if (!window.confirm("Delete this contract and all its data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteDemoContract(contractId);
      refreshSimulatorData();
      navigate("/admin");
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
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
                <Badge className={cn("text-[0.6rem]", pilotTheme.badgeClassName)}>
                  {pilotMeta.label}
                </Badge>
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
            <NavLink to="events">
              <Button size="sm" type="button" variant="outline">
                <Radio className="size-3.5" />
                Events
              </Button>
            </NavLink>
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
          </div>
        </div>
      </section>

      <nav
        aria-label="Admin contract sections"
        className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-1"
      >
        {contractSectionLinks.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "inline-flex items-center rounded-lg px-4 py-2 text-[0.78rem] font-medium whitespace-nowrap text-slate-400 transition hover:bg-white/[0.06] hover:text-white",
                isActive && "bg-white/[0.08] text-white",
              )
            }
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ contract, refreshSimulatorData }} />
    </div>
  );
}

export function useAdminContractContext() {
  return useOutletContext<AdminContractContext>();
}

export function AdminContractOverviewPage() {
  const { contract } = useAdminContractContext();
  return <ContractOverviewPanel contract={contract} />;
}

export function AdminContractIngestPage() {
  const { contract } = useAdminContractContext();
  return <IngestHistoryPanel contract={contract} />;
}

export function AdminContractAlertsPage() {
  const { contract } = useAdminContractContext();
  return <ContractAlertsPanel contract={contract} />;
}

export function AdminContractMilestonesPage() {
  const { contract } = useAdminContractContext();
  return <ContractMilestonesPanel contract={contract} />;
}

export function AdminContractTestingPage() {
  const { contract, refreshSimulatorData } = useAdminContractContext();
  return <SimulationWorkspace contract={contract} refreshSimulatorData={refreshSimulatorData} />;
}

export function AdminContractEventsPage() {
  const { contract } = useAdminContractContext();
  const eventLogState = useEventLogStream(contract.id);
  return (
    <div className="sim-panel overflow-hidden">
      <EventLogPanel state={eventLogState} />
    </div>
  );
}

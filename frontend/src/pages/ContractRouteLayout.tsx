import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useParams } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Eye,
  FileText,
  Milestone,
  Radio,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { listActiveAlerts } from "../api/alerts";
import { ApiError } from "../api/client";
import {
  getContractOverview,
  getPilotPresentation,
  type ContractOverview,
} from "../api/contracts";
import { NotFoundPage } from "./NotFoundPage";

export type ContractOutletContext = {
  contract: ContractOverview;
};

const contractSectionLinks: Array<{
  end?: boolean;
  icon: React.ReactNode;
  label: string;
  to: string;
}> = [
  { end: true, icon: <Eye className="size-3.5" />, label: "Overview", to: "." },
  { icon: <Milestone className="size-3.5" />, label: "Milestones", to: "milestones" },
  { icon: <Radio className="size-3.5" />, label: "Live Feed", to: "feed" },
  { icon: <AlertTriangle className="size-3.5" />, label: "Alerts", to: "alerts" },
  { icon: <FileText className="size-3.5" />, label: "Documents", to: "documents" },
  { icon: <BarChart3 className="size-3.5" />, label: "Analytics", to: "analytics" },
];

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "Not scheduled";
  }
  return format(parseISO(value), "d MMM yyyy");
}

function getNextMilestoneLabel(contract: ContractOverview): string {
  if (!contract.nextMilestone) {
    return "None";
  }

  const relativeTime = formatDistanceToNowStrict(parseISO(contract.nextMilestone.plannedDate), {
    addSuffix: true,
  });

  return `${contract.nextMilestone.name} (${relativeTime})`;
}

const PILOT_BADGE: Record<string, string> = {
  factor: "border-amber-200 bg-amber-50 text-amber-700",
  tasowheel: "border-emerald-200 bg-emerald-50 text-emerald-700",
  e4m: "border-sky-200 bg-sky-50 text-sky-700",
};

const PILOT_ICON_BG: Record<string, string> = {
  factor: "bg-amber-100 text-amber-700",
  tasowheel: "bg-emerald-100 text-emerald-700",
  e4m: "bg-sky-100 text-sky-700",
};

const STATUS_BADGE: Record<string, string> = {
  ACTION_REQUIRED: "border-rose-200 bg-rose-50 text-rose-700",
  DELAYED: "border-amber-200 bg-amber-50 text-amber-700",
  ON_TRACK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-stone-200 bg-stone-50 text-stone-500",
  DISPUTED: "border-rose-200 bg-rose-50 text-rose-700",
};

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTION_REQUIRED: "Action required",
    COMPLETED: "Completed",
    DELAYED: "Delayed",
    DISPUTED: "Disputed",
    ON_TRACK: "On track",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

export function ContractRouteLayout() {
  const { contractId } = useParams();

  const contractQuery = useQuery({
    enabled: Boolean(contractId),
    queryFn: () => getContractOverview(contractId!),
    queryKey: ["contract-overview", contractId],
  });
  const alertsQuery = useQuery({
    enabled: Boolean(contractId),
    queryFn: () => listActiveAlerts(contractId!),
    queryKey: ["contract-alerts", contractId],
  });

  if (!contractId) {
    return (
      <NotFoundPage
        actionLabel="Open contracts"
        actionTo="/contracts"
        description="No contract identifier was provided in the route."
        title="Contract not found"
      />
    );
  }

  if (contractQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="dash-hero animate-pulse">
          <div className="h-5 w-24 rounded-md bg-stone-200" />
          <div className="mt-3 h-7 w-64 rounded-md bg-stone-200" />
          <div className="mt-2 h-4 w-96 rounded-md bg-stone-100" />
        </div>
      </div>
    );
  }

  if (contractQuery.error instanceof ApiError && contractQuery.error.status === 404) {
    return (
      <NotFoundPage
        actionLabel="Back to contracts"
        actionTo="/contracts"
        description={`We could not find a contract matching "${contractId}".`}
        title="Contract not found"
      />
    );
  }

  if (contractQuery.error) {
    return (
      <div className="dash-hero space-y-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-rose-500" />
          <h3 className="text-[0.88rem] font-semibold text-stone-900">Unable to load this contract</h3>
        </div>
        <p className="text-[0.78rem] text-stone-500">{contractQuery.error.message}</p>
        <Button onClick={() => void contractQuery.refetch()} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  const contract = contractQuery.data;
  const pilot = getPilotPresentation(contract.pilotType);
  const pilotKey = (contract.pilotType ?? "").toLowerCase();
  const progressPct =
    contract.milestonesTotal > 0
      ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
      : 0;
  const alertCount = alertsQuery.data?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* ── CONTRACT HEADER ── */}
      <section className="dash-hero">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "grid size-14 shrink-0 place-items-center rounded-xl text-sm font-bold",
                PILOT_ICON_BG[pilotKey] ?? "bg-stone-100 text-stone-600",
              )}
            >
              {pilot.label.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("text-xs", PILOT_BADGE[pilotKey] ?? "border-stone-200 bg-stone-50 text-stone-600")}>
                  {pilot.label}
                </Badge>
                <Badge className={cn("text-xs", STATUS_BADGE[contract.statusBadge] ?? "border-stone-200 bg-stone-50 text-stone-500")}>
                  {getStatusLabel(contract.statusBadge)}
                </Badge>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
                {contract.productName ?? contract.id}
              </h2>
              <p className="mt-1 font-mono text-sm text-stone-500">{contract.id}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 shrink-0 text-stone-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Delivery</p>
                <p className="text-sm font-medium text-stone-800">{formatDateLabel(contract.deliveryDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="size-5 shrink-0 text-stone-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Progress</p>
                <p className="text-sm font-medium text-stone-800">{contract.milestonesCompleted}/{contract.milestonesTotal} milestones</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Milestone className="size-5 shrink-0 text-stone-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Next</p>
                <p className="max-w-[22ch] truncate text-sm font-medium text-stone-800">{getNextMilestoneLabel(contract)}</p>
              </div>
            </div>
            <div className="w-36">
              <Progress className="h-2" value={progressPct} />
              <p className="mt-1.5 text-xs tabular-nums text-stone-500">{progressPct}% complete</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TAB NAVIGATION ── */}
      <nav aria-label="Contract sections" className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white/50 p-1.5 backdrop-blur-sm">
        {contractSectionLinks.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-stone-500 transition hover:bg-stone-100 hover:text-stone-700",
                isActive && "bg-white text-stone-900 shadow-sm",
              )
            }
            end={item.end}
            key={item.label}
            to={item.to}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.label === "Alerts" && alertCount > 0 ? (
              <Badge className="ml-1 border-rose-200 bg-rose-50 px-1.5 py-0 text-xs text-rose-600">
                {alertCount}
              </Badge>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <Outlet context={{ contract }} />
    </div>
  );
}

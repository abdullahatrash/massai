import { format, isValid, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  FileText,
  Layers,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  formatProviderName,
  getPilotPresentation,
  listContracts,
  type ContractListItem,
  type ContractStatusBadge,
} from "../api/contracts";

/* ── Utilities (unchanged logic) ── */

function statusPriority(status: ContractStatusBadge): number {
  switch (status) {
    case "ACTION_REQUIRED":
      return 0;
    case "DELAYED":
      return 1;
    case "ON_TRACK":
      return 2;
    case "COMPLETED":
      return 3;
    case "DISPUTED":
      return 4;
    default:
      return 5;
  }
}

function sortContracts(contracts: ContractListItem[]): ContractListItem[] {
  return [...contracts].sort((left, right) => {
    const statusDelta = statusPriority(left.statusBadge) - statusPriority(right.statusBadge);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const leftTime = left.deliveryDate ? Date.parse(left.deliveryDate) : Number.POSITIVE_INFINITY;
    const rightTime = right.deliveryDate
      ? Date.parse(right.deliveryDate)
      : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return (left.productName ?? left.id).localeCompare(right.productName ?? right.id);
  });
}

function formatDeliveryDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  const parsedDate = parseISO(value);
  if (!isValid(parsedDate)) {
    return value;
  }

  return format(parsedDate, "d MMM yyyy");
}

/* ── Status Badge (shadcn) ── */

const STATUS_CONFIG: Record<ContractStatusBadge, { label: string; className: string }> = {
  ACTION_REQUIRED: {
    label: "Action required",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  DELAYED: {
    label: "Delayed",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  ON_TRACK: {
    label: "On track",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  COMPLETED: {
    label: "Completed",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
  DISPUTED: {
    label: "Disputed",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function getStatusConfig(status: ContractStatusBadge) {
  return STATUS_CONFIG[status] ?? { label: status, className: "border-slate-200 bg-slate-50 text-slate-500" };
}

/* ── Pilot badge config ── */

const PILOT_BADGE_CONFIG: Record<string, { className: string; accentLine: string }> = {
  factor: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    accentLine: "bg-gradient-to-r from-amber-400 to-orange-400",
  },
  tasowheel: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accentLine: "bg-gradient-to-r from-emerald-400 to-teal-400",
  },
  e4m: {
    className: "border-sky-200 bg-sky-50 text-sky-700",
    accentLine: "bg-gradient-to-r from-sky-400 to-blue-400",
  },
  default: {
    className: "border-slate-200 bg-slate-50 text-slate-600",
    accentLine: "bg-gradient-to-r from-slate-300 to-slate-400",
  },
};

function getPilotBadgeConfig(pilotType: string | null) {
  const key = (pilotType ?? "").toLowerCase();
  return PILOT_BADGE_CONFIG[key] ?? PILOT_BADGE_CONFIG.default;
}

/* ── Loading Skeleton ── */

function ContractsListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="dash-card animate-pulse">
          <CardHeader className="gap-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 rounded-md bg-stone-100" />
              <div className="h-5 w-20 rounded-md bg-stone-100" />
            </div>
            <div className="h-6 w-3/4 rounded-md bg-stone-100" />
            <div className="h-4 w-1/2 rounded-md bg-stone-100" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-3 w-full rounded-full bg-stone-100" />
            <div className="h-4 w-1/3 rounded-md bg-stone-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Contract Card ── */

function ContractCard({ contract }: { contract: ContractListItem }) {
  const pilot = getPilotPresentation(contract.pilotType);
  const pilotBadge = getPilotBadgeConfig(contract.pilotType);
  const statusConfig = getStatusConfig(contract.statusBadge);
  const providerName = formatProviderName(contract.providerId);
  const productName = contract.productName ?? contract.id;
  const progressValue =
    contract.milestonesTotal > 0
      ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
      : 0;

  return (
    <Link className="group block" to={`/contracts/${contract.id}`}>
      <Card className="dash-card relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        {/* Accent top line */}
        <div className={cn("absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity group-hover:opacity-100", pilotBadge.accentLine)} />

        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("text-[0.62rem]", pilotBadge.className)}>
              {pilot.label}
            </Badge>
            <Badge className={cn("text-[0.62rem]", statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>

          <div>
            <h3 className="text-[0.92rem] font-semibold tracking-tight text-stone-900">
              {productName}
            </h3>
            <p className="mt-0.5 text-[0.72rem] text-stone-500">
              {providerName}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-[0.68rem] text-stone-500">
            <div className="flex items-center gap-1.5">
              <FileText className="size-3" />
              <span className="max-w-[14ch] truncate font-mono">{contract.id}</span>
            </div>
            <Separator orientation="vertical" className="h-3" />
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3" />
              <span>{formatDeliveryDate(contract.deliveryDate)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[0.68rem]">
              <span className="text-stone-500">Milestones</span>
              <span className="font-medium tabular-nums text-stone-700">
                {contract.milestonesCompleted}/{contract.milestonesTotal}
              </span>
            </div>
            <Progress className="h-1.5" value={progressValue} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[0.7rem] text-stone-500 transition group-hover:border-stone-300 group-hover:text-stone-700">
            <span>View contract</span>
            <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ── Main Page ── */

export function ContractsList() {
  const contractsQuery = useQuery({
    queryFn: () => listContracts(),
    queryKey: ["contracts"],
    select: (response) => ({
      contracts: sortContracts(response.data),
      meta: response.meta,
    }),
  });

  const contractCount = contractsQuery.data?.contracts.length ?? 0;
  const unreadNotifications = contractsQuery.data?.meta?.unreadNotifications ?? 0;
  const actionCount = contractsQuery.data?.contracts.filter((c) => c.statusBadge === "ACTION_REQUIRED").length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Hero Section ── */}
      <section className="dash-hero">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.4rem] font-semibold tracking-tight text-stone-900">
            Your Production Contracts
          </h2>
          <p className="max-w-lg text-[0.82rem] leading-relaxed text-stone-500">
            Review delivery status, milestone progress, and which contracts
            need your attention.
          </p>
        </div>
      </section>

      {/* ── Stat Strip ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="dash-stat-card">
          <div className="flex items-center justify-between">
            <span className="dash-stat-card__label">Contracts</span>
            <Layers className="size-4 text-stone-400" />
          </div>
          <p className="dash-stat-card__value">{contractCount}</p>
          <p className="dash-stat-card__sub">Assigned to your account</p>
        </div>

        <div className="dash-stat-card">
          <div className="flex items-center justify-between">
            <span className="dash-stat-card__label">Notifications</span>
            <Bell className="size-4 text-stone-400" />
          </div>
          <p className="dash-stat-card__value">{unreadNotifications}</p>
          <p className="dash-stat-card__sub">Unread alerts & updates</p>
        </div>

        <div className="dash-stat-card">
          <div className="flex items-center justify-between">
            <span className="dash-stat-card__label">Action Required</span>
            <AlertCircle className="size-4 text-stone-400" />
          </div>
          <p className={cn("dash-stat-card__value", actionCount > 0 && "text-rose-600")}>
            {actionCount}
          </p>
          <p className="dash-stat-card__sub">Contracts needing attention</p>
        </div>
      </div>

      {/* ── Loading ── */}
      {contractsQuery.isPending ? <ContractsListSkeleton /> : null}

      {/* ── Error ── */}
      {contractsQuery.isError ? (
        <Card className="dash-card border-rose-200 bg-rose-50/50">
          <CardContent className="flex items-center gap-4 py-6">
            <AlertCircle className="size-5 shrink-0 text-rose-500" />
            <div className="flex-1">
              <p className="text-[0.82rem] font-medium text-rose-800">Unable to load contracts</p>
              <p className="mt-0.5 text-[0.72rem] text-rose-600/70">{contractsQuery.error.message}</p>
            </div>
            <Button
              onClick={() => void contractsQuery.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Empty State ── */}
      {contractsQuery.isSuccess && contractsQuery.data.contracts.length === 0 ? (
        <Card className="dash-card">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto size-8 text-stone-300" />
            <p className="mt-3 text-[0.88rem] font-medium text-stone-600">
              No contracts assigned
            </p>
            <p className="mt-1 text-[0.72rem] text-stone-400">
              Once a contract is linked to your consumer identity, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Contract Grid ── */}
      {contractsQuery.isSuccess && contractsQuery.data.contracts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-400">
              All contracts
            </h3>
            <span className="text-[0.62rem] text-stone-400">
              Sorted by priority
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {contractsQuery.data.contracts.map((contract) => (
              <ContractCard contract={contract} key={contract.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

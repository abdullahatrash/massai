import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Milestone,
  Radio,
  ShieldCheck,
  Wifi,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatQualityPercent, getQualityStatus } from "@/lib/quality";
import { cn } from "@/lib/utils";

import { listActiveAlerts } from "../api/alerts";
import { type ContractOverview as ContractOverviewData, getPilotPresentation } from "../api/contracts";
import { listMilestones, type MilestoneSummary } from "../api/milestones";
import { listTimeline, type TimelineEvent } from "../api/timeline";
import { useWebSocket } from "../hooks/useWebSocket";
import type { ContractOutletContext } from "./ContractRouteLayout";

/* ── Utility functions (all logic preserved) ── */

function formatDateLabel(value: string | null): string {
  if (!value) return "Not scheduled";
  const parsedDate = parseISO(value);
  if (!isValid(parsedDate)) return value;
  return format(parsedDate, "d MMM yyyy");
}

function formatPercent(value: unknown): string {
  if (typeof value !== "number") return "N/A";
  return `${Math.round(value * 100)}%`;
}

function formatWholePercent(value: unknown): string {
  if (typeof value !== "number") return "N/A";
  return `${Math.round(value)}%`;
}

function formatCount(value: unknown): string {
  if (typeof value !== "number") return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSentenceCase(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "Unavailable";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getDeliveryCountdown(deliveryDate: string | null): { label: string; tone: "danger" | "default" } {
  if (!deliveryDate) return { label: "Date pending", tone: "default" };
  const parsedDate = parseISO(deliveryDate);
  const remainingDays = differenceInCalendarDays(parsedDate, new Date());
  if (remainingDays > 0) return { label: `${remainingDays}d remaining`, tone: "default" };
  if (remainingDays === 0) return { label: "Due today", tone: "default" };
  return { label: `${Math.abs(remainingDays)}d overdue`, tone: "danger" };
}

function getCurrentStageLabel(contract: ContractOverviewData): string {
  const state = contract.lastKnownState;
  const pilotType = (contract.pilotType ?? "").toUpperCase();
  if (pilotType === "FACTOR") return formatSentenceCase(state.currentStage);
  if (pilotType === "TASOWHEEL") {
    const stepName = typeof state.stepName === "string" ? state.stepName : null;
    if (stepName) return stepName;
    return typeof state.routingStep === "number" ? `Routing step ${state.routingStep}` : "Awaiting data";
  }
  if (pilotType === "E4M") return typeof state.currentPhase === "string" ? state.currentPhase : "N/A";
  return "N/A";
}

type MetricDef = { label: string; value: string; detail?: string; tone?: "accent" | "danger" | "default" | "warning" };

function buildMetrics(contract: ContractOverviewData): MetricDef[] {
  const state = contract.lastKnownState;
  const pilotType = (contract.pilotType ?? "").toUpperCase();

  if (pilotType === "FACTOR") {
    const qualityStatus = getQualityStatus(
      typeof state.qualityPassRate === "number" ? state.qualityPassRate : null,
      contract.qualityTarget,
    );
    const qualityTone =
      qualityStatus === "green"
        ? "accent"
        : qualityStatus === "amber"
          ? "warning"
          : qualityStatus === "red"
            ? "danger"
            : "default";

    return [
      { label: "Qty produced", value: formatCount(state.quantityProduced), detail: typeof state.quantityPlanned === "number" ? `of ${formatCount(state.quantityPlanned)} planned` : "Latest update" },
      {
        label: "Quality pass",
        value: formatQualityPercent(
          typeof state.qualityPassRate === "number" ? state.qualityPassRate : null,
          "N/A",
        ),
        tone: qualityTone,
        detail:
          contract.qualityTarget !== null && contract.qualityTarget !== undefined
            ? `Contract target ${formatQualityPercent(contract.qualityTarget, "N/A")}`
            : "Latest check",
      },
    ];
  }
  if (pilotType === "TASOWHEEL") {
    return [
      { label: "Routing step", value: typeof state.routingStep === "number" ? `Step ${state.routingStep}` : "N/A", detail: typeof state.stepName === "string" ? state.stepName : "Current waypoint" },
      { label: "Step status", value: formatSentenceCase(state.stepStatus), tone: state.stepStatus === "COMPLETE" ? "accent" : "default", detail: typeof state.cycleTimeActualSec === "number" ? `${state.cycleTimeActualSec}s cycle` : "Latest status" },
    ];
  }
  if (pilotType === "E4M") {
    return [
      { label: "Phase", value: typeof state.currentPhase === "string" ? state.currentPhase : "N/A", tone: "accent", detail: "Current milestone" },
      { label: "Completion", value: formatWholePercent(state.completionPct), detail: "Current phase" },
    ];
  }
  return Object.entries(state).slice(0, 2).map(([key, value]) => ({
    label: key, value: typeof value === "string" ? value : JSON.stringify(value), detail: "Contract state",
  }));
}

function getNextPendingMilestone(milestones: MilestoneSummary[]): MilestoneSummary | null {
  const candidates = milestones.filter(
    (m) => m.plannedDate !== null && !["COMPLETED", "REJECTED"].includes((m.status ?? "").toUpperCase()),
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const aDate = a.plannedDate ? Date.parse(a.plannedDate) : Infinity;
    const bDate = b.plannedDate ? Date.parse(b.plannedDate) : Infinity;
    return aDate - bDate;
  })[0];
}

function getRecentEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 5);
}

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  "alert-triangle": <AlertTriangle className="size-4 text-rose-500" />,
  "check-circle": <CheckCircle2 className="size-4 text-emerald-500" />,
  "file-check": <FileText className="size-4 text-sky-500" />,
  flag: <Milestone className="size-4 text-amber-500" />,
  hourglass: <Clock className="size-4 text-amber-500" />,
  "x-circle": <AlertTriangle className="size-4 text-rose-500" />,
};

const METRIC_TONE: Record<string, string> = {
  accent: "border-l-emerald-400",
  danger: "border-l-rose-400",
  default: "border-l-stone-300",
  warning: "border-l-amber-400",
};

/* ── Component ── */

export function ContractOverview() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const queryClient = useQueryClient();
  const deliveryCountdown = getDeliveryCountdown(contract.deliveryDate);

  const milestonesQuery = useQuery({
    queryFn: () => listMilestones(contract.id),
    queryKey: ["contract-milestones", contract.id],
  });
  const alertsQuery = useQuery({
    queryFn: () => listActiveAlerts(contract.id),
    queryKey: ["contract-alerts", contract.id],
  });
  const timelineQuery = useQuery({
    queryFn: () => listTimeline(contract.id),
    queryKey: ["contract-timeline", contract.id],
  });

  const { lastMessage, status } = useWebSocket({
    contractId: contract.id,
    onMessage: (message) => {
      if (message.type === "CONTRACT_NOT_FOUND") return;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contract-overview", contract.id] }),
        queryClient.invalidateQueries({ queryKey: ["contract-milestones", contract.id] }),
        queryClient.invalidateQueries({ queryKey: ["contract-alerts", contract.id] }),
        queryClient.invalidateQueries({ queryKey: ["contract-timeline", contract.id] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      ]);
    },
  });

  const nextMilestone = milestonesQuery.data ? getNextPendingMilestone(milestonesQuery.data) : null;
  const metrics = buildMetrics(contract);
  const recentEvents = timelineQuery.data ? getRecentEvents(timelineQuery.data) : [];
  const activeAlertCount = alertsQuery.data?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* ── STATUS ROW ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white/60 px-2.5 py-1">
          <span className={cn(
            "size-1.5 rounded-full",
            status === "connected" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400 animate-pulse" : "bg-stone-300",
          )} />
          <span className="text-sm font-medium text-stone-600">
            {status === "connected" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
          </span>
        </div>
        <Badge className={cn(
          "text-xs",
          deliveryCountdown.tone === "danger"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-stone-200 bg-stone-50 text-stone-600",
        )}>
          {deliveryCountdown.label}
        </Badge>
        <span className="text-sm text-stone-400">
          Stage: <span className="font-medium text-stone-600">{getCurrentStageLabel(contract)}</span>
        </span>
      </div>

      {/* ── PROGRESS CARDS ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="dash-card">
          <CardContent className="space-y-3 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Milestone Progress</p>
            <Progress className="h-2" value={contract.milestonesTotal > 0 ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100) : 0} />
            <div className="flex items-center justify-between text-[0.72rem]">
              <span className="text-stone-500">{contract.milestonesCompleted} of {contract.milestonesTotal} complete</span>
              <span className="font-medium text-stone-700">{getCurrentStageLabel(contract)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="dash-card">
          <CardContent className="space-y-3 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Next Milestone</p>
            {milestonesQuery.isPending ? (
              <p className="text-sm text-stone-400">Loading...</p>
            ) : nextMilestone ? (
              <>
                <p className="text-lg font-semibold text-stone-900">{nextMilestone.name}</p>
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <CalendarDays className="size-3" />
                  <span>{formatDateLabel(nextMilestone.plannedDate)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={cn(
                    "text-xs",
                    nextMilestone.approvalRequired
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}>
                    <ShieldCheck className="mr-1 size-3" />
                    {nextMilestone.approvalRequired ? "Approval required" : "Auto-verified"}
                  </Badge>
                  {nextMilestone.isOverdue && (
                    <Badge className="border-rose-200 bg-rose-50 text-xs text-rose-700">
                      Overdue
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-400">No upcoming milestone scheduled.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── METRICS ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <Card key={metric.label} className={cn("dash-card border-l-[3px]", METRIC_TONE[metric.tone ?? "default"])}>
            <CardContent className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{metric.value}</p>
              {metric.detail && <p className="mt-0.5 text-sm text-stone-500">{metric.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── ACTION LINKS ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="group block" to="milestones">
          <Card className="dash-card transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Action</p>
                <p className="mt-1 text-base font-semibold text-stone-900">View Milestones</p>
                <p className="mt-0.5 text-sm text-stone-500">Delivery sequence & approvals</p>
              </div>
              <ArrowRight className="size-4 text-stone-400 transition group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link className="group block" to="alerts">
          <Card className="dash-card transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Action</p>
                  {activeAlertCount > 0 && (
                    <Badge className="border-rose-200 bg-rose-50 px-1.5 py-0 text-xs text-rose-600">
                      {activeAlertCount}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-base font-semibold text-stone-900">View Alerts</p>
                <p className="mt-0.5 text-sm text-stone-500">Active risks & acknowledgements</p>
              </div>
              <ArrowRight className="size-4 text-stone-400 transition group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link className="group block" to="documents">
          <Card className="dash-card transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Action</p>
                <p className="mt-1 text-base font-semibold text-stone-900">View Documents</p>
                <p className="mt-0.5 text-sm text-stone-500">Evidence & document trail</p>
              </div>
              <ArrowRight className="size-4 text-stone-400 transition group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── ACTIVITY FEED ── */}
      <Card className="dash-card">
        <CardContent className="py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recent Activity</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-900">Latest contract events</h3>

          {timelineQuery.isPending && (
            <p className="mt-3 text-sm text-stone-400">Loading timeline...</p>
          )}

          {!timelineQuery.isPending && recentEvents.length === 0 && (
            <p className="mt-3 text-sm text-stone-400">No recent activity recorded.</p>
          )}

          {!timelineQuery.isPending && recentEvents.length > 0 && (
            <div className="mt-4 grid gap-2">
              {recentEvents.map((event) => (
                <div className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5" key={event.id}>
                  <div className="mt-0.5 shrink-0">
                    {TIMELINE_ICONS[event.icon] ?? <Radio className="size-3.5 text-stone-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-700">{event.description}</p>
                    <p className="mt-0.5 text-xs text-stone-400">{format(new Date(event.timestamp), "d MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── LIVE EVENT ── */}
      {lastMessage && (
        <Card className="dash-card border-l-[3px] border-l-sky-400">
          <CardContent className="flex items-center gap-3 py-3">
            <Wifi className="size-4 shrink-0 text-sky-500" />
            <div>
              <p className="text-sm font-medium text-stone-900">{lastMessage.type}</p>
              <p className="text-xs text-stone-400">
                {lastMessage.timestamp ? formatDateLabel(lastMessage.timestamp) : "Live event just arrived"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

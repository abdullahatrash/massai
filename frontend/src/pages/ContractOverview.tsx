import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";

import { listActiveAlerts } from "../api/alerts";
import { type ContractOverview as ContractOverviewData, getPilotPresentation } from "../api/contracts";
import { listMilestones, type MilestoneSummary } from "../api/milestones";
import { listTimeline, type TimelineEvent } from "../api/timeline";
import { ActivityFeed } from "../components/ActivityFeed";
import { MetricCard } from "../components/MetricCard";
import { MilestoneProgressBar } from "../components/MilestoneProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import { useWebSocket } from "../hooks/useWebSocket";
import type { ContractOutletContext } from "./ContractRouteLayout";

type MetricDefinition = {
  detail?: string;
  label: string;
  tone?: "accent" | "danger" | "default";
  value: string;
};

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "Not scheduled";
  }

  const parsedDate = parseISO(value);
  if (!isValid(parsedDate)) {
    return value;
  }

  return format(parsedDate, "d MMM yyyy");
}

function formatPercent(value: unknown): string {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return `${Math.round(value * 100)}%`;
}

function formatWholePercent(value: unknown): string {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return `${Math.round(value)}%`;
}

function formatCount(value: unknown): string {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatSentenceCase(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "Unavailable";
  }

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getDeliveryCountdown(deliveryDate: string | null): {
  label: string;
  tone: "danger" | "default";
} {
  if (!deliveryDate) {
    return {
      label: "Delivery date pending",
      tone: "default",
    };
  }

  const parsedDate = parseISO(deliveryDate);
  const remainingDays = differenceInCalendarDays(parsedDate, new Date());
  if (remainingDays > 0) {
    return {
      label: `${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining`,
      tone: "default",
    };
  }
  if (remainingDays === 0) {
    return {
      label: "Due today",
      tone: "default",
    };
  }

  const overdueDays = Math.abs(remainingDays);
  return {
    label: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
    tone: "danger",
  };
}

function getCurrentStageLabel(contract: ContractOverviewData): string {
  const state = contract.lastKnownState;
  const pilotType = (contract.pilotType ?? "").toUpperCase();

  if (pilotType === "FACTOR") {
    return formatSentenceCase(state.currentStage);
  }
  if (pilotType === "TASOWHEEL") {
    const stepName = typeof state.stepName === "string" ? state.stepName : null;
    if (stepName) {
      return stepName;
    }
    return typeof state.routingStep === "number" ? `Routing step ${state.routingStep}` : "Awaiting routing data";
  }
  if (pilotType === "E4M") {
    return typeof state.currentPhase === "string" ? state.currentPhase : "Phase unavailable";
  }

  return "Status unavailable";
}

function buildMetrics(contract: ContractOverviewData): MetricDefinition[] {
  const state = contract.lastKnownState;
  const pilotType = (contract.pilotType ?? "").toUpperCase();

  if (pilotType === "FACTOR") {
    return [
      {
        detail:
          typeof state.quantityPlanned === "number"
            ? `of ${formatCount(state.quantityPlanned)} planned`
            : "Latest production update",
        label: "Qty produced",
        value: formatCount(state.quantityProduced),
      },
      {
        detail: "Latest quality check",
        label: "Quality pass",
        tone:
          typeof state.qualityPassRate === "number" && state.qualityPassRate < 0.9
            ? "danger"
            : "accent",
        value: formatPercent(state.qualityPassRate),
      },
    ];
  }

  if (pilotType === "TASOWHEEL") {
    return [
      {
        detail: typeof state.stepName === "string" ? state.stepName : "Current routing waypoint",
        label: "Routing step",
        value:
          typeof state.routingStep === "number"
            ? `Step ${state.routingStep}`
            : "Unavailable",
      },
      {
        detail:
          typeof state.cycleTimeActualSec === "number"
            ? `${state.cycleTimeActualSec}s actual cycle`
            : "Latest routing status",
        label: "Step status",
        tone: state.stepStatus === "COMPLETE" ? "accent" : "default",
        value: formatSentenceCase(state.stepStatus),
      },
    ];
  }

  if (pilotType === "E4M") {
    return [
      {
        detail: "Current programme milestone",
        label: "Current phase",
        tone: "accent",
        value: typeof state.currentPhase === "string" ? state.currentPhase : "Unavailable",
      },
      {
        detail: "Completion across current phase",
        label: "Completion",
        value: formatWholePercent(state.completionPct),
      },
    ];
  }

  return Object.entries(state)
    .slice(0, 2)
    .map(([key, value]) => ({
      detail: "Latest contract state",
      label: key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
}

function getNextPendingMilestone(milestones: MilestoneSummary[]): MilestoneSummary | null {
  const candidateMilestones = milestones.filter(
    (milestone) =>
      milestone.plannedDate !== null &&
      !["COMPLETED", "REJECTED"].includes((milestone.status ?? "").toUpperCase()),
  );

  if (candidateMilestones.length === 0) {
    return null;
  }

  return [...candidateMilestones].sort((left, right) => {
    const leftDate = left.plannedDate ? Date.parse(left.plannedDate) : Number.POSITIVE_INFINITY;
    const rightDate = right.plannedDate ? Date.parse(right.plannedDate) : Number.POSITIVE_INFINITY;
    return leftDate - rightDate;
  })[0];
}

function getRecentEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 5);
}

function ConnectionPill({ status }: { status: "connected" | "connecting" | "disconnected" | "error" }) {
  return <span className={`connection-pill ${status}`}>Live {status}</span>;
}

export function ContractOverview() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const queryClient = useQueryClient();
  const pilot = getPilotPresentation(contract.pilotType);
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
      if (message.type === "CONTRACT_NOT_FOUND") {
        return;
      }

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
    <section className="page-stack">
      <div className="content-card overview-header-card">
        <div className="overview-header-main">
          <div>
            <span className={`contract-list-pilot ${pilot.className}`}>{pilot.label}</span>
            <h3>{contract.productName ?? contract.id}</h3>
            <p>
              Delivery target {formatDateLabel(contract.deliveryDate)}. Current stage:{" "}
              {getCurrentStageLabel(contract)}.
            </p>
          </div>

          <div className="overview-header-statuses">
            <StatusBadge status={contract.statusBadge} />
            <ConnectionPill status={status} />
            <span className={`delivery-countdown ${deliveryCountdown.tone}`}>
              {deliveryCountdown.label}
            </span>
          </div>
        </div>

        <div className="overview-progress-grid">
          <div className="overview-progress-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Progress</span>
                <h3>Milestone completion</h3>
              </div>
            </div>
            <MilestoneProgressBar
              completed={contract.milestonesCompleted}
              total={contract.milestonesTotal}
            />
            <p className="overview-supporting-copy">
              Current tracked stage: <strong>{getCurrentStageLabel(contract)}</strong>
            </p>
          </div>

          <div className="overview-progress-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Next step</span>
                <h3>Upcoming milestone</h3>
              </div>
            </div>

            {milestonesQuery.isPending ? <p>Checking the next milestone in the delivery plan.</p> : null}
            {!milestonesQuery.isPending && nextMilestone ? (
              <div className="next-milestone-card">
                <strong>{nextMilestone.name}</strong>
                <p>Planned for {formatDateLabel(nextMilestone.plannedDate)}</p>
                <div className="next-milestone-flags">
                  <span className="next-milestone-flag">
                    {nextMilestone.approvalRequired ? "Approval required" : "No approval required"}
                  </span>
                  {nextMilestone.isOverdue ? (
                    <span className="next-milestone-flag danger">Overdue</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!milestonesQuery.isPending && !nextMilestone ? (
              <p>No upcoming milestone is currently scheduled.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </div>

      <div className="overview-actions-grid">
        <Link className="overview-action-card" to="milestones">
          <span className="eyebrow">Action</span>
          <strong>View Milestones</strong>
          <p>Inspect the full delivery sequence and milestone approvals.</p>
        </Link>
        <Link className="overview-action-card" to="alerts">
          <div className="overview-action-row">
            <span className="eyebrow">Action</span>
            {activeAlertCount > 0 ? <span className="action-count-badge">{activeAlertCount}</span> : null}
          </div>
          <strong>View Alerts</strong>
          <p>Check active risks and acknowledgement state for this contract.</p>
        </Link>
        <Link className="overview-action-card" to="documents">
          <span className="eyebrow">Action</span>
          <strong>View Documents</strong>
          <p>Open the evidence and document trail tied to milestones.</p>
        </Link>
      </div>

      <ActivityFeed events={recentEvents} isLoading={timelineQuery.isPending} />

      {lastMessage ? (
        <div className="content-card live-update-card">
          <span className="eyebrow">Latest live event</span>
          <h3>{lastMessage.type}</h3>
          <p>
            {lastMessage.timestamp ? formatDateLabel(lastMessage.timestamp) : "A live contract event arrived just now."}
          </p>
        </div>
      ) : null}
    </section>
  );
}

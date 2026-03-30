import type { ContractAnalytics } from "../../api/analytics";
import type { MilestoneSummary } from "../../api/milestones";
import { Gauge } from "../Gauge";
import { Sparkline } from "../Sparkline";

type TasowheelMetricsProps = {
  analytics: ContractAnalytics | undefined;
  efficiencyHistory: number[];
  milestones: MilestoneSummary[];
  state: Record<string, unknown>;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null) {
    return "Unavailable";
  }

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function milestoneStepNumber(milestone: MilestoneSummary): number | null {
  const match = milestone.milestoneRef.match(/STEP_(\d+)/);
  return match ? Number(match[1]) : null;
}

export function TasowheelMetrics({
  analytics,
  efficiencyHistory,
  milestones,
  state,
}: TasowheelMetricsProps) {
  const routingStep = asNumber(state.routingStep);
  const stepName = asString(state.stepName);
  const stepStatus = asString(state.stepStatus);
  const currentEfficiency = efficiencyHistory.at(-1) ?? null;

  const completedCount = milestones.filter((m) => {
    const stepNumber = milestoneStepNumber(m);
    return (
      (m.status ?? "").toUpperCase() === "COMPLETED" ||
      (stepNumber !== null &&
        routingStep !== null &&
        (routingStep > stepNumber ||
          (routingStep === stepNumber && stepStatus === "COMPLETE")))
    );
  }).length;

  return (
    <div className="pilot-metrics-stack" role="region" aria-label="Tasowheel pilot metrics">
      <div className="feed-stat-grid" role="list" aria-label="Key metrics">
        <article className="feed-stat-card" role="listitem">
          <span id="tw-step-label">Current routing step</span>
          <strong aria-labelledby="tw-step-label">
            {routingStep !== null ? `Step ${routingStep}` : "Unavailable"}
          </strong>
          <p>{stepName ?? "Latest routing stage unavailable"}</p>
        </article>

        <article className="feed-stat-card" role="listitem">
          <span id="tw-energy-label">Total energy</span>
          <strong aria-labelledby="tw-energy-label">
            {formatNumber(analytics?.totalEnergyKwh ?? null, " kWh")}
          </strong>
          <p>Running total from production updates.</p>
        </article>

        <article className="feed-stat-card" role="listitem">
          <span id="tw-carbon-label">Total carbon</span>
          <strong aria-labelledby="tw-carbon-label">
            {formatNumber(analytics?.totalCarbonKgCo2e ?? null, " kgCO₂e")}
          </strong>
          <p>Accumulated carbon output for this routing run.</p>
        </article>

        <Gauge
          detail={`Current status: ${stepStatus ?? "Unavailable"}`}
          label="Efficiency"
          tone={(currentEfficiency ?? 0) >= 85 ? "green" : (currentEfficiency ?? 0) >= 70 ? "amber" : "red"}
          value={currentEfficiency}
        />
      </div>

      <section
        className="content-card feed-checklist-card"
        aria-labelledby="tw-checklist-heading"
      >
        <div className="section-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Routing checklist</span>
            <h3 id="tw-checklist-heading">
              Step completion
              <span className="sr-only"> — {completedCount} of {milestones.length} steps complete</span>
            </h3>
          </div>
        </div>

        <div className="feed-checklist" role="list" aria-label="Routing steps">
          {milestones.map((milestone) => {
            const stepNumber = milestoneStepNumber(milestone);
            const isComplete =
              (milestone.status ?? "").toUpperCase() === "COMPLETED" ||
              (stepNumber !== null &&
                routingStep !== null &&
                (routingStep > stepNumber ||
                  (routingStep === stepNumber && stepStatus === "COMPLETE")));

            return (
              <div
                className={`feed-checklist-item${isComplete ? " complete" : ""}`}
                key={milestone.id}
                role="listitem"
                aria-label={`${milestone.name}: ${isComplete ? "completed" : "pending"}`}
              >
                <span aria-hidden="true">{isComplete ? "✓" : "○"}</span>
                <div>
                  <strong>{milestone.name}</strong>
                  <p>{milestone.milestoneRef}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Sparkline label="Efficiency history" points={efficiencyHistory} />
    </div>
  );
}

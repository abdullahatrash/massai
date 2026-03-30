import { Gauge } from "../Gauge";
import { Sparkline } from "../Sparkline";
import {
  formatQualityPercent,
  getQualityStatus,
  qualityRatioToPercent,
} from "@/lib/quality";

type FactorMetricsProps = {
  qualityHistory: number[];
  qualityTarget?: number | null;
  state: Record<string, unknown>;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }

  return `${Math.round(value * 100)}%`;
}

function formatCount(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function stageLabel(value: string | null): string {
  if (!value) {
    return "Stage unavailable";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function FactorMetrics({ qualityHistory, qualityTarget, state }: FactorMetricsProps) {
  const quantityProduced = asNumber(state.quantityProduced);
  const quantityPlanned = asNumber(state.quantityPlanned);
  const qualityPassRate = asNumber(state.qualityPassRate);
  const machineUtilization = asNumber(state.machineUtilization);
  const currentStage = asString(state.currentStage);
  const qualityValue = qualityRatioToPercent(qualityPassRate);
  const progressPercent =
    quantityProduced !== null && quantityPlanned
      ? (quantityProduced / quantityPlanned) * 100
      : null;

  return (
    <div className="pilot-metrics-stack" role="region" aria-label="Factor pilot metrics">
      <div className="feed-stat-grid" role="list" aria-label="Key metrics">
        <article className="feed-stat-card" role="listitem">
          <span id="factor-production-label">Production progress</span>
          <strong aria-labelledby="factor-production-label">
            {formatCount(quantityProduced)} / {formatCount(quantityPlanned)}
          </strong>
          <div
            className="feed-inline-progress"
            role="progressbar"
            aria-valuenow={progressPercent !== null ? Math.round(progressPercent) : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Production progress: ${progressPercent === null ? "unavailable" : `${Math.round(progressPercent)}%`}`}
          >
            <div className="feed-inline-progress-track">
              <div
                className="feed-inline-progress-fill"
                style={{ width: `${Math.max(0, Math.min(progressPercent ?? 0, 100))}%` }}
              />
            </div>
            <em>{progressPercent === null ? "Unavailable" : `${Math.round(progressPercent)}%`}</em>
          </div>
        </article>

        <Gauge
          detail={
            qualityTarget !== null && qualityTarget !== undefined
              ? `Contract target ${formatQualityPercent(qualityTarget)}. Amber within 2 pts, red beyond that.`
              : "Waiting for a contract quality target."
          }
          label="Quality pass rate"
          tone={getQualityStatus(qualityPassRate, qualityTarget)}
          value={qualityValue}
        />

        <article className="feed-stat-card" role="listitem">
          <span id="factor-stage-label">Current stage</span>
          <strong aria-labelledby="factor-stage-label">{stageLabel(currentStage)}</strong>
          <p className="feed-chip-row">
            <span className="feed-stage-chip" aria-label={`Current production stage: ${stageLabel(currentStage)}`}>
              {stageLabel(currentStage)}
            </span>
          </p>
        </article>

        <article className="feed-stat-card" role="listitem">
          <span id="factor-util-label">Machine utilisation</span>
          <strong aria-labelledby="factor-util-label">{formatPercent(machineUtilization)}</strong>
          <p>Live utilisation from the latest provider update.</p>
        </article>
      </div>

      <Sparkline label="Quality history" points={qualityHistory} />
    </div>
  );
}

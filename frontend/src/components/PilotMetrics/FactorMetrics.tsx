import { Gauge } from "../Gauge";
import { Sparkline } from "../Sparkline";

type FactorMetricsProps = {
  qualityHistory: number[];
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

function qualityTone(qualityPercent: number | null): "amber" | "green" | "neutral" | "red" {
  if (qualityPercent === null) {
    return "neutral";
  }
  if (qualityPercent >= 98.5) {
    return "green";
  }
  if (qualityPercent >= 95) {
    return "amber";
  }
  return "red";
}

export function FactorMetrics({ qualityHistory, state }: FactorMetricsProps) {
  const quantityProduced = asNumber(state.quantityProduced);
  const quantityPlanned = asNumber(state.quantityPlanned);
  const qualityPassRate = asNumber(state.qualityPassRate);
  const machineUtilization = asNumber(state.machineUtilization);
  const currentStage = asString(state.currentStage);
  const progressPercent =
    quantityProduced !== null && quantityPlanned
      ? (quantityProduced / quantityPlanned) * 100
      : null;

  return (
    <div className="pilot-metrics-stack">
      <div className="feed-stat-grid">
        <article className="feed-stat-card">
          <span>Production progress</span>
          <strong>
            {formatCount(quantityProduced)} / {formatCount(quantityPlanned)}
          </strong>
          <div className="feed-inline-progress">
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
          detail="Green at target, amber below target, red on failure risk."
          label="Quality pass rate"
          tone={qualityTone(qualityPassRate !== null ? qualityPassRate * 100 : null)}
          value={qualityPassRate !== null ? qualityPassRate * 100 : null}
        />

        <article className="feed-stat-card">
          <span>Current stage</span>
          <strong>{stageLabel(currentStage)}</strong>
          <p className="feed-chip-row">
            <span className="feed-stage-chip">{stageLabel(currentStage)}</span>
          </p>
        </article>

        <article className="feed-stat-card">
          <span>Machine utilisation</span>
          <strong>{formatPercent(machineUtilization)}</strong>
          <p>Live utilisation from the latest provider update.</p>
        </article>
      </div>

      <Sparkline label="Quality history" points={qualityHistory} />
    </div>
  );
}

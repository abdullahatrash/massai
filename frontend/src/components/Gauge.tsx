import clsx from "clsx";

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

type GaugeProps = {
  detail?: string;
  label: string;
  tone?: "amber" | "green" | "neutral" | "red";
  value: number | null;
};

function clampPercent(value: number | null): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${PERCENT_FORMATTER.format(value)}%`;
}

const TONE_LABELS: Record<string, string> = {
  green: "On target",
  amber: "Below target",
  red: "Critical",
  neutral: "No data",
};

export function Gauge({ detail, label, tone = "neutral", value }: GaugeProps) {
  const fill = clampPercent(value);

  return (
    <article
      className={clsx("gauge-card", `gauge-card-${tone}`)}
      role="meter"
      aria-valuenow={value ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${formatPercent(value)}`}
    >
      <div className="gauge-ring" style={{ ["--gauge-fill" as string]: `${fill}%` }} aria-hidden="true">
        <div className="gauge-core">
          <strong>{formatPercent(value)}</strong>
        </div>
      </div>
      <div className="gauge-copy">
        <span>{label}</span>
        {detail ? <p>{detail}</p> : null}
        <span className="sr-only">Status: {TONE_LABELS[tone] ?? tone}</span>
      </div>
    </article>
  );
}

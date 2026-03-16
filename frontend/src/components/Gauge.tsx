import clsx from "clsx";

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

  return `${Math.round(value)}%`;
}

export function Gauge({ detail, label, tone = "neutral", value }: GaugeProps) {
  const fill = clampPercent(value);

  return (
    <article className={clsx("gauge-card", `gauge-card-${tone}`)}>
      <div className="gauge-ring" style={{ ["--gauge-fill" as string]: `${fill}%` }}>
        <div className="gauge-core">
          <strong>{formatPercent(value)}</strong>
        </div>
      </div>
      <div className="gauge-copy">
        <span>{label}</span>
        {detail ? <p>{detail}</p> : null}
      </div>
    </article>
  );
}

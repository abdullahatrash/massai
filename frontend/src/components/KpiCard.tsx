import clsx from "clsx";

type KpiCardProps = {
  label: string;
  status: "amber" | "green" | "neutral" | "red";
  value: string;
};

const STATUS_LABELS: Record<string, string> = {
  green: "On target",
  amber: "Below target",
  red: "Critical",
  neutral: "No data",
};

export function KpiCard({ label, status, value }: KpiCardProps) {
  return (
    <article
      className={clsx("kpi-card", `kpi-card-${status}`)}
      aria-label={`${label}: ${value}`}
    >
      <span id={`kpi-${label.replace(/\s+/g, "-").toLowerCase()}`}>{label}</span>
      <strong aria-labelledby={`kpi-${label.replace(/\s+/g, "-").toLowerCase()}`}>{value}</strong>
      <div className={clsx("kpi-indicator", `kpi-indicator-${status}`)} aria-hidden="true" />
      <span className="sr-only">Status: {STATUS_LABELS[status] ?? status}</span>
    </article>
  );
}

import clsx from "clsx";

type MetricCardProps = {
  detail?: string;
  label: string;
  tone?: "accent" | "danger" | "default";
  value: string;
};

export function MetricCard({
  detail,
  label,
  tone = "default",
  value,
}: MetricCardProps) {
  return (
    <article className={clsx("metric-card", `metric-card-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}

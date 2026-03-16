import clsx from "clsx";

type KpiCardProps = {
  label: string;
  status: "amber" | "green" | "neutral" | "red";
  value: string;
};

export function KpiCard({ label, status, value }: KpiCardProps) {
  return (
    <article className={clsx("kpi-card", `kpi-card-${status}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

import clsx from "clsx";

import type { ContractStatusBadge } from "../api/contracts";

type StatusBadgeProps = {
  status: ContractStatusBadge | string;
};

const statusLabels: Record<ContractStatusBadge, string> = {
  ACTION_REQUIRED: "Action required",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
  DISPUTED: "Disputed",
  ON_TRACK: "On track",
};

const KNOWN_STATUSES: ContractStatusBadge[] = [
  "ACTION_REQUIRED",
  "COMPLETED",
  "DELAYED",
  "DISPUTED",
  "ON_TRACK",
];

function getStatusLabel(status: string): string {
  return statusLabels[status as ContractStatusBadge] ?? status.replace(/_/g, " ");
}

function getStatusCssClass(status: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  return KNOWN_STATUSES.includes(status as ContractStatusBadge)
    ? `status-badge-${normalized}`
    : "status-badge-unknown";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = getStatusLabel(status);
  const cssClass = getStatusCssClass(status);

  return (
    <span className={clsx("status-badge", cssClass)} title={label}>
      {label}
    </span>
  );
}

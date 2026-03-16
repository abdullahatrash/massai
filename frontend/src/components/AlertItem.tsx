import { format, formatDistanceToNowStrict } from "date-fns";

import type { ContractAlert } from "../api/alerts";

type AlertItemProps = {
  alert: ContractAlert;
  isAcknowledging?: boolean;
  onAcknowledge?: () => void;
  showAcknowledge?: boolean;
};

function formatAbsoluteTimestamp(value: string | null): string {
  if (!value) {
    return "Timestamp unavailable";
  }

  return format(new Date(value), "d MMM yyyy, HH:mm");
}

function formatRelativeTimestamp(value: string): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

function severityTone(severity: string): "critical" | "high" | "low" | "medium" | "pending" {
  const normalized = severity.toUpperCase();
  if (normalized === "CRITICAL") {
    return "critical";
  }
  if (normalized === "HIGH") {
    return "high";
  }
  if (normalized === "MEDIUM") {
    return "medium";
  }
  if (normalized === "LOW") {
    return "low";
  }
  return "pending";
}

export function AlertItem({
  alert,
  isAcknowledging = false,
  onAcknowledge,
  showAcknowledge = false,
}: AlertItemProps) {
  const tone = severityTone(alert.severity);
  const isAcknowledged = Boolean(alert.acknowledgedAt);

  return (
    <article className={`alert-item alert-item-${tone}`}>
      <div className="alert-item-header">
        <div className="alert-item-headline">
          <span className={`alert-severity-badge ${tone}`}>
            {tone === "critical" ? <span className="alert-pulse-dot" /> : null}
            {alert.severity}
          </span>
          <p>{alert.description}</p>
        </div>

        <div className="alert-item-meta">
          <strong>{formatRelativeTimestamp(alert.triggeredAt)}</strong>
          <span>{formatAbsoluteTimestamp(alert.triggeredAt)}</span>
        </div>
      </div>

      <div className="alert-item-footer">
        <div className="alert-item-flags">
          {isAcknowledged ? (
            <span className="alert-flag acknowledged">
              ✓ Acknowledged {formatAbsoluteTimestamp(alert.acknowledgedAt)}
            </span>
          ) : null}
          {alert.blockchainVerified ? (
            <span className="alert-flag verified">Verified record</span>
          ) : null}
        </div>

        {showAcknowledge && onAcknowledge ? (
          <button
            className="ghost-button"
            disabled={isAcknowledging}
            onClick={onAcknowledge}
            type="button"
          >
            {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

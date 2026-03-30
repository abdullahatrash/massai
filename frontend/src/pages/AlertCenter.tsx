import { startTransition, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import {
  acknowledgeAlert,
  listActiveAlerts,
  listAlertHistory,
  type AlertSeverity,
  type ContractAlert,
} from "../api/alerts";
import { AlertItem } from "../components/AlertItem";
import { useWebSocket } from "../hooks/useWebSocket";
import type { ContractOutletContext } from "./ContractRouteLayout";

type HistoryFilters = {
  from: string;
  severity: "" | AlertSeverity;
  to: string;
};

const severityOptions: Array<HistoryFilters["severity"]> = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW", "PENDING"];

function removeAlert(activeAlerts: ContractAlert[] | undefined, alertId: string): ContractAlert[] {
  return (activeAlerts ?? []).filter((alert) => alert.id !== alertId);
}

function prependHistoryAlert(
  historyAlerts: ContractAlert[] | undefined,
  alert: ContractAlert,
): ContractAlert[] {
  const currentAlerts = historyAlerts ?? [];
  const existingIds = new Set(currentAlerts.map((entry) => entry.id));
  if (existingIds.has(alert.id)) {
    return currentAlerts.map((entry) => (entry.id === alert.id ? alert : entry));
  }
  return [alert, ...currentAlerts];
}

export function AlertCenter() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<HistoryFilters>({
    from: "",
    severity: "",
    to: "",
  });

  const activeAlertsQuery = useQuery({
    queryFn: () => listActiveAlerts(contract.id),
    queryKey: ["contract-alerts", contract.id],
  });

  const historyAlertsQuery = useQuery({
    queryFn: () =>
      listAlertHistory(contract.id, {
        from: filters.from || undefined,
        severity: filters.severity || undefined,
        to: filters.to || undefined,
      }),
    queryKey: ["contract-alert-history", contract.id, filters],
  });

  const invalidateAlertViews = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contract-alerts", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contract-alert-history", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contract-overview", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contracts"] }),
    ]);

  useWebSocket({
    contractId: contract.id,
    onMessage: (message) => {
      if (message.type === "ALERT_TRIGGERED") {
        void invalidateAlertViews();
      }
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert(contract.id, alertId),
    onMutate: async (alertId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["contract-alerts", contract.id] }),
        queryClient.cancelQueries({ queryKey: ["contract-alert-history", contract.id] }),
      ]);

      const previousActiveAlerts = queryClient.getQueryData<ContractAlert[]>([
        "contract-alerts",
        contract.id,
      ]);
      const previousHistoryAlerts = queryClient.getQueryData<ContractAlert[]>([
        "contract-alert-history",
        contract.id,
        filters,
      ]);
      const alert = previousActiveAlerts?.find((entry) => entry.id === alertId);
      if (!alert) {
        return { previousActiveAlerts, previousHistoryAlerts };
      }

      const optimisticAlert: ContractAlert = {
        ...alert,
        acknowledgedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<ContractAlert[]>(
        ["contract-alerts", contract.id],
        (current) => removeAlert(current, alertId),
      );
      queryClient.setQueryData<ContractAlert[]>(
        ["contract-alert-history", contract.id, filters],
        (current) => prependHistoryAlert(current, optimisticAlert),
      );

      return { previousActiveAlerts, previousHistoryAlerts };
    },
    onError: (_error, _alertId, context) => {
      if (context?.previousActiveAlerts) {
        queryClient.setQueryData(
          ["contract-alerts", contract.id],
          context.previousActiveAlerts,
        );
      }
      if (context?.previousHistoryAlerts) {
        queryClient.setQueryData(
          ["contract-alert-history", contract.id, filters],
          context.previousHistoryAlerts,
        );
      }
    },
    onSettled: () => {
      void invalidateAlertViews();
    },
  });

  const activeCount = activeAlertsQuery.data?.length ?? 0;

  return (
    <section className="page-stack" aria-label="Alert center">
      <div className="content-card alert-center-card" role="region" aria-labelledby="active-alerts-heading">
        <div className="section-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Alerts</span>
            <h3 id="active-alerts-heading">
              Active alerts
              <span className="sr-only"> — </span>
              <span aria-live="polite" aria-atomic="true"> ({activeCount})</span>
            </h3>
          </div>
        </div>

        <p className="overview-supporting-copy">
          Review active issues, acknowledge alerts that have been seen, and inspect the full alert
          history for this contract.
        </p>

        {activeAlertsQuery.isPending ? (
          <p role="status" aria-live="polite">Loading active alerts.</p>
        ) : null}

        {activeAlertsQuery.isError ? (
          <div className="content-card error-card" role="alert">
            <h3>Unable to load active alerts</h3>
            <p>{activeAlertsQuery.error.message}</p>
          </div>
        ) : null}

        {activeAlertsQuery.isSuccess && activeAlertsQuery.data.length === 0 ? (
          <div className="alert-empty-state" role="status">
            <strong>No active alerts</strong>
            <p>Production is on track.</p>
          </div>
        ) : null}

        {activeAlertsQuery.isSuccess && activeAlertsQuery.data.length > 0 ? (
          <div className="alert-list" role="list" aria-label={`${activeCount} active alerts`}>
            {activeAlertsQuery.data.map((alert) => (
              <AlertItem
                alert={alert}
                isAcknowledging={
                  acknowledgeMutation.isPending && acknowledgeMutation.variables === alert.id
                }
                key={alert.id}
                onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                showAcknowledge
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="content-card alert-history-card" role="region" aria-labelledby="alert-history-heading">
        <div className="section-header">
          <div>
            <span className="eyebrow" aria-hidden="true">History</span>
            <h3 id="alert-history-heading">Alert history</h3>
          </div>
        </div>

        <fieldset className="alert-filter-grid" aria-label="Filter alert history">
          <label className="alert-filter-field">
            <span id="filter-severity-label">Severity</span>
            <select
              aria-labelledby="filter-severity-label"
              onChange={(event) => {
                const nextSeverity = event.target.value as HistoryFilters["severity"];
                startTransition(() => {
                  setFilters((current) => ({ ...current, severity: nextSeverity }));
                });
              }}
              value={filters.severity}
            >
              {severityOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All severities"}
                </option>
              ))}
            </select>
          </label>

          <label className="alert-filter-field">
            <span id="filter-from-label">From</span>
            <input
              aria-labelledby="filter-from-label"
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setFilters((current) => ({ ...current, from: nextValue }));
                });
              }}
              type="date"
              value={filters.from}
            />
          </label>

          <label className="alert-filter-field">
            <span id="filter-to-label">To</span>
            <input
              aria-labelledby="filter-to-label"
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setFilters((current) => ({ ...current, to: nextValue }));
                });
              }}
              type="date"
              value={filters.to}
            />
          </label>
        </fieldset>

        {historyAlertsQuery.isPending ? (
          <p role="status" aria-live="polite">Loading alert history.</p>
        ) : null}

        {historyAlertsQuery.isError ? (
          <div className="content-card error-card" role="alert">
            <h3>Unable to load alert history</h3>
            <p>{historyAlertsQuery.error.message}</p>
          </div>
        ) : null}

        {historyAlertsQuery.isSuccess && historyAlertsQuery.data.length === 0 ? (
          <p role="status">No historical alerts match the current filters.</p>
        ) : null}

        {historyAlertsQuery.isSuccess && historyAlertsQuery.data.length > 0 ? (
          <div className="alert-list" role="list" aria-label="Alert history results">
            {historyAlertsQuery.data.map((alert) => (
              <AlertItem alert={alert} key={alert.id} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

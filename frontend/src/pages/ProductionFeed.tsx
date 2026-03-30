import {
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, formatISO } from "date-fns";
import { useOutletContext } from "react-router-dom";

import { getContractAnalytics } from "../api/analytics";
import { listMilestones, type MilestoneSummary } from "../api/milestones";
import { type ContractWebSocketMessage, useWebSocket } from "../hooks/useWebSocket";
import type { ContractOutletContext } from "./ContractRouteLayout";
import { E4mMetrics } from "../components/PilotMetrics/E4mMetrics";
import { FactorMetrics } from "../components/PilotMetrics/FactorMetrics";
import { TasowheelMetrics } from "../components/PilotMetrics/TasowheelMetrics";

const DEFAULT_UPDATE_INTERVAL_MS = 15_000;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function averageInterval(timestamps: number[]): number {
  if (timestamps.length < 2) {
    return DEFAULT_UPDATE_INTERVAL_MS;
  }

  const deltas: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    const delta = timestamps[index] - timestamps[index - 1];
    if (delta > 0) {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) {
    return DEFAULT_UPDATE_INTERVAL_MS;
  }

  return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
}

function clampHistory(values: number[], nextValue: number): number[] {
  return [...values.slice(-19), nextValue];
}

function buildInitialHistory(
  pilotType: string | null,
  state: Record<string, unknown>,
  analytics?: Awaited<ReturnType<typeof getContractAnalytics>>,
): { efficiency: number[]; quality: number[] } {
  const quality = asNumber(state.qualityPassRate);
  const resourceUtilisation = analytics?.resourceUtilisationPct ?? null;

  return {
    efficiency: resourceUtilisation !== null ? [resourceUtilisation] : [],
    quality: quality !== null ? [quality * 100] : [],
  };
}

function efficiencyFromState(
  pilotType: string | null,
  state: Record<string, unknown>,
  baselineCycleTime: number | null,
  analytics?: Awaited<ReturnType<typeof getContractAnalytics>>,
): number | null {
  if ((pilotType ?? "").toUpperCase() !== "TASOWHEEL") {
    return null;
  }

  const cycleTime = asNumber(state.cycleTimeActualSec);
  if (cycleTime !== null && baselineCycleTime && baselineCycleTime > 0) {
    return Math.max(0, Math.min(100, (baselineCycleTime / cycleTime) * 100));
  }

  return analytics?.resourceUtilisationPct ?? null;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Awaiting live provider updates";
  }

  return formatISO(new Date(value));
}

function formatDelayMessage(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) {
    return "Provider data delayed.";
  }

  return `Provider data delayed — last update was ${formatDistanceToNowStrict(new Date(lastUpdatedAt))} ago.`;
}

function updateStateFromSocket(
  previousState: Record<string, unknown>,
  message: ContractWebSocketMessage,
): Record<string, unknown> {
  if (message.type !== "CONTRACT_STATE_CHANGED") {
    return previousState;
  }

  const data = asObject(message.data);
  const state = asObject(data?.state);
  if (!state) {
    return previousState;
  }

  return {
    ...previousState,
    ...state,
  };
}

const CONNECTION_LABELS: Record<string, string> = {
  connected: "Live data stream connected",
  connecting: "Connecting to live data stream",
  disconnected: "Live data stream disconnected",
  error: "Live data stream error",
};

export function ProductionFeed() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const queryClient = useQueryClient();
  const [currentState, setCurrentState] = useState<Record<string, unknown>>(contract.lastKnownState);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [recentUpdateTimestamps, setRecentUpdateTimestamps] = useState<number[]>([]);
  const [tick, setTick] = useState(() => Date.now());

  const analyticsQuery = useQuery({
    queryFn: () => getContractAnalytics(contract.id),
    queryKey: ["contract-analytics", contract.id],
  });
  const milestonesQuery = useQuery({
    queryFn: () => listMilestones(contract.id),
    queryKey: ["contract-milestones", contract.id],
  });

  const [history, setHistory] = useState(() =>
    buildInitialHistory(contract.pilotType, contract.lastKnownState, analyticsQuery.data),
  );

  useEffect(() => {
    startTransition(() => {
      setCurrentState(contract.lastKnownState);
      setHistory(buildInitialHistory(contract.pilotType, contract.lastKnownState, analyticsQuery.data));
    });
  }, [analyticsQuery.data, contract.lastKnownState, contract.pilotType]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      startTransition(() => {
        setTick(Date.now());
      });
    }, 1000);

    return () => {
      window.clearInterval(handle);
    };
  }, []);

  const baselineCycleTime = useMemo(() => asNumber(contract.lastKnownState.cycleTimeActualSec), [contract.lastKnownState]);

  const { lastMessage, status } = useWebSocket({
    contractId: contract.id,
    onMessage: (message) => {
      const isProviderUpdate = ["UPDATE_RECEIVED", "CONTRACT_STATE_CHANGED"].includes(message.type);
      const timestamp =
        typeof message.timestamp === "string" ? Date.parse(message.timestamp) : Date.now();

      startTransition(() => {
        if (isProviderUpdate) {
          if (typeof message.timestamp === "string") {
            setLastUpdatedAt(message.timestamp);
          } else {
            setLastUpdatedAt(new Date().toISOString());
          }
          setRecentUpdateTimestamps((current) => [...current.slice(-9), timestamp]);
        }
        setCurrentState((previousState) => {
          const nextState = updateStateFromSocket(previousState, message);
          setHistory((previousHistory) => {
            const quality = asNumber(nextState.qualityPassRate);
            const efficiency = efficiencyFromState(
              contract.pilotType,
              nextState,
              baselineCycleTime,
              analyticsQuery.data,
            );

            return {
              efficiency:
                efficiency !== null
                  ? clampHistory(previousHistory.efficiency, efficiency)
                  : previousHistory.efficiency,
              quality:
                quality !== null
                  ? clampHistory(previousHistory.quality, quality * 100)
                  : previousHistory.quality,
            };
          });
          return nextState;
        });
      });

      if (["CONTRACT_STATE_CHANGED", "UPDATE_RECEIVED", "MILESTONE_CHANGED"].includes(message.type)) {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["contract-analytics", contract.id] }),
          queryClient.invalidateQueries({ queryKey: ["contract-overview", contract.id] }),
          queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        ]);
      }

      if (message.type === "MILESTONE_CHANGED") {
        void queryClient.invalidateQueries({ queryKey: ["contract-milestones", contract.id] });
      }
    },
  });

  const expectedIntervalMs = averageInterval(recentUpdateTimestamps);
  const isDelayed =
    lastUpdatedAt !== null && tick - Date.parse(lastUpdatedAt) > expectedIntervalMs * 2;
  const pilotType = (contract.pilotType ?? "").toUpperCase();

  return (
    <section className="page-stack" aria-label="Production feed">
      <div className="content-card feed-shell">
        <header className="feed-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Production feed</span>
            <h3 id="feed-heading">Live production metrics</h3>
            <p className="overview-supporting-copy">
              Real-time contract telemetry for {contract.productName ?? contract.id}.
            </p>
          </div>

          <div className="feed-header-meta" role="status" aria-live="polite" aria-atomic="true">
            <span
              className={`connection-pill ${status}`}
              aria-label={CONNECTION_LABELS[status] ?? `Live ${status}`}
            >
              Live {status}
            </span>
            <span className="feed-last-updated">
              <span className="sr-only">Last updated: </span>
              {formatTimestamp(lastUpdatedAt)}
            </span>
          </div>
        </header>

        {isDelayed ? (
          <div className="feed-warning-banner" role="alert">
            {formatDelayMessage(lastUpdatedAt)}
          </div>
        ) : null}

        {analyticsQuery.isPending || milestonesQuery.isPending ? (
          <p role="status" aria-live="polite">Preparing the live production view.</p>
        ) : null}

        {analyticsQuery.isError ? (
          <div className="content-card error-card" role="alert">
            <h3>Unable to load production analytics</h3>
            <p>{analyticsQuery.error.message}</p>
          </div>
        ) : null}

        <div aria-live="polite" aria-atomic="false" aria-relevant="additions text">
        {pilotType === "FACTOR" ? (
          <FactorMetrics
            qualityHistory={history.quality}
            qualityTarget={contract.qualityTarget}
            state={currentState}
          />
        ) : null}

          {pilotType === "TASOWHEEL" ? (
            <TasowheelMetrics
              analytics={analyticsQuery.data}
              efficiencyHistory={history.efficiency}
              milestones={milestonesQuery.data ?? []}
              state={currentState}
            />
          ) : null}

          {pilotType === "E4M" ? <E4mMetrics state={currentState} /> : null}
        </div>

        {lastMessage ? (
          <div className="feed-event-footnote" aria-live="off">
            Latest socket event: <strong>{lastMessage.type}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

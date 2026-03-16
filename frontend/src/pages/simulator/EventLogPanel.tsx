import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthProvider";

type EventLogPanelProps = {
  contractId: string;
};

type EventLogEntry = {
  id: string;
  message: string;
  raw: Record<string, unknown>;
  severity: string | null;
  severityClass: "alert" | "blockchain" | "milestone" | "success" | "system";
  timestamp: string;
  type: string;
};

type EventLogStatus = "connecting" | "connected" | "disconnected" | "error";

function buildWebsocketUrl(contractId: string, token: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
  const websocketBaseUrl = apiBaseUrl.startsWith("https")
    ? apiBaseUrl.replace("https://", "wss://")
    : apiBaseUrl.replace("http://", "ws://");
  return `${websocketBaseUrl}/ws/contracts/${contractId}?token=${encodeURIComponent(token)}`;
}

function classifyMessageType(messageType: string) {
  if (messageType.includes("ALERT")) {
    return "alert";
  }
  if (messageType.includes("MILESTONE")) {
    return "milestone";
  }
  if (messageType.includes("BLOCKCHAIN")) {
    return "blockchain";
  }
  if (messageType === "UPDATE_RECEIVED" || messageType === "CONTRACT_STATE_CHANGED") {
    return "success";
  }
  return "system";
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function summarizeMessage(message: Record<string, unknown>) {
  const type = typeof message.type === "string" ? message.type : "UNKNOWN";
  const data =
    message.data && typeof message.data === "object"
      ? (message.data as Record<string, unknown>)
      : {};

  if (type === "ALERT_TRIGGERED") {
    return `${data.severity ?? "UNKNOWN"} alert: ${data.description ?? "No description"}`;
  }
  if (type === "MILESTONE_CHANGED") {
    return `Milestone ${data.milestoneRef ?? "unknown"} is now ${data.status ?? "updated"}.`;
  }
  if (type === "CONTRACT_STATE_CHANGED") {
    return `Contract state changed via ${data.updateType ?? "update"}.`;
  }
  if (type === "UPDATE_RECEIVED") {
    return `Update received from ${data.sensorId ?? "simulator sensor"}.`;
  }
  if (type === "CONTRACT_NOT_FOUND") {
    return `Contract ${data.contractId ?? "unknown"} was not found.`;
  }

  return `${type} event received.`;
}

function createLogEntry(message: Record<string, unknown>): EventLogEntry {
  const type = typeof message.type === "string" ? message.type : "UNKNOWN";
  const timestamp =
    typeof message.timestamp === "string" ? message.timestamp : new Date().toISOString();
  const data =
    message.data && typeof message.data === "object"
      ? (message.data as Record<string, unknown>)
      : {};
  const severity =
    type === "ALERT_TRIGGERED" && typeof data.severity === "string"
      ? data.severity
      : null;

  return {
    id: `${timestamp}-${type}-${Math.random().toString(16).slice(2)}`,
    message: summarizeMessage(message),
    raw: message,
    severity,
    severityClass: classifyMessageType(type),
    timestamp,
    type,
  };
}

export function EventLogPanel({ contractId }: EventLogPanelProps) {
  const { token } = useAuth();
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const [status, setStatus] = useState<EventLogStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const appendEntry = useEffectEvent((message: Record<string, unknown>) => {
    startTransition(() => {
      setEntries((currentEntries) => [...currentEntries.slice(-99), createLogEntry(message)]);
    });
  });

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  useEffect(() => {
    if (!token) {
      setStatus("disconnected");
      return;
    }

    const socket = new WebSocket(buildWebsocketUrl(contractId, token));
    setStatus("connecting");
    setErrorMessage(null);

    socket.onopen = () => {
      startTransition(() => {
        setStatus("connected");
      });
    };

    socket.onmessage = (event) => {
      try {
        appendEntry(JSON.parse(event.data) as Record<string, unknown>);
      } catch {
        appendEntry({
          data: {
            raw: event.data,
          },
          timestamp: new Date().toISOString(),
          type: "UNPARSEABLE_EVENT",
        });
      }
    };

    socket.onerror = () => {
      startTransition(() => {
        setStatus("error");
        setErrorMessage("WebSocket error while listening for contract events.");
      });
    };

    socket.onclose = () => {
      startTransition(() => {
        setStatus("disconnected");
      });
    };

    return () => {
      socket.close();
    };
  }, [appendEntry, contractId, token]);

  return (
    <aside className="simulator-module-card event-log-panel">
      <div className="event-log-header">
        <div>
          <span className="simulator-section-kicker">Live Feed</span>
          <h3>Event log</h3>
        </div>
        <div className="event-log-actions">
          <span className={`event-log-status ${status}`}>{status}</span>
          <button
            className="ghost-button simulator-button"
            onClick={() => setEntries([])}
            type="button"
          >
            Clear log
          </button>
        </div>
      </div>

      <p className="scenario-summary">
        Listening to <code>WS /ws/contracts/{contractId}</code> for simulator-side debugging and
        demos.
      </p>

      {errorMessage ? <p className="simulator-request-error">{errorMessage}</p> : null}

      <div className="event-log-list">
        {entries.length === 0 ? (
          <div className="event-log-empty">
            <strong>No live events yet</strong>
            <p>Run a scenario or send a manual update to start streaming websocket events.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <details className={`event-log-entry ${entry.severityClass}`} key={entry.id}>
              <summary>
                <span className="event-log-entry-meta">
                  <strong>{entry.type}</strong>
                  {entry.severity ? (
                    <span className="event-log-severity-badge">{entry.severity}</span>
                  ) : null}
                  <span>{formatTimestamp(entry.timestamp)}</span>
                </span>
                <span>{entry.message}</span>
              </summary>
              <pre>{JSON.stringify(entry.raw, null, 2)}</pre>
            </details>
          ))
        )}
        <div ref={bottomAnchorRef} />
      </div>
    </aside>
  );
}

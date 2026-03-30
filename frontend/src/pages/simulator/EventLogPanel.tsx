import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { Activity, AlertTriangle, Binary, Milestone, Radio, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useAuth } from "../../auth/AuthProvider";
import {
  getContractSocketStatus,
  subscribeToContractSocket,
} from "../../lib/contractWebSocketPool";

type EventLogPanelProps = {
  state: EventLogState;
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

type EventLogState = {
  clearEntries: () => void;
  entries: EventLogEntry[];
  errorMessage: string | null;
  status: EventLogStatus;
};

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

function getStatusDotClassName(status: EventLogStatus) {
  if (status === "connected") {
    return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]";
  }
  if (status === "error" || status === "disconnected") {
    return "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]";
  }

  return "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] animate-pulse";
}

function getEntryClassName(entry: EventLogEntry) {
  if (entry.severityClass === "alert") {
    return "border-rose-400/15 bg-rose-400/[0.04]";
  }
  if (entry.severityClass === "milestone") {
    return "border-amber-400/15 bg-amber-400/[0.04]";
  }
  if (entry.severityClass === "blockchain") {
    return "border-sky-400/15 bg-sky-400/[0.04]";
  }
  if (entry.severityClass === "success") {
    return "border-emerald-400/15 bg-emerald-400/[0.04]";
  }

  return "border-white/[0.06] bg-white/[0.02]";
}

function getEntryIcon(entry: EventLogEntry) {
  if (entry.severityClass === "alert") {
    return <AlertTriangle className="size-3.5 text-rose-300" />;
  }
  if (entry.severityClass === "milestone") {
    return <Milestone className="size-3.5 text-amber-300" />;
  }
  if (entry.severityClass === "blockchain") {
    return <Binary className="size-3.5 text-sky-300" />;
  }

  return <Activity className="size-3.5 text-slate-500" />;
}

export function useEventLogStream(
  contractId: string | undefined,
  onEventCountChange?: (count: number) => void,
): EventLogState {
  const { token } = useAuth();
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const [status, setStatus] = useState<EventLogStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const connectionIdRef = useRef(0);

  const appendEntry = useEffectEvent((message: Record<string, unknown>) => {
    startTransition(() => {
      setEntries((currentEntries) => {
        const nextEntries = [...currentEntries.slice(-99), createLogEntry(message)];
        return nextEntries;
      });
    });
  });

  useEffect(() => {
    onEventCountChange?.(entries.length);
  }, [entries.length, onEventCountChange]);

  useEffect(() => {
    startTransition(() => {
      setEntries([]);
      setErrorMessage(null);
      setStatus(token && contractId ? "connecting" : "disconnected");
    });
  }, [contractId, token]);

  useEffect(() => {
    if (!token || !contractId) {
      connectionIdRef.current += 1;
      setStatus("disconnected");
      return;
    }

    const connectionId = connectionIdRef.current + 1;
    connectionIdRef.current = connectionId;
    let isCurrentConnection = true;
    const url = buildWebsocketUrl(contractId, token);
    setStatus(getContractSocketStatus(url) ?? "connecting");
    setErrorMessage(null);

    const unsubscribe = subscribeToContractSocket(url, {
      onMessage: (event) => {
        if (!isCurrentConnection || connectionId !== connectionIdRef.current) {
          return;
        }
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
      },
      onStatus: (nextStatus) => {
        if (!isCurrentConnection || connectionId !== connectionIdRef.current) {
          return;
        }
        startTransition(() => {
          setStatus(nextStatus);
          if (nextStatus === "connected") {
            setErrorMessage(null);
          }
          if (nextStatus === "error") {
            setErrorMessage("WebSocket error while listening for contract events.");
          }
        });
      },
    });

    return () => {
      isCurrentConnection = false;
      unsubscribe();
    };
  }, [appendEntry, contractId, token]);

  return {
    clearEntries: () => {
      startTransition(() => {
        setEntries([]);
      });
    },
    entries,
    errorMessage,
    status,
  };
}

export function EventLogPanel({ state }: EventLogPanelProps) {
  const { clearEntries, entries, errorMessage, status } = state;
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full", getStatusDotClassName(status))} />
          <h3 className="text-[0.82rem] font-semibold text-white">Event Log</h3>
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] tabular-nums text-slate-400">
            {entries.length}
          </span>
        </div>
        <Button
          className="text-[0.65rem] text-slate-500"
          onClick={clearEntries}
          size="sm"
          variant="ghost"
        >
          <Trash2 className="size-3" />
          Clear
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden p-3">
        {errorMessage ? (
          <div className="mb-3 rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-[0.72rem] text-rose-300">
            {errorMessage}
          </div>
        ) : null}

        <ScrollArea className="h-full pr-2">
          <div className="grid gap-2">
            {entries.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-10 text-center">
                <Radio className="mx-auto size-6 text-slate-600" />
                <p className="mt-3 text-[0.78rem] font-medium text-slate-400">No events yet</p>
                <p className="mt-1 text-[0.68rem] text-slate-600">
                  Run a scenario or send an update to stream WebSocket events here.
                </p>
              </div>
            ) : (
              entries.map((entry) => (
                <details
                  className={cn("rounded-lg border p-3", getEntryClassName(entry))}
                  key={entry.id}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{getEntryIcon(entry)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">
                          <span>{entry.type}</span>
                          {entry.severity ? (
                            <Badge className="border-rose-400/15 bg-rose-400/8 px-1.5 py-0 text-[0.55rem] text-rose-300">
                              {entry.severity}
                            </Badge>
                          ) : null}
                          <span className="ml-auto tabular-nums">{formatTimestamp(entry.timestamp)}</span>
                        </div>
                        <p className="mt-1.5 text-[0.75rem] font-medium text-slate-200">{entry.message}</p>
                      </div>
                    </div>
                  </summary>
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[0.65rem] leading-relaxed text-slate-300">
                    {JSON.stringify(entry.raw, null, 2)}
                  </pre>
                </details>
              ))
            )}
            <div ref={bottomAnchorRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

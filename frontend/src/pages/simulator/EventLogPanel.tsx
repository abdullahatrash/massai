import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { Activity, AlertTriangle, Binary, Milestone, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useAuth } from "../../auth/AuthProvider";
import {
  getContractSocketStatus,
  subscribeToContractSocket,
} from "../../lib/contractWebSocketPool";

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

function getStatusBadgeClassName(status: EventLogStatus) {
  if (status === "connected") {
    return "border-emerald-300/25 bg-emerald-300/12 text-emerald-50";
  }
  if (status === "error" || status === "disconnected") {
    return "border-rose-300/25 bg-rose-300/12 text-rose-100";
  }

  return "border-amber-300/25 bg-amber-300/12 text-amber-50";
}

function getEntryClassName(entry: EventLogEntry) {
  if (entry.severityClass === "alert") {
    return "border-rose-300/18 bg-rose-400/[0.06]";
  }
  if (entry.severityClass === "milestone") {
    return "border-amber-300/18 bg-amber-400/[0.06]";
  }
  if (entry.severityClass === "blockchain") {
    return "border-sky-300/18 bg-sky-400/[0.06]";
  }
  if (entry.severityClass === "success") {
    return "border-emerald-300/18 bg-emerald-400/[0.06]";
  }

  return "border-white/10 bg-white/[0.03]";
}

function getEntryIcon(entry: EventLogEntry) {
  if (entry.severityClass === "alert") {
    return <AlertTriangle className="text-rose-200" />;
  }
  if (entry.severityClass === "milestone") {
    return <Milestone className="text-amber-200" />;
  }
  if (entry.severityClass === "blockchain") {
    return <Binary className="text-sky-200" />;
  }

  return <Activity className="text-slate-400" />;
}

export function EventLogPanel({ contractId }: EventLogPanelProps) {
  const { token } = useAuth();
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const [status, setStatus] = useState<EventLogStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const connectionIdRef = useRef(0);

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

  return (
    <Card className="h-full border-white/10 bg-white/[0.045] text-white shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl 2xl:sticky 2xl:top-6">
      <CardHeader className="border-b border-white/8 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-white/12 bg-white/8 text-white/70">Live feed</Badge>
            <CardTitle className="mt-4 text-2xl text-white">Event log</CardTitle>
            <CardDescription className="mt-3 text-slate-300">
              Listening to <code>WS /ws/contracts/{contractId}</code> for simulator-side debugging
              and demos.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusBadgeClassName(status)}>{status}</Badge>
            <Button onClick={() => setEntries([])} type="button" variant="outline">
              <Trash2 data-icon="inline-start" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {errorMessage ? (
          <div className="mb-4 rounded-[24px] border border-rose-300/15 bg-rose-950/25 p-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <ScrollArea className="h-[52rem] pr-3">
          <div className="grid gap-3">
            {entries.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-base font-semibold text-white">No live events yet</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Run a scenario or send a manual update to start streaming websocket events.
                </p>
              </div>
            ) : (
              entries.map((entry) => (
                <details
                  className={cn("rounded-[28px] border p-4", getEntryClassName(entry))}
                  key={entry.id}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getEntryIcon(entry)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                          <span>{entry.type}</span>
                          {entry.severity ? (
                            <Badge className="border-rose-300/18 bg-rose-300/12 text-rose-100">
                              {entry.severity}
                            </Badge>
                          ) : null}
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-white">{entry.message}</p>
                      </div>
                    </div>
                  </summary>
                  <pre className="mt-4 overflow-x-auto rounded-[22px] border border-white/10 bg-black/30 p-4 text-xs text-slate-200">
                    {JSON.stringify(entry.raw, null, 2)}
                  </pre>
                </details>
              ))
            )}
            <div ref={bottomAnchorRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

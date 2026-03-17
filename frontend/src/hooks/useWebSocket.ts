import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { useAuth } from "../auth/AuthProvider";
import {
  getContractSocketStatus,
  subscribeToContractSocket,
} from "../lib/contractWebSocketPool";

export type WebSocketStatus = "connected" | "connecting" | "disconnected" | "error";

export type ContractWebSocketMessage = {
  data?: Record<string, unknown>;
  timestamp?: string;
  type: string;
};

type UseWebSocketOptions = {
  contractId: string;
  enabled?: boolean;
  onMessage?: (message: ContractWebSocketMessage) => void;
  /** Throttle message delivery to avoid overwhelming the UI (ms). Default 1200. */
  throttleMs?: number;
};

export function buildContractWebSocketUrl(contractId: string, token: string): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
  const websocketBaseUrl = apiBaseUrl.startsWith("https")
    ? apiBaseUrl.replace("https://", "wss://")
    : apiBaseUrl.replace("http://", "ws://");
  return `${websocketBaseUrl}/ws/contracts/${contractId}?token=${encodeURIComponent(token)}`;
}

export function useWebSocket({
  contractId,
  enabled = true,
  onMessage,
  throttleMs = 1200,
}: UseWebSocketOptions) {
  const { token } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<ContractWebSocketMessage | null>(null);
  const connectionIdRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessageRef = useRef<ContractWebSocketMessage | null>(null);

  const deliverMessage = useEffectEvent((message: ContractWebSocketMessage) => {
    startTransition(() => {
      setLastMessage(message);
    });
    onMessage?.(message);
  });

  const flushPending = useEffectEvent(() => {
    throttleTimerRef.current = null;
    const pending = pendingMessageRef.current;
    pendingMessageRef.current = null;
    if (pending) {
      deliverMessage(pending);
    }
  });

  useEffect(() => {
    if (!enabled || !token) {
      connectionIdRef.current += 1;
      startTransition(() => {
        setStatus("disconnected");
      });
      return;
    }

    const connectionId = connectionIdRef.current + 1;
    connectionIdRef.current = connectionId;
    let isCurrentConnection = true;
    const url = buildContractWebSocketUrl(contractId, token);
    const initialStatus = getContractSocketStatus(url) ?? "connecting";
    startTransition(() => {
      setStatus(initialStatus);
    });

    const handleRawMessage = (message: ContractWebSocketMessage) => {
      if (!isCurrentConnection || connectionId !== connectionIdRef.current) {
        return;
      }
      if (throttleMs <= 0) {
        deliverMessage(message);
        return;
      }
      pendingMessageRef.current = message;
      if (throttleTimerRef.current === null) {
        throttleTimerRef.current = setTimeout(flushPending, throttleMs);
      }
    };

    const unsubscribe = subscribeToContractSocket(url, {
      onMessage: (event) => {
        try {
          handleRawMessage(JSON.parse(event.data) as ContractWebSocketMessage);
        } catch {
          handleRawMessage({
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
        });
      },
    });

    return () => {
      isCurrentConnection = false;
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingMessageRef.current = null;
      unsubscribe();
    };
  }, [contractId, enabled, throttleMs, token]);

  return {
    lastMessage,
    status,
  };
}

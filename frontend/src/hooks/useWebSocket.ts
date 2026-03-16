import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { useAuth } from "../auth/AuthProvider";

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
}: UseWebSocketOptions) {
  const { token } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<ContractWebSocketMessage | null>(null);

  const handleMessage = useEffectEvent((message: ContractWebSocketMessage) => {
    startTransition(() => {
      setLastMessage(message);
    });
    onMessage?.(message);
  });

  useEffect(() => {
    if (!enabled || !token) {
      startTransition(() => {
        setStatus("disconnected");
      });
      return;
    }

    const socket = new WebSocket(buildContractWebSocketUrl(contractId, token));
    startTransition(() => {
      setStatus("connecting");
    });

    socket.onopen = () => {
      startTransition(() => {
        setStatus("connected");
      });
    };

    socket.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data) as ContractWebSocketMessage);
      } catch {
        handleMessage({
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
  }, [contractId, enabled, handleMessage, token]);

  return {
    lastMessage,
    status,
  };
}

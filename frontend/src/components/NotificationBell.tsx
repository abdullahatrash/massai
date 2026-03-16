import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { listContracts } from "../api/contracts";
import {
  getNotificationDestination,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type DashboardNotification,
} from "../api/notifications";
import { useAuth } from "../auth/AuthProvider";
import { buildContractWebSocketUrl, type ContractWebSocketMessage } from "../hooks/useWebSocket";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const contractsQuery = useQuery({
    queryFn: () => listContracts({ page: 1, pageSize: 100 }),
    queryKey: ["notification-contracts"],
  });
  const notificationsQuery = useQuery({
    queryFn: () => listNotifications({ page: 1, pageSize: 10 }),
    queryKey: ["notifications", { page: 1, pageSize: 10 }],
  });

  const invalidateNotifications = useEffectEvent(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notification-contracts"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["contracts"] }),
    ]);
  });

  useEffect(() => {
    if (!token || !user?.contractIds.length) {
      return;
    }

    const sockets = user.contractIds.map((contractId) => {
      const socket = new WebSocket(buildContractWebSocketUrl(contractId, token));
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ContractWebSocketMessage;
          if (message.type === "NOTIFICATION") {
            invalidateNotifications();
          }
        } catch {
          // Ignore malformed socket payloads and wait for the next valid event.
        }
      };
      return socket;
    });

    return () => {
      sockets.forEach((socket) => socket.close());
    };
  }, [invalidateNotifications, token, user?.contractIds]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        startTransition(() => {
          setIsOpen(false);
        });
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      invalidateNotifications();
    },
  });
  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      invalidateNotifications();
    },
  });

  const contractNames = Object.fromEntries(
    (contractsQuery.data?.data ?? []).map((contract) => [contract.id, contract.productName ?? contract.id]),
  );
  const unreadCount =
    contractsQuery.data?.meta?.unreadNotifications ??
    notificationsQuery.data?.meta?.unreadNotifications ??
    0;

  const handleNotificationSelect = async (notification: DashboardNotification) => {
    if (!notification.readAt) {
      await markReadMutation.mutateAsync(notification.id);
    }

    const destination = getNotificationDestination(notification);
    startTransition(() => {
      setIsOpen(false);
    });

    if (destination) {
      void navigate(destination);
    }
  };

  return (
    <div className="notification-bell-shell" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="notification-bell-button"
        onClick={() => {
          startTransition(() => {
            setIsOpen((current) => !current);
          });
        }}
        type="button"
      >
        <span aria-hidden="true" className="notification-bell-icon">
          🔔
        </span>
        <span className="sr-only">Notifications</span>
        {unreadCount > 0 ? <span className="notification-bell-badge">{unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <NotificationDropdown
          contractNames={contractNames}
          isLoading={notificationsQuery.isPending}
          notifications={notificationsQuery.data?.data ?? []}
          onMarkAllRead={() => {
            void markAllMutation.mutateAsync();
          }}
          onNotificationSelect={(notification) => {
            void handleNotificationSelect(notification);
          }}
          unreadCount={unreadCount}
        />
      ) : null}
    </div>
  );
}

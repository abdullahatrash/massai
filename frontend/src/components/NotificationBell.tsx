import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            aria-label="Notifications"
            className="relative size-8"
            size="icon"
            variant="ghost"
          />
        }
      >
        <Bell className="size-4 text-stone-500" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[0.5rem] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="max-h-[85vh] w-[360px] overflow-hidden p-0"
        sideOffset={8}
      >
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
      </PopoverContent>
    </Popover>
  );
}

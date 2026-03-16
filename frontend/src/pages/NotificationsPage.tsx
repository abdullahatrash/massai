import { startTransition } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { listContracts } from "../api/contracts";
import {
  getNotificationDestination,
  getNotificationIcon,
  getNotificationSummary,
  getNotificationTone,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type DashboardNotification,
} from "../api/notifications";

const PAGE_SIZE = 20;

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "Just now";
  }
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);

  const contractsQuery = useQuery({
    queryFn: () => listContracts({ page: 1, pageSize: 100 }),
    queryKey: ["notification-contracts"],
  });
  const notificationsQuery = useQuery({
    queryFn: () => listNotifications({ page, pageSize: PAGE_SIZE }),
    queryKey: ["notifications", { page, pageSize: PAGE_SIZE }],
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notification-contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      ]);
    },
  });
  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notification-contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      ]);
    },
  });

  const contractNames = Object.fromEntries(
    (contractsQuery.data?.data ?? []).map((contract) => [contract.id, contract.productName ?? contract.id]),
  );
  const unreadCount = notificationsQuery.data?.meta?.unreadNotifications ?? 0;
  const pagination = notificationsQuery.data?.meta?.pagination;

  const handleNotificationSelect = async (notification: DashboardNotification) => {
    if (!notification.readAt) {
      await markReadMutation.mutateAsync(notification.id);
    }

    const destination = getNotificationDestination(notification);
    if (destination) {
      void navigate(destination);
    }
  };

  return (
    <section className="page-stack">
      <div className="hero-card notifications-hero-card">
        <span className="eyebrow">Notifications</span>
        <h2>Inbox for contract activity</h2>
        <p>
          Review alerts, milestone approvals, and production changes in one place before jumping
          into the relevant contract view.
        </p>

        <div className="contracts-overview-strip">
          <article className="contracts-overview-card">
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </article>
          <article className="contracts-overview-card">
            <span>Showing page</span>
            <strong>{page}</strong>
          </article>
          <article className="contracts-overview-card">
            <span>Page size</span>
            <strong>{PAGE_SIZE}</strong>
          </article>
        </div>
      </div>

      <div className="content-card notifications-page-actions">
        <div>
          <h3>Recent history</h3>
          <p>Unread items stay highlighted until you open them or mark everything as read.</p>
        </div>

        <button className="ghost-button" onClick={() => void markAllMutation.mutateAsync()} type="button">
          Mark all as read
        </button>
      </div>

      {notificationsQuery.isPending ? <p>Loading your notification history.</p> : null}

      {notificationsQuery.isError ? (
        <div className="content-card error-card">
          <h3>Unable to load notifications</h3>
          <p>{notificationsQuery.error.message}</p>
        </div>
      ) : null}

      {notificationsQuery.isSuccess && notificationsQuery.data.data.length === 0 ? (
        <div className="content-card empty-state-card">
          <h3>No notifications yet</h3>
          <p>When a contract needs attention, it will show up here with a direct link to the right page.</p>
        </div>
      ) : null}

      {notificationsQuery.isSuccess && notificationsQuery.data.data.length > 0 ? (
        <div className="notifications-history-list">
          {notificationsQuery.data.data.map((notification) => {
            const contractLabel = notification.contractId
              ? (contractNames[notification.contractId] ?? notification.contractId)
              : "Contract unavailable";

            return (
              <button
                className={`notification-item notification-history-item ${notification.readAt ? "read" : "unread"}`}
                key={notification.id}
                onClick={() => {
                  void handleNotificationSelect(notification);
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`notification-item-icon notification-item-icon-${getNotificationTone(notification.eventType)}`}
                >
                  {getNotificationIcon(notification.eventType)}
                </span>

                <span className="notification-item-copy">
                  <strong>{getNotificationSummary(notification, contractLabel)}</strong>
                  <span>{notification.message}</span>
                  <span className="notification-contract-label">{contractLabel}</span>
                </span>

                <span className="notification-item-meta notification-history-meta">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {pagination ? (
        <div className="content-card notification-pagination">
          <button
            className="ghost-button"
            disabled={page <= 1}
            onClick={() => {
              startTransition(() => {
                setSearchParams(page > 2 ? { page: String(page - 1) } : {});
              });
            }}
            type="button"
          >
            Previous page
          </button>
          <span>Page {pagination.page}</span>
          <button
            className="ghost-button"
            disabled={!pagination.hasMore}
            onClick={() => {
              startTransition(() => {
                setSearchParams({ page: String(page + 1) });
              });
            }}
            type="button"
          >
            Next page
          </button>
        </div>
      ) : null}
    </section>
  );
}

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Link } from "react-router-dom";

import {
  getNotificationIcon,
  getNotificationSummary,
  getNotificationTone,
  type DashboardNotification,
} from "../api/notifications";

type NotificationDropdownProps = {
  contractNames: Record<string, string>;
  isLoading: boolean;
  notifications: DashboardNotification[];
  onMarkAllRead: () => void;
  onNotificationSelect: (notification: DashboardNotification) => void;
  unreadCount: number;
};

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "Just now";
  }
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

export function NotificationDropdown({
  contractNames,
  isLoading,
  notifications,
  onMarkAllRead,
  onNotificationSelect,
  unreadCount,
}: NotificationDropdownProps) {
  return (
    <div className="notification-dropdown content-card" role="dialog" aria-label="Notifications">
      <div className="notification-dropdown-header">
        <div>
          <span className="eyebrow">Notifications</span>
          <h3>Recent activity</h3>
        </div>

        {unreadCount > 0 ? (
          <button className="ghost-button" onClick={onMarkAllRead} type="button">
            Mark all as read
          </button>
        ) : null}
      </div>

      {isLoading ? <p>Loading the latest contract notifications.</p> : null}

      {!isLoading && notifications.length === 0 ? (
        <div className="notifications-empty">
          <h4>No notifications yet</h4>
          <p>New alerts and milestone requests will appear here as soon as they land.</p>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="notification-list">
          {notifications.map((notification) => {
            const contractLabel = notification.contractId
              ? (contractNames[notification.contractId] ?? notification.contractId)
              : "Contract unavailable";

            return (
              <button
                className={`notification-item ${notification.readAt ? "read" : "unread"}`}
                key={notification.id}
                onClick={() => onNotificationSelect(notification)}
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
                  <span className="notification-contract-label">{contractLabel}</span>
                  <span className="notification-item-meta">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="notification-dropdown-footer">
        <Link className="ghost-button notification-view-all-link" to="/notifications">
          View all
        </Link>
      </div>
    </div>
  );
}

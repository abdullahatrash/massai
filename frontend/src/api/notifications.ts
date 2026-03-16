import { apiClient, apiRequest, type ApiResponse } from "./client";

export type NotificationEventType =
  | "ALERT_TRIGGERED"
  | "CONTRACT_STATE_CHANGED"
  | "MILESTONE_APPROVED"
  | "MILESTONE_AWAITING_APPROVAL"
  | "MILESTONE_REJECTED"
  | string;

export type DashboardNotification = {
  contractId: string | null;
  createdAt: string | null;
  eventType: NotificationEventType | null;
  id: string;
  message: string;
  milestoneId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
};

export type NotificationsMeta = {
  pagination: {
    hasMore: boolean;
    page: number;
    pageSize: number;
  };
  unreadNotifications: number;
};

export async function listNotifications(params?: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}): Promise<ApiResponse<DashboardNotification[], NotificationsMeta>> {
  const query = new URLSearchParams();

  if (params?.page) {
    query.set("page", String(params.page));
  }
  if (params?.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }
  if (params?.unreadOnly) {
    query.set("unreadOnly", "true");
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiClient.get<DashboardNotification[], NotificationsMeta>(`/api/v1/notifications${suffix}`);
}

export async function markNotificationRead(notificationId: string): Promise<DashboardNotification> {
  return apiRequest<DashboardNotification>(`/api/v1/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<{ markedCount: number }> {
  return apiRequest<{ markedCount: number }>("/api/v1/notifications/read-all", {
    method: "POST",
  });
}

export function getNotificationDestination(notification: DashboardNotification): string | null {
  if (!notification.contractId) {
    return null;
  }

  const eventType = (notification.eventType ?? "").toUpperCase();
  if (
    eventType === "MILESTONE_AWAITING_APPROVAL" ||
    eventType === "MILESTONE_APPROVED" ||
    eventType === "MILESTONE_REJECTED"
  ) {
    return `/contracts/${notification.contractId}/milestones`;
  }
  if (eventType === "ALERT_TRIGGERED") {
    return `/contracts/${notification.contractId}/alerts`;
  }
  if (eventType === "CONTRACT_STATE_CHANGED") {
    return `/contracts/${notification.contractId}/feed`;
  }

  return `/contracts/${notification.contractId}`;
}

export function getNotificationIcon(eventType: NotificationEventType | null): string {
  switch ((eventType ?? "").toUpperCase()) {
    case "MILESTONE_AWAITING_APPROVAL":
      return "🔶";
    case "ALERT_TRIGGERED":
      return "🔴";
    case "MILESTONE_APPROVED":
    case "MILESTONE_REJECTED":
      return "🔵";
    case "CONTRACT_STATE_CHANGED":
      return "⚪";
    default:
      return "⚪";
  }
}

export function getNotificationTone(
  eventType: NotificationEventType | null,
): "amber" | "blue" | "default" | "red" {
  switch ((eventType ?? "").toUpperCase()) {
    case "MILESTONE_AWAITING_APPROVAL":
      return "amber";
    case "ALERT_TRIGGERED":
      return "red";
    case "MILESTONE_APPROVED":
    case "MILESTONE_REJECTED":
      return "blue";
    default:
      return "default";
  }
}

export function getNotificationSummary(
  notification: DashboardNotification,
  contractLabel?: string | null,
): string {
  const eventType = (notification.eventType ?? "").toUpperCase();
  const milestoneRef =
    typeof notification.payload.milestoneRef === "string"
      ? notification.payload.milestoneRef
      : "This milestone";
  const contractName = contractLabel ?? notification.contractId ?? "this contract";

  if (eventType === "MILESTONE_AWAITING_APPROVAL") {
    return `${milestoneRef} needs your approval`;
  }
  if (eventType === "ALERT_TRIGGERED") {
    return `Issue detected on ${contractName}`;
  }
  if (eventType === "MILESTONE_APPROVED") {
    return `${milestoneRef} was approved`;
  }
  if (eventType === "MILESTONE_REJECTED") {
    return `${milestoneRef} was rejected`;
  }
  if (eventType === "CONTRACT_STATE_CHANGED") {
    return `${contractName} reported a production update`;
  }

  return notification.message;
}

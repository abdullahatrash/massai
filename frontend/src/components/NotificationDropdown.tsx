import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Milestone,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
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

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return "Just now";
  }
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

const TONE_ICON: Record<string, React.ReactNode> = {
  danger: <AlertTriangle className="size-3.5 text-rose-500" />,
  warning: <Clock className="size-3.5 text-amber-500" />,
  success: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  milestone: <Milestone className="size-3.5 text-sky-500" />,
  rejected: <XCircle className="size-3.5 text-rose-500" />,
};

function getIcon(eventType: string | null) {
  if (!eventType) {
    return <Bell className="size-3.5 text-stone-400" />;
  }
  const tone = getNotificationTone(eventType);
  return TONE_ICON[tone] ?? <Bell className="size-3.5 text-stone-400" />;
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
    <div className="flex min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[0.82rem] font-semibold text-stone-900">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="border-rose-200 bg-rose-50 px-1.5 py-0 text-[0.58rem] text-rose-600">
              {unreadCount} new
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            className="text-[0.65rem] text-stone-500"
            onClick={onMarkAllRead}
            size="sm"
            variant="ghost"
          >
            Mark all read
          </Button>
        )}
      </div>

      <Separator />

      {/* Body */}
      {isLoading ? (
        <div className="px-4 py-6 text-center text-[0.75rem] text-stone-400">
          Loading notifications...
        </div>
      ) : null}

      {!isLoading && notifications.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Bell className="mx-auto size-6 text-stone-300" />
          <p className="mt-2 text-[0.78rem] font-medium text-stone-500">No notifications</p>
          <p className="mt-0.5 text-[0.68rem] text-stone-400">
            Alerts and milestone requests will appear here.
          </p>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <ScrollArea className="max-h-[320px]">
          <div className="grid gap-0.5 p-1">
            {notifications.map((notification) => {
              const contractLabel = notification.contractId
                ? (contractNames[notification.contractId] ?? notification.contractId)
                : "Contract unavailable";
              const isUnread = !notification.readAt;

              return (
                <button
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-stone-50",
                    isUnread && "bg-stone-50/60",
                  )}
                  key={notification.id}
                  onClick={() => onNotificationSelect(notification)}
                  type="button"
                >
                  <div className="mt-0.5 shrink-0">
                    {getIcon(notification.eventType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-[0.75rem] leading-snug text-stone-700",
                      isUnread && "font-medium text-stone-900",
                    )}>
                      {getNotificationSummary(notification, contractLabel)}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[0.62rem] text-stone-400">
                      <span className="truncate">{contractLabel}</span>
                      <span>·</span>
                      <span className="shrink-0">{formatRelativeTime(notification.createdAt)}</span>
                    </div>
                  </div>
                  {isUnread && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      ) : null}

      <Separator />

      {/* Footer */}
      <div className="px-4 py-2.5">
        <Link
          className="flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-[0.72rem] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-stone-700"
          to="/notifications"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}

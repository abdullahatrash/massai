# Review: E6-T8 (Notification Bell & In-App Notifications)

**Date:** 2026-03-16  
**Ticket:** E6-T8: Notification Bell & In-App Notifications  
**Verdict:** ✅ Approved — no blocking issues; 1 minor finding

---

## Summary

The notification bell is integrated in the DashboardLayout header with a red badge showing unread count. Clicking opens a dropdown with the last 10 notifications, each showing icon by type, plain English summary, contract name, and relative time. "Mark all as read" and "View all" (→ `/notifications`) are present. Unread count is sourced from `meta.unreadNotifications` on the contracts list and notifications list responses. The NotificationBell maintains WebSocket connections per contract and invalidates on `NOTIFICATION` messages. Notification types map to icons (🔶 MILESTONE_AWAITING_APPROVAL, 🔴 ALERT_TRIGGERED, 🔵 MILESTONE_APPROVED/REJECTED, ⚪ CONTRACT_STATE_CHANGED). Clicking a notification navigates to the relevant contract page and marks it as read. The `/notifications` page shows paginated history with mark-all-read.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Bell icon in DashboardLayout header with unread badge | ✅ |
| 2 | Red dot with number on badge | ✅ |
| 3 | Click bell → dropdown with last 10 notifications | ✅ |
| 4 | Each notification: icon, plain English message, contract name, time elapsed | ✅ |
| 5 | "Mark all as read" button | ✅ |
| 6 | "View all" link → /notifications | ✅ |
| 7 | Unread from meta.unreadNotifications | ✅ |
| 8 | WebSocket NOTIFICATION → badge updates | ✅ |
| 9 | Notification type icons (🔶 🔴 🔵 ⚪) | ✅ |
| 10 | Click notification → navigate and mark as read | ✅ |
| 11 | NotificationBell, NotificationDropdown, NotificationsPage, api/notifications | ✅ |
| 12 | /notifications route, DashboardLayout updated | ✅ |

---

## Files Reviewed

| File | Status |
|------|--------|
| `frontend/src/components/NotificationBell.tsx` | ✅ |
| `frontend/src/components/NotificationDropdown.tsx` | ✅ |
| `frontend/src/pages/NotificationsPage.tsx` | ✅ |
| `frontend/src/api/notifications.ts` | ✅ |
| `frontend/src/layouts/DashboardLayout.tsx` | ✅ |
| `frontend/src/router.tsx` | ✅ |

---

## Findings

### MIN-1 — Duplicate contracts fetch for unread count

The NotificationBell uses `queryKey: ["notification-contracts"]` for `listContracts`, while the contracts list page uses `queryKey: ["contracts"]`. Both return `meta.unreadNotifications`. The bell could use the contracts query cache when the user has visited `/contracts`, but currently it always fetches separately. Consider sharing the cache (e.g. use `["contracts"]` with same params) to avoid redundant requests. Non-blocking.

---

## Verification

- Backend ingest broadcasts `NOTIFICATION` to contract WebSocket when notifications are created
- Backend `GET /api/v1/notifications` returns `meta.unreadNotifications`
- Backend `GET /api/v1/contracts` returns `meta.unreadNotifications`
- `getNotificationDestination` routes to milestones/alerts/feed/overview by event type
- Notification messages use plain English (no blockchain terminology)

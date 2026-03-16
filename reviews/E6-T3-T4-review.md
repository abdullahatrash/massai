# Review: E6-T3 & E6-T4 (Contract Overview & Milestone Timeline Pages)

**Date:** 2026-03-16  
**Tickets:** E6-T3 (Contract Overview Page), E6-T4 (Milestone Timeline Page)  
**Verdict:** ✅ Approved — no blocking issues; 3 minor findings

---

## E6-T3: Contract Overview Page

### Summary

The contract overview page provides a full picture of one contract: header with product name, status badge, delivery countdown (with red styling for overdue), progress section with milestone bar and current stage, next milestone card with approval indicator, pilot-adaptive key metrics (Factor: qty/quality; Tasowheel: routing step; E4M: current phase), recent activity feed (last 5 timeline events), quick action links (View Milestones, View Alerts with badge count, View Documents), and WebSocket-driven live updates via query invalidation.

### Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Header: product name, status badge, delivery countdown | ✅ |
| 2 | Delivery countdown: "X days remaining" / "X days overdue" in red | ✅ |
| 3 | Progress section: milestone progress bar, current stage (pilot-adaptive) | ✅ |
| 4 | Next milestone card: name, planned date, approvalRequired indicator | ✅ |
| 5 | Key metrics strip: Factor qty/quality, Tasowheel routing step, E4M phase | ✅ |
| 6 | Recent activity feed: last 5 events, human-readable, timestamps | ✅ |
| 7 | Quick actions: View Milestones, View Alerts (badge count), View Documents | ✅ |
| 8 | WebSocket connected — status/metrics update live | ✅ |
| 9 | ContractOverview.tsx, MetricCard.tsx, ActivityFeed.tsx, useWebSocket.ts | ✅ |

### E6-T3 Findings

#### MIN-1 — Live event card shows raw message type

The "Latest live event" card displays `lastMessage.type` (e.g. `UPDATE_RECEIVED`, `MILESTONE_CHANGED`). A user-friendly label map would improve UX (e.g. "Production update received", "Milestone status changed"). Non-blocking.

#### MIN-2 — Live event timestamp omits time

`formatDateLabel` returns "d MMM yyyy" only. For a live event, showing time (e.g. "16 Mar 2025, 14:00") would be more informative. Non-blocking.

---

## E6-T4: Milestone Timeline Page

### Summary

The milestone timeline uses a vertical layout with expandable cards. Each milestone shows status icon (✅ Completed, 🔵 In Progress, ⏳ Pending, ❌ Overdue, 🔶 Awaiting Approval), name, planned date, actual completion date, evidence document count badge, and Approve/Reject buttons only when SUBMITTED and approvalRequired. Clicking expands to show evidence documents and notes. Overdue milestones have a red border. Rejection reason is shown on rejected milestones. Approval and rejection use optimistic updates with rollback on error.

### Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Vertical timeline layout | ✅ |
| 2 | Status icons: ✅ Completed, 🔵 In Progress, ⏳ Pending, ❌ Overdue, 🔶 Awaiting Approval | ✅ |
| 3 | Name, planned date, actual completion date | ✅ |
| 4 | Evidence document count badge | ✅ |
| 5 | Approve/Reject only when SUBMITTED and approvalRequired | ✅ |
| 6 | Click milestone → expands to show evidence and notes | ✅ |
| 7 | Overdue milestones with red border | ✅ |
| 8 | Rejection reason shown on rejected milestones | ✅ |
| 9 | Optimistic update after approval/rejection | ✅ |
| 10 | MilestoneTimeline.tsx, MilestoneCard.tsx, ApprovalAction.tsx | ✅ |

### E6-T4 Findings

#### MIN-1 — Reject form state not reset on success

When the user successfully rejects a milestone, the Approve/Reject buttons disappear because the milestone status changes to REJECTED. The ApprovalAction unmounts, so the form state is effectively reset. No fix needed; the current behavior is correct. Documented for clarity.

---

## Files Reviewed

| File | Status |
|------|--------|
| `frontend/src/pages/ContractOverview.tsx` | ✅ |
| `frontend/src/pages/MilestoneTimeline.tsx` | ✅ |
| `frontend/src/components/MetricCard.tsx` | ✅ |
| `frontend/src/components/ActivityFeed.tsx` | ✅ |
| `frontend/src/components/MilestoneCard.tsx` | ✅ |
| `frontend/src/components/ApprovalAction.tsx` | ✅ |
| `frontend/src/hooks/useWebSocket.ts` | ✅ |

---

## Verification

- `pnpm run build` → 0 errors
- WebSocket invalidation on UPDATE_RECEIVED, MILESTONE_CHANGED, CONTRACT_STATE_CHANGED
- Backend milestones sorted by planned_date
- Backend timeline returns human-readable descriptions

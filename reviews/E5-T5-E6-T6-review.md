# Review: E5-T5 & E6-T6 (Milestone Trigger Panel & Alert Center Page)

**Date:** 2026-03-16  
**Tickets:** E5-T5 (Milestone Trigger Panel), E6-T6 (Alert Center Page)  
**Verdict:** ✅ Approved — 1 fix applied (E5-T5 Open Consumer View URL); no blocking issues

---

## E5-T5: Milestone Trigger Panel

### Summary

The milestone trigger panel is implemented in the "Milestones" tab of the simulator. It fetches milestones and last known state, renders each milestone with status, approval hint, and "Submit Complete" button. Submitting sends `MILESTONE_COMPLETE` with pilot-specific payloads. The button is disabled for COMPLETED, APPROVED, and SUBMITTED. Approval-required milestones show a tooltip. Polling every 4s refreshes milestone state. A prior review (E5-T5-review.md) applied 3 fixes; this review applies one additional fix.

### Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | "Milestones" tab in simulator panel | ✅ |
| 2 | List of milestones with current status | ✅ |
| 3 | "Submit Complete" disabled if COMPLETED | ✅ |
| 4 | Submitting sends MILESTONE_COMPLETE with milestone_ref | ✅ |
| 5 | Tooltip for approval_required: "Consumer approval required after submission" | ✅ |
| 6 | After submission, milestone status updates | ✅ |
| 7 | "Open Consumer View" opens consumer dashboard in new tab | ✅ |
| 8 | MilestoneTriggerPanel.tsx | ✅ |

### E5-T5 Findings

#### MIN-1 (Fixed) — Open Consumer View URL opened contracts list, not contract detail

The URL `/contracts?contractId=xxx` opened the contracts list page. The `contractId` query param is not used by the consumer dashboard to navigate to the contract. Updated to `/contracts/${contract.id}` so the new tab opens directly on the contract overview page.

---

## E6-T6: Alert Center Page

### Summary

The alert center page displays active alerts (ordered by severity, CRITICAL first), each with severity badge, plain English description, and relative time ("2 hours ago"). An "Acknowledge" button per alert moves it to history with optimistic update. Alert history has severity and date filters. Acknowledged alerts show a checkmark. Empty state: "No active alerts" / "Production is on track." Critical alerts have a pulsing red indicator. Alert count appears in the page header and in the contract tab bar badge.

### Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Active alerts ordered by severity (CRITICAL first) | ✅ |
| 2 | Severity badge, plain English description, time elapsed | ✅ |
| 3 | Acknowledge button per alert — moves to history | ✅ |
| 4 | Alert history with date and severity filters | ✅ |
| 5 | Acknowledged alerts shown with checkmark | ✅ |
| 6 | Empty state: "No active alerts — production is on track" | ✅ |
| 7 | Critical alerts with pulsing red indicator | ✅ |
| 8 | Alert count in page header and contract nav badge | ✅ |
| 9 | AlertCenter.tsx, AlertItem.tsx | ✅ |

### E6-T6 Findings

No blocking or minor issues identified. Implementation meets the spec.

---

## Files Reviewed

| File | Status |
|------|--------|
| `frontend/src/pages/simulator/MilestoneTriggerPanel.tsx` | ✅ |
| `frontend/src/pages/AlertCenter.tsx` | ✅ |
| `frontend/src/components/AlertItem.tsx` | ✅ |

---

## Verification

- Backend `list_active_alerts` sorts by `_sort_key` (severity, then timestamp)
- ContractRouteLayout fetches alerts and shows badge in Alerts tab
- WebSocket `ALERT_TRIGGERED` invalidates alert views

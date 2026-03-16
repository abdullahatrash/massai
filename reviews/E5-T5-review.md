# E5-T5 Review — Milestone Trigger Panel

**Date:** 2026-03-16  
**Ticket:** E5-T5: Milestone Trigger Panel  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — 3 fixes applied, 2 minor findings

---

## Summary

The milestone trigger panel is fully implemented and integrated. `MilestoneTriggerPanel` is
mounted in the "Milestones" tab, fetches milestones and last known state, and renders each
milestone with status, approval hint, and "Submit Complete" button. Submitting sends a
`MILESTONE_COMPLETE` ingest with pilot-specific payloads (Factor: quantity/quality, Tasowheel:
routingStep/stepStatus, E4M: completionPct/currentPhase). The button is disabled for COMPLETED,
APPROVED, and SUBMITTED. Approval-required milestones show a tooltip. "Open Consumer View"
opens `/contracts?contractId=...` in a new tab. Polling every 4s refreshes milestone state.
TypeScript passes.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | "Milestones" tab in simulator panel | ✅ |
| 2 | List of milestones with current status | ✅ |
| 3 | "Submit Complete" disabled if COMPLETED | ✅ |
| 4 | Submitting sends MILESTONE_COMPLETE with milestone_ref | ✅ |
| 5 | Tooltip for approval_required: "Consumer approval required after submission" | ✅ |
| 6 | After submission, milestone status updates (refetch) | ✅ |
| 7 | "Open Consumer View" opens consumer dashboard in new tab | ✅ |
| 8 | Pilot-specific payloads (Factor, Tasowheel, E4M) | ✅ |

**TypeScript check:** `pnpm tsc --noEmit` → 0 errors

---

## Findings

### MIN-1 (Fixed) — setRequestError for providerClient not wrapped in startTransition

When `providerClient` was null, `setRequestError` was called synchronously. Wrapped in
`startTransition` for consistency with other state updates.

### MIN-2 (Fixed) — Polling interval used fresh AbortController, not cleanup signal

The 4s polling interval called `loadMilestones()` with no signal, so each tick created a new
AbortController. On unmount, only the initial load was aborted; in-flight polling requests
could complete and attempt setState. Fixed by passing `controller.signal` to the interval's
`loadMilestones` so cleanup aborts all in-flight requests.

### MIN-3 (Fixed) — Redundant "Milestone trigger panel" card in ContractSimulator

A module card said "The Milestones tab can now submit completion updates...". Redundant with
the Milestones tab. Removed the card.

---

## Remaining minor findings

### MIN-4 — Open Consumer View URL: contractId query param unused

The URL `/contracts?contractId=xxx` opens the contracts page. `ContractsPage` does not read the
`contractId` query param to navigate to or highlight that contract. The param is harmless and
may be used when the consumer dashboard adds deep-linking. No change needed for now.

### MIN-5 — REJECTED milestones remain submittable

`canSubmitMilestone` disables for COMPLETED, APPROVED, SUBMITTED. REJECTED milestones can be
resubmitted. This may be intentional (retry after rejection). If not, add REJECTED to the
disabled list.

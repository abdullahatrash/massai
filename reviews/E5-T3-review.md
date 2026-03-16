# E5-T3 Review — Manual Update Form

**Date:** 2026-03-16  
**Ticket:** E5-T3: Manual Update Form  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — 5 fixes applied, 2 minor findings

---

## Summary

The manual send form is fully implemented and integrated. `ManualSendForm` fetches the contract
overview to prefill from `lastKnownState`, renders pilot-specific forms (Factor, Tasowheel, E4M)
via `FactorForm`, `TasowheelForm`, and `E4mForm`, validates before submit, and posts to the
ingest API using the provider service account. The response panel shows HTTP status,
`alertsTriggered`, and `milestoneUpdated`. The form lives in a "Manual Send" tab alongside
"Scenarios" in `ContractSimulator`. TypeScript passes.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Manual Send tab alongside Scenarios | ✅ |
| 2 | Factor form: quantityProduced, qualityPassRate, currentStage dropdown | ✅ |
| 3 | Tasowheel form: routingStep, stepName, stepStatus, optional downtimeMinutes, energyKwh | ✅ |
| 4 | E4M form: currentPhase (M1–M6), completionPct slider, approvalRequired toggle, test results | ✅ |
| 5 | updateType dropdown always visible | ✅ |
| 6 | Submit → POST to ingest API | ✅ |
| 7 | Response panel: HTTP status, alertsTriggered, milestoneUpdated | ✅ |
| 8 | Form pre-fills from last known state | ✅ |
| 9 | Validation before send (e.g. qualityPassRate 0–1) | ✅ |
| 10 | Provider service account auth | ✅ |

**TypeScript check:** `pnpm tsc --noEmit` → 0 errors

---

## Findings

### IMP-1 (Fixed) — E4M completionPct validation rejected valid decimal input

The validation used `Number.isInteger(completionPct)`, which failed when `lastKnownState` or the
slider produced a decimal (e.g. 45.5). The backend expects an integer 0–100.

**Fix applied:** Round the value before validation and in the payload. Added `step="1"` to the
E4M completion range input so the slider produces integers.

### MIN-1 (Fixed) — Unknown pilot type showed FactorForm by default

When `contract.pilotType` was null or not in {FACTOR, TASOWHEEL, E4M}, the form defaulted to
FactorForm. This could confuse users with misconfigured contracts.

**Fix applied:** Show a "No form available for pilot type X" message when the pilot is unsupported.
Submit button disabled when pilot is unknown. Validation returns a pilotType error if Submit is
somehow triggered.

### MIN-2 (Fixed) — setRequestError for providerClient not wrapped in startTransition

`setRequestError` was called synchronously when `providerClient` was null. Wrapped in
`startTransition` for consistency with other state updates.

### MIN-3 (Fixed) — Redundant "Manual send form" card in ContractSimulator

A module card below the tabs said "The pilot-specific form now lives in the Manual Send tab."
Redundant since the form is in the tab. Removed the card.

### MIN-4 (Fixed) — E4M completion range input lacked step="1"

The completion slider could produce decimal values. Added `step="1"` to ensure integer output.

---

## Remaining minor findings

### MIN-5 — E4mForm testResults: empty testName can be sent

When a test result has an empty `testName` and `result: "PASS"`, the payload omits `testName`
via `...(result.testName.trim() ? { testName: ... } : {})`. The backend may accept this; no
validation error is shown. Low risk; acceptable as-is.

### MIN-6 — ContractOverview type uses lastKnownState; API returns lastKnownState

The API returns `lastKnownState` (camelCase). The type expects `lastKnownState`. The
`apiRequest` unwraps `data` from the response. The contract overview endpoint returns
`{ data: { ..., lastKnownState, ... } }`. Correct.

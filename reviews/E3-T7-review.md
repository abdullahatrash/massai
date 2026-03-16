# E3-T7 Review — Audit Export Endpoint

**Date:** 2026-03-16  
**Ticket:** E3-T7: Audit Export Endpoint  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — 1 required fix applied, 3 minor findings

---

## Summary

`GET /contracts/{id}/audit-export` is correctly implemented. The response includes all
required fields: contract metadata (no blockchain address), milestones with evidence,
alerts with acknowledgement timestamps, timeline events, `blockchainVerified` + `verifiedAt`
+ `transactionHash` for blockchain-confirmed milestones, and `exportedAt` / `contractId`.
The `?format=pdf` param returns structured JSON for frontend `window.print()` flows.
All 5 integration tests pass.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `GET /audit-export` — full JSON audit trail | ✅ |
| 2 | Contract metadata without blockchain address | ✅ |
| 3 | Timeline events in chronological order | ✅ |
| 4 | Milestones with statuses, dates, evidence | ✅ |
| 5 | Alerts (active + resolved) with `acknowledgedAt` | ✅ |
| 6 | `blockchainVerified: true` + `verifiedAt` for confirmed milestones | ✅ |
| 7 | `transactionHash` only in this endpoint | ✅ |
| 8 | `?format=pdf` returns structured JSON | ✅ |
| 9 | `consumer` + `admin` roles; provider → 403 | ✅ |
| 10 | Files: `audit.py`, `schemas/audit.py`, `services/audit.py` | ✅ |
| 11 | `exportedAt` and `contractId` in response | ✅ |
| 12 | Router registered in `router.py` | ✅ |

**Test results:** 5/5 passed

---

## Findings

### IMP-1 — `AuditService` imports private helpers from the API layer

```python
# services/audit.py:6-7
from app.api.v1.alerts import _alert_description
from app.api.v1.timeline import _build_timeline
```

A service importing private (`_`-prefixed) functions from API handlers inverts the
dependency direction. Services should not depend on API layer code. This creates an
implicit coupling: changes to `alerts.py` or `timeline.py` routing concerns could
silently break the audit service, and unit-testing `AuditService` in isolation is
harder because it pulls in the full API handler context.

**Fix applied:** Created `app/core/formatting.py` with a public `describe_alert`
function. Removed the local `_alert_description` from `alerts.py` and the duplicate
`_humanize_alert_description` from `timeline.py`; both now call `describe_alert`.
`AuditService` imports `describe_alert` from `app/core/formatting.py` (service layer)
instead of the private API function. `_build_timeline` renamed to `build_timeline`
(public) so the import from the service is at least explicit; a full extraction of
`build_timeline` to `app/core/` is a follow-up refactor task.

### MIN-1 — `_assert_contract_access` is now the 7th duplicate

`audit.py` adds yet another copy of `_assert_contract_access`. Same pattern as found
in E3-T2, E3-T3, E3-T4, E3-T5, E3-T6. Must be centralised in `app/core/contracts.py`.

### MIN-2 — Test uses legacy event data keys; production writes different keys

```python
# test_audit_api.py:116-119
blockchain_event.event_data = {
    "milestone_ref": "TURNING",   # snake_case
    "milestone_id": str(milestone.id),  # snake_case
}
```

Production `approve_submission` writes `{"milestone_id": ..., "milestoneRef": ...}`
(mixed case). `_queue_blockchain_completion` writes `{"milestoneId": ..., "milestoneRef": ...}`
(camelCase). Neither matches the test data exactly. The `_build_blockchain_verification_index`
correctly handles all four variants, but the test should use the canonical production
format to serve as accurate documentation.

### MIN-3 — No 404 test for unknown contract

All other consumer endpoints have a dedicated test asserting 404 when the contract ID
does not exist. `test_audit_api.py` has no such case.

---

## Applied Fix — IMP-1

Created `app/core/formatting.py` with public `describe_alert`. Removed
`_alert_description` from `alerts.py`, removed `_humanize_alert_description` from
`timeline.py`, renamed `_build_timeline` → `build_timeline`. Updated
`app/services/audit.py` to import from `app/core/formatting` and
`app/api/v1/timeline`. Full suite: **88 passed, 3 pre-existing E3-T8 failures**.

# Review: E2-T5 (Consumer Milestone Approval Endpoint)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved with 1 required fix (IMP-1)

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/api/v1/milestones.py` | ✅ |
| `backend/app/schemas/milestone.py` | ✅ |
| `backend/app/services/milestone.py` (extended with `approve_submission`, `reject_submission`) | ✅ |
| `backend/tests/integration/test_milestones_api.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `POST /api/v1/contracts/{contractId}/milestones/{milestoneId}/approve` exists | ✅ |
| `POST /api/v1/contracts/{contractId}/milestones/{milestoneId}/reject` exists | ✅ |
| `notes` is optional on approve; `reason` is required on reject (min_length=1) | ✅ |
| Approve: status transitions `SUBMITTED` → `APPROVED` → `COMPLETED` (transient, DB sees `COMPLETED`) | ✅ |
| Approve: `actual_date` recorded at decision time | ✅ |
| Approve: `BlockchainEvent` row inserted via `session.add(...)` | ✅ |
| Reject: status → `REJECTED` | ✅ |
| Reject: rejection reason stored in `milestone.evidence` JSONB array | ✅ |
| Reject: provider notified (notification queued) | ✅ |
| 400 if milestone not in `SUBMITTED` state (approve path) | ✅ |
| 400 if milestone not in `SUBMITTED` state (reject path — guard present, untested) | ✅ |
| 403 if user is not the contract's consumer (`_assert_consumer_owns_contract`) | ✅ |
| Double access guard: JWT `contract_ids` claim + DB `consumer_id` field | ✅ |
| Response uses standard envelope with `milestoneId`, `contractId`, `status` | ✅ |
| All 5 integration tests pass, full suite 47/47 | ✅ |

---

## Issues

### IMP-1 — `approve_submission` creates a duplicate blockchain event (JSONB queue + DB row)

**Location:** `milestone.py` lines 47–60

```python
MilestoneService._queue_blockchain_completion(contract, milestone, decision_time)  # ← JSONB
session.add(
    BlockchainEvent(
        event_type="MILESTONE_APPROVED",
        ...
    )
)  # ← DB row
```

Both are called. This means every milestone approval writes the event to **two places**: the `contract.config["blockchain_queue"]` JSONB array (the E2-T4 IMP-2 anti-pattern) and the `blockchain_events` table (the correct approach).

When E5 (MSB Integration) processes the `blockchain_events` table, it will find and submit the event. The JSONB queue entry will silently accumulate forever. This is a data consistency issue — the same event logged in two different stores with no deduplication mechanism.

**Fix:** Remove the `_queue_blockchain_completion(...)` call from `approve_submission`. The `session.add(BlockchainEvent(...))` is sufficient and correct.

```python
# milestone.py — approve_submission, remove this line:
MilestoneService._queue_blockchain_completion(contract, milestone, decision_time)
```

Note: `evaluate_submission` (auto-verify path) still uses `_queue_blockchain_completion` and does NOT add a `BlockchainEvent` row — that remains an E2-T4 IMP-2 carry-over. The fix here is specifically for the `approve_submission` path.

---

### MIN-1 — `FakeSession.execute` routes queries by inspecting SQL string text

**Location:** `test_milestones_api.py` lines 35–39

```python
async def execute(self, statement: Any) -> FakeScalarResult:
    statement_text = str(statement)
    if "FROM contracts" in statement_text:
        return FakeScalarResult(self.contract)
    return FakeScalarResult(self.milestone)
```

The fake decides what to return based on whether the rendered SQL string contains `"FROM contracts"`. This is fragile:
- SQLAlchemy's SQL rendering is not a public API — a version bump could change the format.
- If a future query touches both contracts and milestones in a join, the routing breaks silently.

A more robust pattern uses an ordered `execute_results` queue (as done in `FakeMonitoringSession` from `test_monitoring_service.py`) or separate method overrides per query type.

**Action:** Low priority — tests pass now, but refactor when tests are next touched.

---

### MIN-2 — No test for rejecting a non-`SUBMITTED` milestone

The `reject_submission` method correctly guards:

```python
if milestone.status != "SUBMITTED":
    raise ApiException(status_code=400, ...)
```

But there is no test that exercises this path on the reject endpoint. `test_approve_rejects_non_submitted_milestone` covers approve only. A symmetric `test_reject_rejects_non_submitted_milestone` test is missing.

---

### MIN-3 — `_get_contract` duplicated in `milestones.py` and `ingest.py`

Both routers define their own `_get_contract` async function with identical JSONB query logic:

```python
select(Contract).where(Contract.config["public_id"].as_string() == contract_id)
```

This is the unresolved E2-T2 IMP-1 (no index on this expression, and now the code is duplicated). Extracting to a shared `app/core/contract_lookup.py` helper would centralise the fix when the `public_id` column is eventually added.

---

### MIN-4 — `notes` field accepts empty string (`""`)

`ApproveMilestoneRequest.notes` is `str | None = Field(default=None, max_length=2000)` with no `min_length`. Passing `notes=""` is valid at the Pydantic layer. `_append_approval_note` skips empty strings (`if not notes: return`), so no functional issue. The schema could be tightened to `min_length=1` to be explicit.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E2-T5 | ✅ **Approved** | IMP-1: remove redundant `_queue_blockchain_completion` call in `approve_submission` |

**IMP-1 is a one-line fix.** All other findings are minor. The double-access-check pattern (JWT claim + DB consumer_id) is well designed and correctly implemented.

**Carry-forward reminders before E3/E4/E5:**
- E2-T2 IMP-1 still open: `public_id` column / index needed on `contracts`
- E2-T3 IMP-2 still open: `QUALITY_EVENT` → `alerts` table not JSONB
- E2-T4 IMP-2 still open: `evaluate_submission` → `blockchain_events` table for auto-verify path
- E2-T4 IMP-1 still open: `notifications` table needed

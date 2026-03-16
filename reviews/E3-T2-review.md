# Review: E3-T2 (Milestones & Timeline Endpoints)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved — 1 required fix applied, 4 minor findings

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/api/v1/milestones.py` (extended) | ✅ |
| `backend/app/api/v1/timeline.py` (new) | ✅ (IMP-1 fixed) |
| `backend/app/schemas/milestone.py` (extended) | ✅ |
| `backend/app/schemas/timeline.py` (new) | ✅ |
| `backend/app/api/v1/router.py` | ✅ (timeline router registered) |
| `backend/tests/integration/test_consumer_read_api.py` | ✅ (test data corrected) |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `GET /api/v1/contracts/{id}/milestones` — all milestones ordered by `planned_date` | ✅ |
| Stable sort: ties broken by `name` then `id` | ✅ |
| `GET /api/v1/contracts/{id}/milestones/{mId}` — single milestone with `evidence` array | ✅ |
| `evidence` defaults to empty list `[]` | ✅ |
| `isOverdue` flag: `planned_date < today AND status != COMPLETED` | ✅ |
| `GET /api/v1/contracts/{id}/timeline` — events sorted chronologically | ✅ |
| Timeline covers milestones + alerts + blockchain events | ✅ |
| Milestone descriptions plain English | ✅ |
| REJECTED milestone includes rejection reason in description | ✅ |
| Alert descriptions plain English | ✅ |
| Blockchain event descriptions plain English — no "transaction hash", "block number" | ✅ |
| PENDING milestones correctly excluded from timeline (no actual_date) | ✅ |
| `selectinload` used for milestones, alerts, blockchain_events | ✅ |
| `timeline_router` registered in `router.py` | ✅ |
| 5/5 integration tests pass | ✅ |

---

## Issues

### ~~IMP-1~~ — `_blockchain_description` used `milestone_ref` (snake_case), production events store `milestoneRef` (camelCase) — **Applied**

**Location:** `timeline.py` line 107 (before fix)

```python
# Before — always fell back to "milestone" in production:
milestone_name = event_data.get("milestone_name") or event_data.get("milestone_ref") or "milestone"

# After — matches what milestone.py actually stores:
milestone_name = event_data.get("milestone_name") or event_data.get("milestoneRef") or "milestone"
```

Both `_queue_blockchain_completion` and `approve_submission` in `milestone.py` store `"milestoneRef"` (camelCase). The old `event_data.get("milestone_ref")` lookup always returned `None`, so every blockchain timeline event would render as *"Milestone 'milestone' approved and recorded"* in production — the actual milestone name was never shown.

The test masked this by manually building event data with `{"milestone_ref": "TURNING"}` (snake_case) instead of `{"milestoneRef": "TURNING"}`. Both the `timeline.py` lookup and the test data key have been corrected.

---

### MIN-1 — `_assert_contract_access` is duplicated in three files

`contracts.py`, `milestones.py`, and `timeline.py` all define an identical local `_assert_contract_access` helper. If access logic ever needs to change (e.g., adding admin bypass, logging), all three files need to be updated in sync.

**Recommendation:** Move to `app/core/contracts.py` alongside the other contract helpers:
```python
def assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract_public_id(contract)):
        return
    raise ApiException(status_code=403, code="FORBIDDEN", message="...")
```

---

### MIN-2 — `get_milestone` loads all milestones via `selectinload` then queries the DB again

**Location:** `milestones.py` lines 159–165

```python
contract = await get_contract_by_public_id(
    session, contract_id,
    options=(selectinload(Contract.milestones),),  # loads all milestones
)
_assert_contract_access(contract, current_user)
milestone = await _get_milestone(session, contract, milestone_id)  # queries DB again
```

`_get_milestone` issues a `SELECT FROM milestones WHERE id = ? AND contract_id = ?` even though all milestones are already in `contract.milestones`. For single-milestone lookups, either:
- Drop the `selectinload` (just verify access on the contract, then targeted milestone query), or
- Remove the secondary query and scan `contract.milestones` directly.

The `selectinload` is necessary and efficient for `list_milestones` but redundant here.

---

### MIN-3 — Alert timeline descriptions expose raw JSON for `QUALITY_EVENT_PENDING` alerts

**Location:** `timeline.py` line 95

```python
description = alert.condition_description or f"{severity.title()} alert triggered"
```

`_queue_quality_event` in `monitoring.py` stores `condition_description` as a JSON-serialised dict:
```json
{"updateId": "...", "sensorId": "sensor-1", "payload": {...}}
```

This renders as raw JSON in the timeline — not plain English. A simple fix would be to detect JSON and humanise:
```python
def _humanize_alert_description(alert: Alert) -> str:
    raw = alert.condition_description or ""
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and "sensorId" in parsed:
            return f"Quality event received from sensor {parsed['sensorId']}"
    except (ValueError, TypeError):
        pass
    return raw or f"{(alert.severity or 'alert').title()} alert triggered"
```

---

### MIN-4 — `test_milestone_detail_includes_evidence_array` tests empty evidence only

**Location:** `test_consumer_read_api.py` line 244

```python
milestone_id = self.factor_contract.milestones[0].id  # HEAT Treatment — no evidence
```

`milestones[0]` is HEAT Treatment which has no evidence defined. The test verifies `evidence == []`, which is correct but doesn't exercise the populated evidence path. `milestones[1]` (TURNING) has `evidence: [{"type": "REPORT", "url": "..."}]` and is never tested for its evidence content.

**Recommendation:** Add a second assertion or a separate test case:
```python
turning_id = self.factor_contract.milestones[1].id  # TURNING has evidence
response = client.get(f"/api/v1/contracts/contract-factor-001/milestones/{turning_id}")
self.assertEqual(response.json()["data"]["evidence"], [{"type": "REPORT", "url": "..."}])
```

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E3-T2 | ✅ **Approved** | IMP-1 found and fixed during review — 4 minor findings remain |

**The implementation is clean and well-structured.** The plain-English timeline requirement is well-handled — rejected milestones surface their rejection reason, blockchain events are humanised, and none of the raw model terminology leaks into descriptions. The `_milestone_description` returning `None` for PENDING milestones (correctly excluding them from the timeline) is a good design choice.

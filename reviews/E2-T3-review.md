# Review: E2-T3 (Monitoring Service — Update Processing)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved with 2 required fixes (IMP-1, IMP-2)

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/services/monitoring.py` | ✅ |
| `backend/tests/unit/test_monitoring_service.py` | ✅ |
| `backend/app/api/v1/ingest.py` (updated to wire service) | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `MonitoringService.process_update(update, session)` exists as a static async method | ✅ |
| `MILESTONE_COMPLETE`: milestone matched by `milestone_ref`, status → `SUBMITTED`, `actual_date` set | ✅ |
| `MILESTONE_COMPLETE`: evidence from update appended to milestone.evidence | ✅ |
| `PRODUCTION_UPDATE`: `contract.config.last_known_state` updated with payload (merges, not replaces) | ✅ |
| `PHASE_CHANGE`: `contract.config.current_phase` updated from `currentPhase` field | ✅ |
| `QUALITY_EVENT`: logged to an alert evaluation queue | ✅ (but see IMP-2) |
| `update.processed = True` after all handling paths | ✅ |
| `ingest.py` updated: `session.flush()` → `process_update()` → `session.commit()` | ✅ |
| `update.contract = contract` set before service call — avoids redundant DB query | ✅ |
| Response uses `bool(update.processed)` — correctly reflects service result | ✅ |
| `_get_contract` fallback: uses `session.get()` if relationship not loaded | ✅ |
| `now` injectable parameter — deterministic and testable | ✅ |
| All 4 unit tests pass | ✅ |

---

## Issues

### IMP-1 — `_process_milestone_complete` silently discards events with missing or unknown `milestone_ref`

**Location:** `monitoring.py` lines 63–75

```python
milestone_ref = payload.get("milestone_ref") or payload.get("milestoneRef")
if not milestone_ref:
    return           # ← silent discard

milestone = result.scalar_one_or_none()
if milestone is None:
    return           # ← silent discard
```

Both cases silently return with `update.processed = True`. From the provider's perspective, the ingest call succeeds (HTTP 200, `"processed": true`) with no indication that the milestone was not found or that the `MILESTONE_COMPLETE` event was entirely ignored.

In a production monitoring context, milestone completion is a critical business event — a silent no-op is dangerous. A provider sending `milestone_ref: "NONEXISTENT"` will believe the milestone was recorded when it was not.

**Recommended fix — raise an `ApiException` that the ingest handler propagates:**

```python
if not milestone_ref:
    raise ValueError("MILESTONE_COMPLETE payload must include 'milestoneRef'.")

milestone = result.scalar_one_or_none()
if milestone is None:
    raise ValueError(
        f"Milestone '{milestone_ref}' not found for contract '{contract.id}'."
    )
```

The ingest handler can catch `ValueError` from the service and return a `400 BAD_REQUEST` with a clear error message. Alternatively, introduce a custom `MonitoringServiceError` exception.

---

### IMP-2 — `QUALITY_EVENT` queue is stored as a JSONB array inside `contract.config` — will break E4-T1

**Location:** `monitoring.py` lines 101–117

```python
config["alert_evaluation_queue"] = queue
contract.config = config
```

The quality event is appended to `contracts.config["alert_evaluation_queue"]` — an unbounded JSONB array nested inside the contract's config blob. This has three problems:

1. **Unbounded growth** — the array grows forever with no consumer draining it; after a few days of `QUALITY_EVENT` updates the JSONB blob becomes large, degrading all reads of `contract.config`.
2. **No indexing** — alert events buried in JSONB cannot be queried efficiently by severity, time, or contract. E4-T1 (Rule Engine) needs to query alert candidates — it cannot do this from a JSONB array inside another table's config column.
3. **The `alerts` table already exists** — the `alerts` table was created in E1-T3 specifically for this purpose (`rule_id`, `severity`, `triggered_at`, `blockchain_logged`, etc.). Quality events that need alert evaluation should write a provisional `Alert` row (e.g. `severity="PENDING"`) rather than using a custom JSONB queue.

**Recommended fix:**

Replace the `_queue_quality_event` stub with a proper `Alert` row insert:

```python
@staticmethod
def _queue_quality_event(
    update: StatusUpdate,
    contract: Contract,
    session: AsyncSession,
    now: datetime,
) -> None:
    from app.models.alert import Alert
    alert = Alert(
        id=uuid.uuid4(),
        contract_id=contract.id,
        rule_id="QUALITY_EVENT_PENDING",
        condition_description=f"Quality event from sensor {update.sensor_id}",
        severity="PENDING",
        triggered_at=now,
        blockchain_logged=False,
    )
    session.add(alert)
```

This keeps E4-T1's rule engine work clean — it queries the `alerts` table for `severity="PENDING"` rows, evaluates them, and updates to `HIGH`/`MEDIUM`/etc.

---

### MIN-1 — `milestone_ref` / `milestoneRef` dual-key lookup carried forward from E2-T1 MIN-2

**Location:** `monitoring.py` line 63

```python
milestone_ref = payload.get("milestone_ref") or payload.get("milestoneRef")
```

This is the direct consequence of the unresolved E2-T1 MIN-2. Fixing the schemas (removing one variant) and agreeing on `milestoneRef` (camelCase) would clean this up here too.

---

### MIN-2 — No integration test for ingest → milestone status change

Ticket step 5: *"Integration test: POST ingest → verify milestone status in DB changed."*

The updated `test_ingest_api.py` tests do not include a `MILESTONE_COMPLETE` ingest that verifies the milestone's status changed in the fake session. The monitoring service is tested in isolation (unit tests), but there is no test that exercises the full `ingest endpoint → MonitoringService` wiring end-to-end with a milestone state assertion. This gap would not catch a regression in the `ingest.py` wiring (e.g. if the `update.contract = contract` line was removed).

**Action:** Add one integration test to `test_ingest_api.py` that sends a `MILESTONE_COMPLETE` body with a valid `milestoneRef` and asserts the milestone status is `SUBMITTED`.

---

### MIN-3 — `QUALITY_EVENT` queue entry omits the actual payload metrics

**Location:** `monitoring.py` lines 108–114

```python
queue.append({
    "update_id": str(update.id),
    "update_type": update.update_type,
    "queued_at": now.isoformat(),
})
```

The quality metrics (e.g. `qualityPassRate: 0.81`) are in `update.payload` but are not copied into the queue entry. When E4 (Rule Engine) processes the queue, it must do an extra DB query to `status_updates` to retrieve the payload. Including the key fields in the queue entry (or, after IMP-2 is fixed, embedding them in the `Alert` row's `condition_description`) avoids that round-trip.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E2-T3 | ✅ **Approved** | IMP-1: raise on missing/unknown `milestone_ref`; IMP-2: use `alerts` table instead of JSONB queue — fix both before E4-T1 begins |

**IMP-2 especially**: E4-T1 (Alert Rule Engine) is the direct next consumer of the quality event mechanism. If IMP-2 is not fixed first, E4-T1 will either build on the JSONB queue approach (technical debt) or require a breaking refactor of the monitoring service mid-sprint.

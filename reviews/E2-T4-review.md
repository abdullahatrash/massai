# Review: E2-T4 (Milestone Auto-Verification)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved with 2 required fixes (IMP-1, IMP-2)

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/services/milestone.py` | ✅ |
| `backend/tests/unit/test_milestone_service.py` | ✅ |
| `backend/app/services/monitoring.py` (updated to call MilestoneService) | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `MilestoneService.evaluate_submission(milestone_id, session)` exists | ✅ |
| `approval_required: false` → auto-verify → `COMPLETED` or `REJECTED` | ✅ |
| `approval_required: true` → stays `SUBMITTED`, notification queued | ✅ |
| Factor: `qualityPassRate >= minQualityPassRate` AND `quantityProduced >= quantityPlanned` | ✅ |
| Factor: `currentStage` must match criteria if specified | ✅ |
| Tasowheel: `stepStatus == "COMPLETE"`, optional `routingStep` match | ✅ |
| E4M: `completionPct == 100` AND no open `HIGH`/`CRITICAL` issues | ✅ |
| `_has_open_high_or_critical_issue` correctly skips `CLOSED`/`RESOLVED`/`DONE` issues | ✅ |
| `COMPLETED` milestone logged to blockchain queue | ✅ (but see IMP-2) |
| `now` injectable — deterministic and testable | ✅ |
| `latest_update` injectable — avoids extra DB query when called from ingest path | ✅ |
| `MonitoringService._process_milestone_complete` updated to call `evaluate_submission` | ✅ |
| SQLAlchemy identity map correctly returns in-memory milestone in `session.get()` | ✅ |
| All 4 unit tests pass, full suite 47/47 | ✅ |

---

## Issues

### IMP-1 — `_queue_approval_notification` writes to `contract.config` instead of a `notifications` table

**Location:** `milestone.py` lines 136–155

```python
config["notification_queue"] = queue
contract.config = config
```

The ticket spec says: *"send notification to consumer (log to `notifications` table)"*. The implementation stores the event in `contract.config["notification_queue"]` — a JSONB array inside the contract row. This is the same JSONB-queue anti-pattern already flagged in E2-T3 IMP-2 for quality events.

Problems:
1. There is no durable notification for the consumer — if the contract config is read for any other purpose, the notification queue is silently processed alongside it.
2. The queue is unbounded and never drained by any consumer.
3. The notification is coupled to a contract — if 3 contracts each have pending milestones, a notification service must scan all `contracts.config` JSONB blobs to find pending approvals.

A `notifications` table should be created (via migration 0003 or later) with columns `(id, contract_id, milestone_id, recipient_id, event_type, created_at, read_at)` and the notification inserted there instead.

**Action required:** Create `app/models/notification.py`, migration, and insert a `Notification` row. This is the blocking blocker for any future notification delivery work (E4-T4).

---

### IMP-2 — `_queue_blockchain_completion` writes to `contract.config` instead of the `blockchain_events` table

**Location:** `milestone.py` lines 157–174

```python
config["blockchain_queue"] = queue
contract.config = config
```

The `blockchain_events` table already exists (created in E1-T3 migration) with the exact schema for this purpose:

```sql
blockchain_events (id UUID PK, contract_id UUID FK, event_type VARCHAR,
  transaction_hash VARCHAR, block_number BIGINT, event_data JSONB, created_at TIMESTAMPTZ)
```

A milestone completion should write a `BlockchainEvent` row with `event_type = "MILESTONE_COMPLETED"` and `event_data = {"milestone_id": ..., "milestone_ref": ...}`. The `transaction_hash` and `block_number` can be `NULL` until the event is actually submitted to the MSB in E5 (MSB Integration).

**Action required:** Replace `_queue_blockchain_completion` with a `BlockchainEvent` insert:

```python
from app.models.blockchain_event import BlockchainEvent

blockchain_event = BlockchainEvent(
    id=uuid.uuid4(),
    contract_id=contract.id,
    event_type="MILESTONE_COMPLETED",
    event_data={
        "milestone_id": str(milestone.id),
        "milestone_ref": milestone.milestone_ref,
    },
    created_at=now,
)
session.add(blockchain_event)
```

Note: `evaluate_submission` must receive the `session` reference to call `session.add()`. Currently the method signature is `(milestone_id, session, *, latest_update, now)` — `session` is already there. ✅

---

### MIN-1 — `evaluate_submission` does not guard against re-evaluating already-decided milestones

**Location:** `milestone.py` line 24 onwards

There is no status check at entry. Calling `evaluate_submission` on a milestone already in `COMPLETED` or `REJECTED` status will re-run the criteria and potentially flip the status. For example, if a `PRODUCTION_UPDATE` arrives after a milestone is `COMPLETED` and `evaluate_submission` is mistakenly triggered again, the milestone could flip to `REJECTED` based on newer production data.

**Recommended guard:**

```python
if milestone.status in ("COMPLETED", "REJECTED"):
    return milestone  # already decided, skip re-evaluation
```

---

### MIN-2 — `_get_latest_update` fallback fetches most recent update of any type

**Location:** `milestone.py` lines 53–64

```python
select(StatusUpdate)
    .where(StatusUpdate.contract_id == milestone.contract_id)
    .order_by(StatusUpdate.timestamp.desc())
    .limit(1)
```

The fallback (used when `latest_update` is `None`) returns the latest update regardless of type. If the most recent update is a `PHASE_CHANGE` or `PRODUCTION_UPDATE`, the auto-verification payload won't contain the milestone-relevant fields (`qualityPassRate`, `quantityProduced`, etc.), and `_passes_factor_criteria` will return `False` for missing fields.

The fallback should filter for `update_type = "MILESTONE_COMPLETE"` or at minimum be documented as requiring the caller to inject the correct `latest_update`. This only affects standalone/manual calls since the ingest path always injects the triggering update directly.

---

### MIN-3 — No unit test for Tasowheel auto-verification criteria

All 4 ticket test cases are present and pass. However, `_passes_tasowheel_criteria` is not exercised by any test. If it were accidentally broken (e.g. checking `stepStatus == "COMPLETED"` instead of `"COMPLETE"`), no test would catch it. A fifth test covering Tasowheel `COMPLETED` → `COMPLETED` and `IN_PROGRESS` → `REJECTED` would close this gap.

---

### MIN-4 — `_passes_factor_criteria` checks `quantityProduced >= quantityPlanned` — semantically strict for mid-production milestones

Factor has 4 milestones (Turning, Heat Treatment, Grinding, Inspection) representing production phases, not individual lot completion. Requiring `quantityProduced >= quantityPlanned` (12000 parts) before the "Turning" milestone can complete means the milestone can only pass after the full production run is done — which defeats the purpose of per-phase milestones.

This may be intentional (final sign-off milestone), but the same criteria apply to all 4 milestones, which seems overly strict for Turning/Heat Treatment. Worth discussing with the team before E2 is fully closed.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E2-T4 | ✅ **Approved** | IMP-1: add `notifications` model + insert; IMP-2: use `blockchain_events` table — fix both before E4/E5 work begins |

**Priority of fixes:**  
IMP-2 is a quick drop-in (model and `session.add` already in scope). IMP-1 requires a new `notifications` model and migration, which should be tracked as a mini-ticket if not already planned under E4-T4 (Notification Delivery).

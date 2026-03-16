# Review: E2 Carry-Forward Fixes

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ 5/6 fixes verified — 1 still outstanding (E2-T3 IMP-1), 1 test fixed

---

## Summary

| Issue | Was | Now | Result |
|---|---|---|---|
| E2-T2 IMP-1 — `public_id` column + index | JSONB full scan in 3 files | Dedicated column, centralized helper | ✅ Fixed |
| E2-T3 IMP-1 — Raise on unknown `milestone_ref` | Silent `return` | Silent `return` (unchanged) | ❌ Not fixed |
| E2-T3 IMP-2 — `QUALITY_EVENT` → `alerts` table | JSONB config array | `session.add(Alert(...))` | ✅ Fixed |
| E2-T4 IMP-1 — `notifications` model + table | JSONB config array | `session.add(Notification(...))` + DB table | ✅ Fixed |
| E2-T4 IMP-2 — Auto-verify → `BlockchainEvent` row | JSONB config write | `_queue_blockchain_completion` → `session.add(BlockchainEvent(...))` | ✅ Fixed |
| E2-T5 IMP-1 — Duplicate blockchain event on `approve_submission` | JSONB write + DB row | DB row only | ✅ Fixed |
| `test_models_metadata` test failure | Test expected 5 tables | `"notifications"` added to expected set | ✅ Fixed here |

---

## Fix-by-Fix Analysis

### ✅ E2-T2 IMP-1 — `contracts.public_id` column + unique index

**Migration `0003`:**
```sql
ALTER TABLE contracts ADD COLUMN public_id VARCHAR;
UPDATE contracts SET public_id = config->>'public_id' WHERE public_id IS NULL;
ALTER TABLE contracts ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX ix_contracts_public_id ON contracts (public_id);
```

**Model (`contract.py`):**
```python
public_id: Mapped[str | None] = mapped_column(String, index=True, unique=True)
```

**New central helper (`app/core/contracts.py`):**
- `contract_public_id(contract)` — falls back to JSONB for contracts without the column (safe for the migration window)
- `get_contract_by_public_id(session, contract_id)` — uses `Contract.public_id == contract_id` (indexed column)
- `select_contract_by_public_id(contract_id)` — returns composable `Select` for building queries with options

**All three callsites migrated:**
- `ingest.py` → `get_contract_by_public_id()` ✅
- `milestones.py` → `get_contract_by_public_id()` ✅
- `contracts.py` → `get_contract_by_public_id()` + `Contract.public_id.in_(...)` for list filter ✅

**Assessment:** Excellent. The shared helper avoids drift across callsites. The backfill-then-NOT NULL migration pattern is correct. The JSONB fallback in `contract_public_id()` is a safe bridge for data seeded before 0003.

---

### ❌ E2-T3 IMP-1 — Raise on missing or unknown `milestone_ref`

`monitoring.py` still silently returns in both cases:

```python
milestone_ref = payload.get("milestoneRef")
if not milestone_ref:
    return  # ← silent discard, still present

milestone = result.scalar_one_or_none()
if milestone is None:
    return  # ← silent discard, still present
```

A provider sending a `MILESTONE_COMPLETE` event with a bad `milestoneRef` gets a `200 OK` response with `processed: true`, but the milestone is never advanced. This is silent data corruption from the provider's perspective — they believe the milestone was registered but it wasn't.

**Required fix:**
```python
milestone_ref = payload.get("milestoneRef")
if not milestone_ref:
    raise ApiException(
        status_code=status.HTTP_400_BAD_REQUEST,
        code="MISSING_MILESTONE_REF",
        message="MILESTONE_COMPLETE update must include a milestoneRef.",
    )

milestone = result.scalar_one_or_none()
if milestone is None:
    raise ApiException(
        status_code=status.HTTP_400_BAD_REQUEST,
        code="MILESTONE_NOT_FOUND",
        message=f"No milestone with ref '{milestone_ref}' found in this contract.",
    )
```

Note: The `ApiException` needs to be importable in `monitoring.py` — add `from app.core.response import ApiException`.

---

### ✅ E2-T3 IMP-2 — `QUALITY_EVENT` written to `alerts` table

`monitoring.py` `_queue_quality_event` now creates an `Alert` row:
```python
session.add(
    Alert(
        contract_id=contract.id,
        rule_id="QUALITY_EVENT_PENDING",
        condition_description=json.dumps({
            "updateId": str(update.id),
            "sensorId": update.sensor_id,
            "payload": update.payload or {},
        }, sort_keys=True),
        severity="PENDING",
        triggered_at=now,
        blockchain_logged=False,
    )
)
```

**Assessment:** Correct direction. One minor note: `severity="PENDING"` is semantically odd — severity should be `LOW/MEDIUM/HIGH/CRITICAL`, not a processing state. A better model would be `severity="MEDIUM"` with a separate `status` field or `acknowledged_at IS NULL` to represent the "not yet reviewed" state. However, the current `_has_active_high_alert` check in the badge logic filters for `"HIGH"` or `"CRITICAL"`, so PENDING-severity alerts will not trigger `ACTION_REQUIRED`. This is actually the correct behavior for now (quality events need triage before becoming high alerts). The `rule_id="QUALITY_EVENT_PENDING"` gives consumers a programmatic way to filter these. Acceptable.

---

### ✅ E2-T4 IMP-1 — `notifications` model + table

**Migration `0003` creates the table** with: `id`, `contract_id` (FK), `milestone_id` (FK), `recipient_id`, `event_type`, `payload` (JSONB), `created_at`, `read_at`.

**Model (`notification.py`):** Properly mapped with relationships to `Contract` and `Milestone`.

**`Contract.notifications`** relationship added in `contract.py`. **`Milestone.notifications`** relationship added in `milestone.py`.

**`models/__init__.py`** exports `Notification` for Alembic discovery.

**`MilestoneService._queue_approval_notification`** and **`_queue_provider_rejection_notification`** both now call `session.add(Notification(...))`.

**Assessment:** Complete and well-structured. The `contract_public_id()` helper is used inside notification payloads for clean `contractId` fields.

---

### ✅ E2-T4 IMP-2 — Auto-verify `evaluate_submission` writes `BlockchainEvent` row

`evaluate_submission` now calls `_queue_blockchain_completion` when auto-verification passes:
```python
if verification_passed:
    MilestoneService._queue_blockchain_completion(session, contract, milestone, evaluation_time)
```

`_queue_blockchain_completion` does `session.add(BlockchainEvent(...))` — correct table, not JSONB config.

---

### ✅ E2-T5 IMP-1 — Duplicate blockchain event removed from `approve_submission`

`approve_submission` now contains only the direct `session.add(BlockchainEvent(...))` call. The old `_queue_blockchain_completion` JSONB write has been removed. No duplicate registration.

---

## Test Suite

**Before fix:** 53/54 passing — `test_models_metadata` failed because it expected 5 tables but `notifications` was added.  
**After fix (applied here):** 54/54 passing ✅

The test was updated to include `"notifications"` in the expected table set.

---

## Outstanding Item

| Issue | Priority | Action |
|---|---|---|
| E2-T3 IMP-1 — Raise on missing/unknown `milestone_ref` | 🔴 Required | Fix `monitoring.py` `_process_milestone_complete` to raise `ApiException` instead of silently returning |

This must be fixed before E3 goes to production. A provider can send malformed `MILESTONE_COMPLETE` events and receive `200 OK` with `processed: true`, while the milestone state is never updated.

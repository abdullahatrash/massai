# Review: E2-T2 (Ingest Endpoint — Core)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved with 1 required fix (IMP-1)

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/api/v1/ingest.py` | ✅ |
| `backend/app/schemas/ingest.py` | ✅ |
| `backend/app/models/status_update.py` | ✅ (updated — evidence column added) |
| `backend/migrations/versions/0002_add_evidence_to_status_updates.py` | ✅ |
| `backend/tests/integration/test_ingest_api.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `POST /api/v1/ingest/{contractId}` route exists | ✅ |
| Request envelope: `updateType` enum, `timestamp` ISO8601, `sensorId`, `payload`, `evidence` optional | ✅ |
| `UpdateType` enum: `PRODUCTION_UPDATE`, `MILESTONE_COMPLETE`, `PHASE_CHANGE`, `QUALITY_EVENT` | ✅ |
| Timestamp validator rejects timezone-naive values | ✅ |
| Contract 404 returned when `contractId` not found | ✅ |
| `payload` validated against pilot JSON schema — 422 on failure with field details | ✅ |
| `status_update` row saved to DB with all fields populated | ✅ |
| Response: `updateId`, `contractId`, `processed: true` inside standard envelope | ✅ |
| Auth: 401 if no token, 403 if missing `provider` role, 403 if no contract access | ✅ |
| Evidence serialised to `list[str]` before DB persist | ✅ |
| Migration 0002 adds `evidence JSONB DEFAULT '[]'` to `status_updates` | ✅ |
| Migration chain is correct (`down_revision = "0001_initial_schema"`) | ✅ |
| All 5 integration tests pass | ✅ |

---

## Issues

### IMP-1 — Contract lookup queries JSONB without an index (full table scan)

**Location:** `ingest.py` lines 25–27

```python
result = await session.execute(
    select(Contract).where(Contract.config["public_id"].as_string() == contract_id)
)
```

The `contractId` path parameter (e.g. `"contract-factor-001"`) is resolved by matching it against `contracts.config->>'public_id'` — a JSONB expression query. There is no index on this expression, so every ingest request triggers a full sequential scan of the `contracts` table. With tens of contracts this is imperceptible; under production load with hundreds of contracts and high ingest frequency it will become a bottleneck.

**Two options (pick one):**

**Option A — Add a functional expression index (minimal migration):**

```sql
-- migration 0003
CREATE UNIQUE INDEX ix_contracts_public_id
  ON contracts ((config->>'public_id'))
  WHERE config->>'public_id' IS NOT NULL;
```

**Option B — Add a dedicated top-level `public_id` column (recommended — cleaner design):**

```python
# models/contract.py
public_id: Mapped[str | None] = mapped_column(String, unique=True, index=True)
```

Then query via `Contract.public_id == contract_id`, which is a straightforward indexed lookup and removes the coupling between routing logic and the JSONB `config` column.

**Action required:** Add a migration (0003) before E2-T3 starts. Option B is cleaner and preferred.

---

### MIN-1 — `HTTP_422_STATUS` compatibility shim is dead code

**Location:** `ingest.py` lines 19–21

```python
HTTP_422_STATUS = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", None)
if HTTP_422_STATUS is None:
    HTTP_422_STATUS = status.HTTP_422_UNPROCESSABLE_ENTITY
```

`HTTP_422_UNPROCESSABLE_CONTENT` does not exist in Starlette/FastAPI — `getattr` always returns `None` and the code always falls back to `HTTP_422_UNPROCESSABLE_ENTITY`. The shim adds cognitive noise with no benefit. Replace with:

```python
from fastapi import status
# Use directly:
status.HTTP_422_UNPROCESSABLE_ENTITY
```

**Action:** Low priority, clean up when convenient.

---

### MIN-2 — Test coverage gap: Tasowheel and E4M valid payloads not tested

Ticket test step 6 says: *"Test all 3 pilot types accept their respective valid payloads."* The integration tests only cover `FACTOR`. There is no test verifying that a valid Tasowheel or E4M payload routes through the schema validator correctly. If `_get_contract` or `validate(pilot_type, ...)` were accidentally broken for those pilot types, it would go undetected.

**Action:** Add two more test cases (TASOWHEEL and E4M valid payloads) before closing E2. Can be added to `test_ingest_api.py` as a quick parameterised extension.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E2-T2 | ✅ **Approved** | IMP-1 must be fixed (add index or `public_id` column) before E2-T3; MIN-1 and MIN-2 lower priority |

**Recommended next step:** Add migration 0003 (Option B: `public_id` column + `unique=True` index on `contracts`) before building E2-T3, since MonitoringService will also need to look up contracts by their public identifier.

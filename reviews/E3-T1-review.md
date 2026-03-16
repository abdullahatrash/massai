# Review: E3-T1 (Contract List & Overview Endpoints)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved — no blocking issues, 5 minor findings

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/api/v1/contracts.py` | ✅ |
| `backend/app/schemas/contract.py` | ✅ |
| `backend/app/api/v1/router.py` | ✅ (contracts router registered) |
| `backend/tests/integration/test_contracts_api.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `GET /api/v1/contracts` — paginated list with all required fields | ✅ |
| `GET /api/v1/contracts/{id}` — overview with `lastKnownState`, `nextMilestone` | ✅ |
| Pagination in `meta.pagination` with `page`, `pageSize`, `hasMore` | ✅ |
| `pageSize + 1` trick for efficient `hasMore` detection | ✅ |
| `selectinload` for milestones and alerts — avoids N+1 queries | ✅ |
| Status badge: `ON_TRACK`, `DELAYED`, `ACTION_REQUIRED`, `COMPLETED`, `DISPUTED` | ✅ |
| `ACTION_REQUIRED` fires on: SUBMITTED+approval_required milestone OR unresolved HIGH/CRITICAL alert | ✅ |
| `DELAYED` fires when any non-COMPLETED milestone is past `planned_date` | ✅ |
| `COMPLETED` when all milestones are COMPLETED or contract status = COMPLETED | ✅ |
| `nextMilestone`: earliest non-COMPLETED milestone with `daysRemaining` | ✅ |
| No `blockchain_contract_address` or blockchain terms in any response | ✅ |
| Admin gets all contracts; consumer filtered to their `contract_ids` JWT claim | ✅ |
| Consumer access double-checked via `_assert_contract_access` on single contract | ✅ |
| 404 returned for unknown contract | ✅ |
| `contracts_router` registered in `router.py` | ✅ |
| 4/4 integration tests pass | ✅ |

---

## Issues

### MIN-1 — Third file duplicating the `contract.config["public_id"]` JSONB lookup

**Location:** `contracts.py` lines 161 and 192

```python
# single contract lookup:
.where(Contract.config["public_id"].as_string() == contract_id)

# list filter for consumer:
.where(Contract.config["public_id"].as_string().in_(list(current_user.contract_ids)))
```

`ingest.py`, `milestones.py`, and now `contracts.py` all contain the same JSONB expression query with no index. The `GET /api/v1/contracts` endpoint is the most frequently called endpoint in the system (every dashboard page load), making this the highest-traffic unindexed query. The E2-T2 IMP-1 fix (`contracts.public_id` column + index) is now overdue — this is the third occurrence and will worsen in E3 as more read endpoints are added.

**Action:** Fix E2-T2 IMP-1 before E3-T2 adds more read endpoints.

---

### MIN-2 — `_next_milestone` includes `REJECTED` milestones as "upcoming"

**Location:** `contracts.py` lines 103–116

```python
pending_milestones = [
    milestone
    for milestone in milestones
    if (milestone.status or "").upper() != "COMPLETED" and milestone.planned_date is not None
]
```

A `REJECTED` milestone (consumer refused it) still appears as the `nextMilestone` in the overview. The consumer would see a milestone they already rejected listed as the next thing coming up, which is semantically incorrect. The filter should exclude at minimum `REJECTED` status.

**Recommended fix:**

```python
TERMINAL_STATUSES = {"COMPLETED", "REJECTED"}
pending_milestones = [
    milestone
    for milestone in milestones
    if (milestone.status or "").upper() not in TERMINAL_STATUSES
    and milestone.planned_date is not None
]
```

---

### MIN-3 — Status badge tests cover only 3 of 5 states

The test suite covers `ON_TRACK`, `ACTION_REQUIRED` (via both alert and approval paths). Missing:

| State | Test coverage |
|---|---|
| `ON_TRACK` | ✅ |
| `ACTION_REQUIRED` (approval) | ✅ (e4m — SUBMITTED milestone with approval_required) |
| `ACTION_REQUIRED` (HIGH alert) | ✅ (tasowheel — alert_severities=["HIGH"]) |
| `DELAYED` | ❌ missing |
| `COMPLETED` | ❌ missing |
| `DISPUTED` | ❌ missing |

A contract with an overdue pending milestone (and no action_required condition) should return `DELAYED` — not covered. Worth adding these cases to `test_contracts_api.py`.

---

### MIN-4 — `DISPUTED` badge triggers on any `REJECTED` milestone, not just contract-level disputes

**Location:** `contracts.py` lines 83–86

```python
if contract_status == "DISPUTED" or any(
    (milestone.status or "").upper() == "REJECTED" for milestone in milestones
):
    return "DISPUTED"
```

A consumer legitimately rejecting a milestone (e.g. "evidence incomplete, please resubmit") is a normal workflow step — not a dispute. Labelling the contract as `DISPUTED` in the consumer's dashboard after every rejection may cause false alarm. `DISPUTED` should arguably only trigger when `contract.status == "DISPUTED"`, with a separate visual indicator for rejected milestones.

**Action:** Discuss with product. If `REJECTED` should not trigger `DISPUTED`, change to:
```python
if contract_status == "DISPUTED":
    return "DISPUTED"
```

---

### MIN-5 — `ACTION_REQUIRED` (HIGH alert path) is currently dormant

`_has_active_high_alert` correctly reads from `contract.alerts`. However, since E2-T3 IMP-2 (`QUALITY_EVENT` → `alerts` table) has not been fixed, no alert rows are ever written. The badge logic is correct but the HIGH-alert-triggered `ACTION_REQUIRED` path will never fire until E2-T3 IMP-2 is resolved. Not a code bug but a system-level gap worth tracking.

---

### MIN-6 — `FakeSession.execute` continues to introspect SQLAlchemy compiled parameter names

**Location:** `test_contracts_api.py` lines 58–98

```python
params = statement.compile().params
if "id_1" in params:
    ...
if "milestone_ref_1" in params:
    ...
```

This is the same brittle pattern from `test_milestones_api.py`. The compiled parameter names `id_1`, `milestone_ref_1`, `param_1` are SQLAlchemy implementation details. To the test author's credit, the `FakeSession` here is more sophisticated (handles both list and single-value `IN` filters, pagination slicing), but the approach remains fragile. Low priority but worth noting as technical debt in the test layer.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E3-T1 | ✅ **Approved** | No blocking issues — MIN-2 (rejected milestones in nextMilestone) is the most impactful fix |

**The implementation quality is notably high** — `selectinload` for eager loading, correct pagination pattern, clean badge logic, proper consumer/admin access separation, no blockchain data leakage. The core design is solid.

**Carry-forward:** Fix E2-T2 IMP-1 (`public_id` column) before E3-T2 adds more JSONB-based lookups.

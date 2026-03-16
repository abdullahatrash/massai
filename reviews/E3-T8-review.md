# E3-T8 Review — Admin Contract Onboarding + Blockchain Sync

**Date:** 2026-03-16  
**Ticket:** E3-T8: Admin Contract Onboarding + Blockchain Sync  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — 2 required fixes applied, 4 minor findings

---

## Summary

All three admin endpoints are implemented correctly. The `BlockchainService` Protocol,
mock adapter with three pilot fixtures, `ContractOnboardingService` with address
validation, duplicate-check, metadata-to-DB mapping, and milestone seeding all match
the ticket spec. All 7 integration tests pass and the full suite is green (91/91).

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `POST /admin/contracts` — create from blockchain address | ✅ |
| 2 | Requires `admin` role | ✅ |
| 3 | Address format validation (`0x` + 40 hex chars) | ✅ |
| 4 | Call `BlockchainService.get_contract_metadata(address)` | ✅ |
| 5 | Mock adapter returns fixture data for known addresses | ✅ |
| 6 | Create `contracts` row from blockchain metadata | ✅ |
| 7 | Create `milestones` rows from schedule | ✅ |
| 8 | Store `alertConditions` from blockchain metadata | ✅ (stored in `config["alert_conditions"]`) |
| 9 | Return created contract with DB id | ✅ |
| 10 | `GET /admin/contracts` — list all (admin only) | ✅ |
| 11 | `GET /admin/contracts/{id}/blockchain-sync` — re-sync state | ✅ |
| 12 | Files: `admin.py`, `schemas/admin.py`, `services/contract_onboarding.py` | ✅ |
| 13 | `blockchain.py` Protocol updated with `get_contract_metadata` | ✅ |
| 14 | `blockchain_mock.py` returns fixture metadata for known addresses | ✅ |
| 15 | Duplicate address → 409 `CONTRACT_ALREADY_EXISTS` | ✅ |
| 16 | Invalid address → 400 `INVALID_BLOCKCHAIN_ADDRESS` | ✅ |
| 17 | Non-admin → 403 `FORBIDDEN` | ✅ |
| 18 | Blockchain-sync refreshes `status` | ✅ |
| 19 | Router registered in `router.py` | ✅ (confirmed) |

**Test results:** 7/7 passed

---

## Findings

### IMP-1 — `ApiException` imported inside function body (applied)

`sync_contract` in `admin.py` imported `ApiException` inside the `if contract is None`
branch instead of at the module top level:

```python
# before
if contract is None:
    from app.core.response import ApiException   # ← deferred import
    raise ApiException(...)
```

**Fix applied:** `ApiException` added to the module-level imports; deferred import removed.

### IMP-2 — No index or unique constraint on `blockchain_contract_address` (applied)

`Contract.blockchain_contract_address` is a plain `String` column with no index and no
uniqueness constraint. `_get_contract_by_address` issues a full table scan on every
`POST /admin/contracts` call, and there is no DB-level guard against duplicate
registrations from concurrent requests (TOCTOU race condition with the
application-level check).

**Fix applied:** Migration `0004_add_blockchain_address_unique_index.py` created —
adds a partial unique index `ix_contracts_blockchain_contract_address` (unique where
`NOT NULL`) so the DB enforces uniqueness and the duplicate-check query uses an index.

### MIN-1 — `pilot_type` request field accepts any string

`CreateAdminContractRequest.pilot_type` is `str`. An admin submitting a typo (e.g.,
`"FACTORR"`) receives `PILOT_TYPE_MISMATCH` rather than a Pydantic validation error.
Should be validated as `Literal["FACTOR", "TASOWHEEL", "E4M"]` (or an `Enum`) so
malformed values are rejected at the request-parsing layer with a clear 422.

### MIN-2 — No test for `PILOT_TYPE_MISMATCH`

No test case where admin submits a valid address with the wrong `pilotType` (e.g.,
`"TASOWHEEL"` for a FACTOR contract). The 400 `PILOT_TYPE_MISMATCH` code path is
untested.

### MIN-3 — `alert_conditions` stored but not enforced

`alertConditions` from blockchain metadata are written to `contract.config` as a
Python list. The Alert & Rule Engine (E4) is expected to consume these. There is no
runtime alert rule evaluation wired up from onboarding — this is by design (E4 is
a separate EPIC), but worth documenting so the E4 implementer knows to read
`config["alert_conditions"]` to seed the rule table.

### MIN-4 — `FakeSession` is the most complex fake to date

`FakeSession` in `test_admin_onboarding.py` (185 lines) implements `execute`,
`add`, `flush`, `commit`, `get` with statement-text matching. This is the fourth
distinct `FakeSession` implementation across test files. The growing complexity
should be consolidated (shared test helpers in `tests/helpers/`) as a follow-up task.

---

## Applied Fixes Summary

| Fix | File(s) | Description |
|-----|---------|-------------|
| IMP-1 | `backend/app/api/v1/admin.py` | Moved `ApiException` import to module level |
| IMP-2 | `backend/migrations/versions/0004_add_blockchain_address_unique_index.py` | Partial unique index on `blockchain_contract_address` |

Full suite: **91 passed, 0 failed**.

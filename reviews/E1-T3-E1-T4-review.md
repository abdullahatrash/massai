# Review: E1-T3 (Database Schema + Migrations) & E1-T4 (Seed Data)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ E1-T3 Approved · ✅ E1-T4 Approved with 1 required fix (applied)

---

## E1-T3: Database Schema + Migrations

### Files Reviewed

| File | Status |
|---|---|
| `backend/alembic.ini` | ✅ |
| `backend/migrations/env.py` | ✅ |
| `backend/migrations/versions/0001_initial_schema.py` | ✅ |
| `backend/app/models/base.py` | ✅ |
| `backend/app/models/contract.py` | ✅ |
| `backend/app/models/milestone.py` | ✅ |
| `backend/app/models/status_update.py` | ✅ |
| `backend/app/models/alert.py` | ✅ |
| `backend/app/models/blockchain_event.py` | ✅ |
| `backend/app/models/__init__.py` | ✅ |
| `backend/tests/unit/test_models_metadata.py` | ✅ |

### Criteria Checklist

| Criterion | Result |
|---|---|
| All 5 tables defined: `contracts`, `milestones`, `status_updates`, `alerts`, `blockchain_events` | ✅ |
| All tables use UUID primary keys | ✅ |
| `contracts.config` is `JSONB` | ✅ |
| `milestones.evidence` is `JSONB DEFAULT '[]'::jsonb` | ✅ |
| `alerts.blockchain_logged` boolean defaults to `false` | ✅ |
| Migration creates tables in correct order (parent → child) | ✅ |
| `downgrade()` drops tables in reverse order | ✅ |
| FK constraints follow `base.py` naming convention | ✅ |
| `env.py` uses async migrations (`async_engine_from_config`) | ✅ |
| `app/models/__init__.py` imports all 5 models (Alembic autogenerate dependency) | ✅ |
| `compare_type=True` in both online and offline modes | ✅ |
| Unit test: all 5 tables registered, defaults verified | ✅ (3/3 passing) |

### Issues

#### MIN-1 — `alembic.ini` has a redundant hardcoded `sqlalchemy.url`

`alembic.ini` line 4 contains:
```
sqlalchemy.url = postgresql+asyncpg://massai:massai@postgres:5432/massai_monitoring
```

`env.py` already overrides this unconditionally with `config.set_main_option("sqlalchemy.url", settings.database_url)` before any migration runs. The hardcoded value in `.ini` is **never used** but could confuse a developer who edits it expecting it to take effect. It also duplicates the default from `config.py`.

**Action:** Low priority — can be cleaned up in a later pass. No behaviour change.

---

## E1-T4: Seed Data (3 Pilot Contracts)

### Files Reviewed

| File | Status |
|---|---|
| `backend/app/seeds/seed.py` | ✅ |
| `backend/app/seeds/data/factor_contract.json` | ✅ |
| `backend/app/seeds/data/tasowheel_contract.json` | ✅ |
| `backend/app/seeds/data/e4m_contract.json` | ✅ (after fix) |
| `backend/tests/unit/test_seed_data.py` | ✅ |

### Criteria Checklist

| Criterion | Result |
|---|---|
| 3 seed files exist, one per pilot | ✅ |
| 14 milestones total (4 + 4 + 6) | ✅ |
| Factor: 4 milestones (Turning, Heat Treatment, Grinding, Inspection) | ✅ |
| Tasowheel: 4 milestones matching routing steps (STEP_10–STEP_40) | ✅ |
| E4M: 6 milestones (M1–M6), M2/M3/M5/M6 `approval_required: true` | ✅ |
| Seed is idempotent — uses deterministic UUID5 + upsert pattern | ✅ |
| Unit test: 3 contracts, 14 milestones, correct approval refs | ✅ (2/2 passing) |

### Issues

#### ~~IMP-1~~ (FIXED) — E4M `blockchain_contract_address` was invalid hex

**Original value:**
```json
"blockchain_contract_address": "0xE4M0000000000000000000000000000000000001"
```
The character `M` is not a valid hex digit. When the real MSB integration (E5) calls `web3.py` with this address, it will throw `ValueError: Invalid EIP-55 encoded address` and break the entire ingest pipeline for the E4M pilot.

**Fix applied (`e4m_contract.json`):**
```json
"blockchain_contract_address": "0xE400000000000000000000000000000000000E4"
```
Replaced with a valid 42-character hex address. All tests still pass (3/3).

---

#### MIN-1 — `expected_e4m_approval_refs()` is a test-support function in production code

`seed.py` contains `expected_e4m_approval_refs()`, which is only ever called from `test_seed_data.py`. Test-support helpers should live in the test layer, not in `seeds/seed.py`.

**Action:** Move to `tests/unit/test_seed_data.py` when convenient. Not urgent.

---

#### MIN-2 — `_upsert_contract` opens a separate DB session per contract

Each of the 3 seed contracts gets its own `async with SessionLocal()` context, meaning 3 separate DB connections are opened serially. For a seed script this is harmless, but a single session wrapping all inserts would be more efficient and transactional (all-or-nothing).

**Action:** Low priority quality improvement for a later pass.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E1-T3 | ✅ **Approved** | MIN-1 cosmetic only, no blocking issues |
| E1-T4 | ✅ **Approved** | IMP-1 already fixed in this review |

Both tickets can be marked **✅ Closed**. No outstanding required fixes remain.

# Review: E2-T6 (Background Simulators) & E2-T7 (Pilot Extensibility)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ E2-T6 Approved · ✅ E2-T7 Approved — no blocking issues in either ticket

---

## E2-T6: Python Background Simulators

### Files Reviewed

| File | Status |
|---|---|
| `mock-sensors/base_simulator.py` | ✅ |
| `mock-sensors/factor_simulator.py` | ✅ |
| `mock-sensors/tasowheel_simulator.py` | ✅ |
| `mock-sensors/e4m_simulator.py` | ✅ |
| `mock-sensors/pyproject.toml` | ✅ |
| `mock-sensors/Dockerfile` | ✅ |
| `mock-sensors/scenarios/*.json` (13 files) | ✅ |
| `mock-sensors/tests/test_base_simulator.py` | ✅ |

### Criteria Checklist

| Criterion | Result |
|---|---|
| `base_simulator.py` with `ServiceAccountTokenProvider`, `ScenarioPlayer`, `run_simulator` | ✅ |
| Auth via Keycloak client credentials, token cached until refresh window | ✅ |
| `ScenarioPlayer` merges `initialPayload` + incremental step deltas (stateful accumulation) | ✅ |
| Scenario steps cycle when loop runs past the end | ✅ |
| `STOP_AFTER_STEPS` env var exits cleanly after N pushes | ✅ |
| `HTTPError`, `URLError`, and generic `Exception` all caught — simulator never crashes | ✅ |
| Log format: `[FACTOR] Step 3/8 - pushed PRODUCTION_UPDATE → 200 OK, alerts: []` | ✅ |
| `factor_simulator.py`, `tasowheel_simulator.py`, `e4m_simulator.py` each call `run_simulator("name")` | ✅ |
| Dockerfile CMD default `factor_simulator.py` overridden per service in `docker-compose.dev.yml` | ✅ |
| All 3 Docker Compose services (`mock-factor`, `mock-tasowheel`, `mock-e4m`) defined with per-pilot cmd, env, scenario vars | ✅ |
| `SCENARIO` configurable per-pilot via `FACTOR_SCENARIO` / `TASOWHEEL_SCENARIO` / `E4M_SCENARIO` env | ✅ |
| Scenario files: `factor_normal`, `factor_delay`, `factor_quality_failure`, `factor_milestone_complete`, `factor_dispute` | ✅ |
| Scenario files: `tasowheel_normal`, `tasowheel_downtime`, `tasowheel_milestone_complete`, `tasowheel_dispute` | ✅ |
| Scenario files: `e4m_normal`, `e4m_test_failure`, `e4m_milestone_complete`, `e4m_delay`, `e4m_dispute` | ✅ |
| All 6 mock-sensors unit tests pass | ✅ |

### Issues

#### MIN-1 — `pyproject.toml` has no dev dependencies — tests cannot run with `uv run pytest`

`mock-sensors/pyproject.toml` declares `dependencies = []` and no dev dependencies. The tests are pure `unittest` and run correctly with `python3 -m unittest discover -s tests`. However, `pytest` is not available in the mock-sensors uv environment, so `uv run pytest tests/` would fail.

This is intentional (stdlib-only, zero deps), but it creates an inconsistency with the backend test workflow (`uv run pytest`). The `README` or `docker-compose.dev.yml` comments should document how to run the mock-sensor tests.

**Action:** Document test invocation: `python3 -m unittest discover -s tests` in the project README or a comment in `pyproject.toml`.

---

#### MIN-2 — `factor_milestone_complete.json` uses `milestone_ref` (snake_case) in the scenario payload

**Location:** `scenarios/factor_milestone_complete.json` line 16

```json
"milestone_ref": "TURNING"
```

This is the E2-T1 MIN-2 carry-forward: the scenario uses `milestone_ref` (snake_case), which works now because `monitoring.py` reads both `milestone_ref` and `milestoneRef`. When the dual-key ambiguity is resolved (one canonical name agreed), all scenario files using the dropped key will need updating.

**Action:** Resolve when E2-T1 MIN-2 is addressed.

---

#### MIN-3 — Dockerfile does not pin the Python patch version

```dockerfile
FROM python:3.12-slim
```

`backend/.python-version` pins `3.12.8`. The Dockerfile should match for reproducibility:

```dockerfile
FROM python:3.12.8-slim
```

Minor risk since 3.12.x patch releases are backward-compatible, but the discrepancy could cause subtle environment drift.

---

#### MIN-4 — `run_simulator` main loop is not covered by any unit test

The `STOP_AFTER_STEPS` behavior and retry-on-error loop are tested indirectly (config parsing is tested, error types are exercised in isolation) but the full `run_simulator` function is not tested end-to-end with mock HTTP calls. If the `push_count >= config.stop_after_steps` condition were accidentally inverted, no test would catch it.

**Action:** Low priority — acceptable for a background simulator. Consider adding one integration smoke-test in a future hardening pass.

---

## E2-T7: Pilot Extensibility Validation

### Files Reviewed

| File | Status |
|---|---|
| `backend/app/pilot_schemas/pilot_test_update.json` | ✅ |
| `backend/tests/integration/test_pilot_extensibility.py` | ✅ |

### Criteria Checklist

| Criterion | Result |
|---|---|
| `pilot_test_update.json` with `testValue: integer`, `testLabel: string, minLength:1` | ✅ |
| `additionalProperties: false` on the test schema | ✅ |
| Test: valid `PILOT_TEST` payload → HTTP 200 | ✅ |
| Test: missing `testLabel` (required field) → HTTP 422, `field: "payload.testLabel"` in details | ✅ |
| Test: no schema file → HTTP 400 `SCHEMA_NOT_FOUND` (not a crash) | ✅ |
| `lru_cache` cleared in `setUp`/`tearDown` — test isolation correct | ✅ |
| `flush_called` and `commit_called` verified — DB write path exercised | ✅ |
| No changes to `ingest.py`, `monitoring.py`, or any backend service file | ✅ |
| All 3 extensibility tests pass, full backend suite 50/50 | ✅ |

### Issues

#### MIN-1 — Ticket step "confirm no backend Python files modified" is manual only

The ticket requires verifying `git diff --name-only` shows only the new files. This is a valid architectural proof but is a manual check, not an automated assertion. The tests prove the extensibility property (new pilot works without code changes) but do not programmatically assert that no Python files were touched.

**Action:** Acceptable as-is. The architecture proof is demonstrated by the test passing without any service code modification. No action needed.

---

#### MIN-2 — No test for wrong-type payload (`testValue: "not-an-integer"`)

The 422 test covers a missing required field. There is no test for a type mismatch (e.g. `testValue: "hello"`), which would also return 422 via the schema validator.

**Action:** Low priority — existing test is sufficient to prove extensibility.

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E2-T6 | ✅ **Approved** | MIN-1–MIN-4 are cosmetic/documentation; no blocking issues |
| E2-T7 | ✅ **Approved** | No required actions |

**EPIC E2 is now fully reviewed.** All 7 tickets are closed. 50/50 backend tests pass, 6/6 mock-sensor tests pass.

---

## EPIC E2 Carry-Forward Summary (open items before E3/E4/E5)

| ID | Source | Item |
|---|---|---|
| E2-T2 IMP-1 | `ingest.py`, `milestones.py` | Add `contracts.public_id` column + unique index (migration 0003) |
| E2-T3 IMP-1 | `monitoring.py` | Raise on missing/unknown `milestone_ref` in `MILESTONE_COMPLETE` |
| E2-T3 IMP-2 | `monitoring.py` | `QUALITY_EVENT` → write to `alerts` table, not JSONB config |
| E2-T4 IMP-1 | `milestone.py` | Create `notifications` model + migration |
| E2-T4 IMP-2 | `milestone.py` | `evaluate_submission` auto-verify → write `BlockchainEvent` row |
| E2-T5 IMP-1 | `milestone.py` | Remove duplicate `_queue_blockchain_completion` from `approve_submission` |
| E2-T1 MIN-2 | All schemas + simulators | Standardise `milestoneRef` vs `milestone_ref` to one camelCase key |

# Review: E3-T4 (Analytics Endpoint)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved — no blocking issues, 5 minor findings

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/api/v1/analytics.py` (new) | ✅ |
| `backend/app/services/analytics.py` (new) | ✅ |
| `backend/app/schemas/analytics.py` (new) | ✅ |
| `backend/app/api/v1/router.py` | ✅ (analytics router registered) |
| `backend/tests/integration/test_analytics_api.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `GET /api/v1/contracts/{id}/analytics` — pilot-adaptive KPI object | ✅ |
| Factor: `automatedUpdatesPct`, `qualityPassRateAvg`, `scheduleAdherence` | ✅ |
| Tasowheel: `totalDowntimeMinutes`, `avgCycleTimeEfficiency`, `totalEnergyKwh`, `totalCarbonKgCo2e`, `resourceUtilisationPct` | ✅ |
| E4M: `phasesCompleted`, `avgPhaseCompletionDays`, `testPassRate`, `openIssueCount` | ✅ |
| All pilots: `overallProgress`, `daysUntilDelivery`, `isOnTrack` | ✅ |
| `exclude_none=True` — pilot-specific fields absent for other pilot types | ✅ |
| `selectinload` for milestones, status_updates, alerts | ✅ |
| `analytics_router` registered in `router.py` | ✅ |
| `qualityPassRateAvg` is average of all 5 Factor updates (0.96) | ✅ |
| `testPassRate` is 66.67% (2/3 PASS) for E4M | ✅ |
| `isOnTrack: false` for E4M contract with open HIGH alert | ✅ |
| 3/3 integration tests pass | ✅ |

---

## Design Highlights

**`AnalyticsService` is the most complex service in the project and is well-structured:**

- Pilot dispatch via `if/elif` is clean and mirrors the schema's optional fields pattern.
- `model_dump(by_alias=True, exclude_none=True)` elegantly handles the pilot-adaptive response — non-applicable fields are simply absent, not `null`.
- `_round()` helper ensures consistent 2-decimal precision across all float metrics.
- `_is_on_track` is consistent with the badge logic in `contracts.py`: checks `DISPUTED` → approval pending → high alert → overdue milestone.
- `automatedUpdatesPct` is capped at `100.0` (`min(..., 100.0)`) — correct behaviour when updates exceed the expected count.
- `openIssueCount` checks `last_known_state.issues` first (freshest), then falls back to most recent update payload — a sensible two-level lookup.

---

## Issues

### MIN-1 — `_factor_metrics` `due_milestones` filter has no parentheses around the `or` clause

**Location:** `analytics.py` lines 138–143

```python
due_milestones = [
    milestone
    for milestone in milestones
    if milestone.planned_date is not None and milestone.planned_date <= today
    or (milestone.status or "").upper() == "COMPLETED"
]
```

Python operator precedence makes `and` bind tighter than `or`, so this evaluates correctly as:
```
(planned_date is not None AND planned_date <= today) OR (status == "COMPLETED")
```

The logic is correct but the formatting makes it look like the whole `if` condition might be one chain. The parentheses should be made explicit to protect against future misedits:
```python
    if (milestone.planned_date is not None and milestone.planned_date <= today)
    or (milestone.status or "").upper() == "COMPLETED"
```

Additionally: a milestone with `status = "COMPLETED"` but `planned_date = None` would be included in `due_milestones` but excluded from `on_time_milestones` (which requires `planned_date is not None`). This inflates the denominator of `scheduleAdherence` for milestones that have no schedule to adhere to. Edge case in current seed data (all milestones have planned dates), but worth noting.

---

### MIN-2 — Zero fallback for absent float metrics is misleading

**Location:** `analytics.py` lines 159, 207–208, 256–258

```python
"qualityPassRateAvg": AnalyticsService._round(
    sum(quality_values) / len(quality_values) if quality_values else 0.0
),
"avgCycleTimeEfficiency": AnalyticsService._round(
    sum(cycle_efficiencies) / len(cycle_efficiencies) if cycle_efficiencies else 0.0
),
"avgPhaseCompletionDays": AnalyticsService._round(
    sum(completion_days) / len(completion_days) if completion_days else 0.0
),
```

When there are no quality updates, no cycle readings, or no completed milestones, these metrics return `0.0`. Since `_round(0.0)` returns `0.0` (not `None`), and `model_dump(exclude_none=True)` only drops `None` values, `qualityPassRateAvg: 0.0` appears in the consumer dashboard — looking like a catastrophic 0% quality rate rather than "no data yet".

**Recommended fix:** return `None` for "no data":
```python
"qualityPassRateAvg": AnalyticsService._round(
    sum(quality_values) / len(quality_values) if quality_values else None
),
```
With `exclude_none=True`, the field disappears from the response when there's no data, which is the correct UX signal.

---

### MIN-3 — `selectinload(Contract.status_updates)` loads the full update history

**Location:** `analytics.py` lines 41–43

```python
options=(
    selectinload(Contract.milestones),
    selectinload(Contract.status_updates),  # entire history
    selectinload(Contract.alerts),
),
```

For a Factor contract running for 90 days with one update per shift (3/day), that's ~270 rows loaded for every analytics request. For the three-pilot MVP this is fine. But as the project scales, the analytics endpoint should move to DB-level aggregation (e.g. `SELECT AVG(payload->>'qualityPassRate')`) rather than full history in-memory. Flag for post-MVP refactor.

---

### MIN-4 — `_assert_contract_access` is now in five files

`contracts.py`, `milestones.py`, `timeline.py`, `alerts.py`, and `analytics.py` all define identical local helpers. The E3-T2 MIN-1 and E3-T3 MIN-1 recommendations to centralise in `app/core/contracts.py` are now overdue.

---

### MIN-5 — No test for 404 when contract does not exist

The test file has no case for `GET /api/v1/contracts/nonexistent/analytics → 404`. All other endpoint test suites include this case. Add:
```python
def test_analytics_returns_404_for_unknown_contract(self) -> None:
    client = TestClient(self.app)
    response = client.get("/api/v1/contracts/nonexistent/analytics")
    self.assertEqual(response.status_code, 404)
    self.assertEqual(response.json()["error"]["code"], "CONTRACT_NOT_FOUND")
```

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E3-T4 | ✅ **Approved** | No blocking issues — MIN-2 (zero fallback for absent metrics) is the most impactful fix |

**The `AnalyticsService` is the most technically sophisticated service in the codebase** — multi-pilot metric computation, graceful handling of missing data, correct `isOnTrack` logic, and the `exclude_none` pattern for a clean pilot-adaptive API response. Solid implementation.

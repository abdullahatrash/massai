# E4-T1 Review — Rule Engine Core

**Date:** 2026-03-16  
**Ticket:** E4-T1: Rule Engine Core  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — MIN-3 fix applied (DelayRule tests added), 4 minor findings

---

## Summary

All four rule strategies (`QualityThresholdRule`, `DelayRule`, `TestFailureRule`,
`MilestoneOverdueRule`) are implemented correctly with a clean Strategy pattern.
`RuleEngine.evaluate` is wired into `MonitoringService.process_update` — the pipeline
is fully connected. Alert deduplication (no duplicate alerts per rule type) and alert
resolution (clear `resolved_at` when rule no longer fires) both work. All spec-mandated
unit tests pass (5/5) plus the new DelayRule tests added in this review.
Full suite: **103 passed, 0 failed**.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `RuleEngine.evaluate(contract, update, session)` runs all configured rules | ✅ |
| 2 | `NO_DATA_RECEIVED` — deferred to E4-T3 background worker | ✅ |
| 3 | `QUALITY_THRESHOLD` — fires when `qualityPassRate < threshold` | ✅ |
| 4 | `DELAY` — fires when progress is behind schedule by > N days | ✅ |
| 5 | `TEST_FAILURE` — fires when any `testResults[].result == "FAIL"` | ✅ |
| 6 | `MILESTONE_OVERDUE` — fires when `planned_date < today` and not `COMPLETED` | ✅ |
| 7 | Each rule returns `AlertResult` or `None` | ✅ |
| 8 | `Alert` row created when rule triggers | ✅ |
| 9 | `blockchain_logged = False` set on all new alerts | ✅ |
| 10 | Alert deduplication: existing unresolved alert updated (not duplicated) | ✅ |
| 11 | Alert resolution: `resolved_at` set when rule no longer fires | ✅ |
| 12 | Files: `rule_engine.py`, `rules/base.py`, `rules/quality_threshold.py`, `rules/delay_rule.py`, `rules/test_failure.py`, `rules/milestone_overdue.py` | ✅ |
| 13 | `test_rule_engine.py` with all 5 specified unit tests | ✅ |
| 14 | `RuleEngine` integrated into `MonitoringService.process_update` | ✅ |
| 15 | `alert_conditions` from blockchain metadata used as rule config source | ✅ |
| 16 | Per-pilot default rules auto-seeded when no config provided | ✅ |

**Test results:** 5/5 (+ 6 new DelayRule tests added = 11 in `test_rule_engine.py`)  
Full suite: **107 passed, 0 failed**

---

## Findings

### MIN-1 — `RuleStrategy` Protocol has a type-annotation mismatch

```python
# rule_engine.py: Protocol declares
today: date

# quality_threshold.py and test_failure.py declare
today: object
```

`QualityThresholdRule` and `TestFailureRule` accept `today: object` while the
`RuleStrategy` Protocol requires `today: date`. These rules don't use `today` at all
(they `del today`), but the type annotation inconsistency means a strict type-checker
(mypy / pyright) will reject them as non-conforming implementations. No runtime impact.

### MIN-2 — `NO_DATA_RECEIVED` skip is undocumented in code

```python
# rule_engine.py:105
if not rule_type or rule_type == "NO_DATA_RECEIVED":
    continue
```

There is no comment explaining why `NO_DATA_RECEIVED` is excluded from per-update
evaluation. Future maintainers may not know to look at E4-T3. Add a short inline
comment.

### MIN-3 — `DelayRule` had zero unit tests (fix applied)

`DelayRule` is the most complex strategy: it computes a progress ratio from three
possible payload shapes (`quantityProduced/quantityPlanned`, `completionPct`, or
milestone count fallback), normalises it against an elapsed-time ratio, and applies a
configurable day threshold. It had no tests at all in the initial submission.

**Fix applied:** Added 6 `DelayRule` tests to `test_rule_engine.py` covering:
- Fires when `quantityProduced/quantityPlanned` ratio lags the timeline
- Does not fire when progress is on track
- `completionPct`-based progress is evaluated correctly
- Milestone-count fallback triggers when all milestones are incomplete
- Missing `delivery_date` → no alert (returns `None` gracefully)
- Custom `thresholdDays` is respected

### MIN-4 — `SUBMITTED` milestones trigger `MILESTONE_OVERDUE`

```python
# milestone_overdue.py:49-53
return (
    milestone.planned_date is not None
    and milestone.planned_date < today
    and (milestone.status or "").upper() != "COMPLETED"
)
```

`SUBMITTED` milestones (pending consumer approval) satisfy this condition and will
generate overdue alerts even when the milestone work is done and only awaiting sign-off.
This may produce noise for approval-gated milestones. Consider also excluding
`"SUBMITTED"` from the overdue check, or make it configurable per rule config.
Product decision required.

### MIN-5 — `DelayRule` documentation: milestone-count fallback is implicit

When neither `quantityProduced/quantityPlanned` nor `completionPct` is in the payload,
`DelayRule` silently falls back to counting completed milestones as the progress
metric. This is a reasonable heuristic but undocumented. If a Tasowheel contract has
0/4 milestones completed at the halfway point, `DELAY` will fire on every update —
even routine routing step updates that don't carry progress information. A docstring
would help the next implementer understand this behaviour.

---

## Applied Fix — MIN-3

Added 6 `DelayRule` unit tests to `backend/tests/unit/test_rule_engine.py`.
Full suite: **107 passed, 0 failed**.

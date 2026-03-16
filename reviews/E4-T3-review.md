# E4-T3 Review — No-Data-Received Background Worker

**Date:** 2026-03-16  
**Ticket:** E4-T3: No-Data-Received Background Worker  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — MIN-1 fix applied (3 tests added for `resolve_for_new_update`), 4 minor findings

---

## Summary

`NoDataChecker` correctly implements the full no-data detection lifecycle:
- `run_forever` / `run_once` drives the check loop with a configurable interval
- `evaluate_contract` creates MEDIUM alerts at 2× frequency and upgrades to HIGH at 3×, updating
  the existing alert in-place rather than creating duplicates
- `resolve_for_new_update` is wired into `MonitoringService.process_update` so any new ingest
  automatically clears the alert
- The worker is registered as an `asyncio.Task` in `app.main.lifespan` and is cancelled cleanly
  on shutdown

All 5 existing tests pass. After applying MIN-1 fix, 8/8 pass.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Background task runs every 5 min (configurable `NO_DATA_CHECK_INTERVAL_SECONDS`) | ✅ |
| 2 | For each IN_PROGRESS contract: check last update vs `config.dataUpdateFrequency` | ✅ |
| 3 | If overdue by >2× AND no unresolved alert → fire alert | ✅ |
| 4 | Severity: MEDIUM if <3×, HIGH if >3× | ✅ |
| 5 | Alert auto-resolves on new ingest (`resolve_for_new_update` in monitoring.py) | ✅ |
| 6 | Worker registered in `main.py` lifespan with task cancellation on shutdown | ✅ |
| 7 | HIGH-severity no-data alerts queued for blockchain logging after commit | ✅ |
| 8 | Idempotent — upgrades existing alert instead of creating duplicate | ✅ |
| 9 | Notification sent when alert created or severity changes | ✅ |

**Test results:** 5/5 before fix, 8/8 after fix applied

---

## Findings

### MIN-1 (Fixed) — `resolve_for_new_update` had no unit tests

The spec requirement "Alert auto-resolves when new update received for that contract" is covered
operationally by wiring `resolve_for_new_update` into `MonitoringService`, but the method itself
had no direct unit tests.

**Fix applied:** Added 3 unit tests to `tests/unit/test_no_data_checker.py`:
- `test_resolve_for_new_update_sets_resolved_at_on_active_no_data_alert` — happy path
- `test_resolve_for_new_update_is_noop_when_no_active_no_data_alert` — empty alerts list
- `test_resolve_for_new_update_does_not_resolve_already_resolved_alert` — resolved alerts are not
  re-resolved, preserving the original `resolved_at` timestamp

### MIN-2 — `_MONITORED_CONTRACT_STATUSES` includes `ACTIVE` in addition to `IN_PROGRESS`

Spec says "For each `IN_PROGRESS` contract". The implementation monitors both `ACTIVE` and
`IN_PROGRESS`. In practice, `ACTIVE` is the initial state before production starts, so it is
reasonable to also track it (a provider might not send the first update promptly). This is a
deliberate extension of the spec. A code comment explaining the intent would improve clarity.

### MIN-3 — `selectinload(Contract.status_updates)` loads full update history per contract

`_reference_time` only needs the latest timestamp, but the loader pulls all `StatusUpdate` rows
for every active contract. At scale this will be a memory and query-time issue. Flagged for
post-MVP refactor to use a correlated subquery (`SELECT MAX(timestamp) ...`).

### MIN-4 — `_queue_notification_if_needed` sends a notification on every severity change

When a contract's no-data alert upgrades from MEDIUM → HIGH, a second `NO_DATA_RECEIVED`
notification is sent to the consumer. This means a consumer monitoring one contract can receive
multiple notifications for the same root cause event. The behaviour is intentional (the user is
informed of escalation) but there is no test covering the two-notification escalation path. The
escalation scenario is indirectly tested via the alert severity upgrade test.

---

## Not-blocking notes

- `max(interval_seconds, 1)` in `run_forever` prevents runaway 0-interval loops — not tested,
  but the guard itself is trivial.
- The blockchain logging for no-data HIGH alerts occurs outside the session context (after
  `commit()`), consistent with the ingest pattern.

# E4-T4 Review — Notification Delivery Service

**Date:** 2026-03-16  
**Ticket:** E4-T4: Notification Delivery Service  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — MIN-1 fix applied (dead branch removed), 4 minor findings

---

## Summary

`NotificationService` implements the full notification lifecycle:
- `send` / `send_many` write to the `notifications` table and optionally send email via SMTP
- All 5 required trigger events are wired (`MILESTONE_AWAITING_APPROVAL`, `MILESTONE_APPROVED`,
  `MILESTONE_REJECTED`, `ALERT_TRIGGERED`, `CONTRACT_STATE_CHANGED`, `NO_DATA_RECEIVED`)
- `GET /api/v1/notifications` and `POST /api/v1/notifications/{id}/read` are implemented
- Unread count included in `GET /api/v1/contracts` meta via `unread_count_for_user`
- SMTP is silently skipped when `SMTP_HOST` is not configured
- Schema versioned correctly via migrations `0003` (initial table) + `0005` (`message` column)

All 5 service unit tests and 2 API integration tests pass. Post-fix: suite still 122/122.

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `NotificationService.send(recipient_id, event_type, message, contract_id)` | ✅ |
| 2 | In-app delivery: writes to `notifications` table | ✅ |
| 3 | Email delivery: SMTP if `SMTP_HOST` set, silently skipped otherwise | ✅ |
| 4 | `MILESTONE_AWAITING_APPROVAL` → notify consumer | ✅ (MilestoneService) |
| 5 | `MILESTONE_APPROVED` / `MILESTONE_REJECTED` → notify provider | ✅ (MilestoneService) |
| 6 | `ALERT_TRIGGERED` (HIGH/CRITICAL) → notify consumer | ✅ (ingest.py) |
| 7 | `CONTRACT_STATE_CHANGED` → notify both parties | ✅ (ingest.py, suppressed for MILESTONE_COMPLETE) |
| 8 | `NO_DATA_RECEIVED` → notify consumer | ✅ (no_data_checker.py) |
| 9 | `notifications` DB table with all required columns | ✅ (migration 0003 + 0005) |
| 10 | `GET /api/v1/notifications` — returns unread for current user | ✅ |
| 11 | `POST /api/v1/notifications/{id}/read` — marks as read | ✅ |
| 12 | `GET /api/v1/contracts` meta includes `unreadNotifications` count | ✅ |
| 13 | No crash when SMTP unconfigured | ✅ |

**Test results:** 5/5 unit + 2/2 integration = 7/7 pass

---

## Findings

### MIN-1 (Fixed) — Dead `NO_DATA_RECEIVED` branch in `_queue_notification_side_effects`

```python
# before — ingest.py _queue_notification_side_effects
for alert in triggered_alerts:
    rule_id = (alert.rule_id or "").upper()
    severity = (alert.severity or "").upper()
    if severity not in {"HIGH", "CRITICAL"} and rule_id != "NO_DATA_RECEIVED":
        continue
    event_type = "NO_DATA_RECEIVED" if rule_id == "NO_DATA_RECEIVED" else "ALERT_TRIGGERED"
```

`RuleEngine.evaluate` explicitly skips `NO_DATA_RECEIVED` rules (handled by the background
worker), so `rule_id == "NO_DATA_RECEIVED"` can never be true inside `triggered_alerts`. The
condition was confusing dead code.

**Fix applied:** Simplified to the semantically correct check:

```python
for alert in triggered_alerts:
    severity = (alert.severity or "").upper()
    if severity not in {"HIGH", "CRITICAL"}:
        continue
    NotificationService.send(
        session,
        recipient_id=contract.consumer_id,
        event_type="ALERT_TRIGGERED",
        ...
    )
```

### MIN-2 — `CONTRACT_STATE_CHANGED` notification is suppressed for `MILESTONE_COMPLETE` updates

```python
if update_type != "MILESTONE_COMPLETE":
    NotificationService.send_many(...)  # CONTRACT_STATE_CHANGED
```

The spec says "`CONTRACT_STATE_CHANGED` → notify both parties" without exceptions. The code
suppresses this notification when an update is a milestone completion, because
`MilestoneService._queue_approval_notification` already fires `MILESTONE_AWAITING_APPROVAL` for
the same event. The intent is to avoid double-notifying consumers. This is a reasonable UX
decision but is a deliberate deviation from the spec; a code comment would clarify the reason.

### MIN-3 — Migration split: `message` column added in a follow-up migration (0005)

The `notifications` table was created in `0003` without the `message` column. Migration `0005`
adds it as a separate `ALTER TABLE`. The model and service already expected `message`. This is
a functional non-issue (Alembic applies both), but the two-migration split means any fresh
DB setup must run all migrations in order, and the intermediate state (after `0003`, before
`0005`) has the model out of sync with the schema. This is acceptable for a single-developer
workflow but would be a source of confusion if migrations are ever squashed.

### MIN-4 — `FakeScalarCollection` / `FakeResult` duplicated across notification test files

`test_notification_service.py` and `test_notifications_api.py` each define identical
`FakeScalarCollection` and `FakeResult` helpers. This is the fourth or fifth occurrence of
this pattern across the test suite. Consolidation into `tests/helpers/` continues to grow
in urgency as a maintenance concern.

---

## Not-blocking notes

- `send_many` correctly deduplicates recipients via a `seen` set, so consumer and provider
  receiving the same `CONTRACT_STATE_CHANGED` notification is safe even if they share an email.
- `_recipient_identities` builds a tuple of `(id, email, preferred_username)`, ensuring identity
  checks work regardless of which identity value the notification was sent to.
- The `mark_as_read` authorization check (`recipient_id not in _recipient_identities`) properly
  prevents users from reading other users' notifications.

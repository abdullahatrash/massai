# Review: E3-T3 (Alerts Endpoints)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved — 1 required fix applied (IMP-1 + E3-T2 MIN-3 resolved), 4 minor findings

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/api/v1/alerts.py` (new) | ✅ (IMP-1 fixed) |
| `backend/app/schemas/alert.py` (new) | ✅ |
| `backend/app/api/v1/router.py` | ✅ (alerts router registered) |
| `backend/app/api/v1/timeline.py` | ✅ (E3-T2 MIN-3 fixed here too) |
| `backend/tests/integration/test_alerts_api.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `GET /contracts/{id}/alerts` — active (unacknowledged), ordered severity→time | ✅ |
| `GET /contracts/{id}/alerts/history` — all alerts, no filter | ✅ |
| `?severity=HIGH` filter on history | ✅ |
| `?from=&to=` date range filter on history | ✅ |
| `POST /contracts/{id}/alerts/{aId}/acknowledge` — sets `acknowledged_at` | ✅ |
| Acknowledged alert drops out of active list but stays in history | ✅ |
| Severity ordering: CRITICAL → HIGH → MEDIUM → LOW | ✅ |
| Within same severity: most recent first | ✅ |
| 404 returned for unknown `alert_id` | ✅ |
| Alert descriptions plain English | ✅ (after IMP-1 fix) |
| No blockchain jargon in response fields | ✅ |
| `alerts_router` registered in `router.py` | ✅ |
| `selectinload(Contract.alerts)` — no N+1 queries | ✅ |
| 5/5 integration tests pass | ✅ |

---

## Issues

### ~~IMP-1~~ — `_alert_description` returned raw JSON for `QUALITY_EVENT_PENDING` alerts — **Applied**

**Location:** `alerts.py` `_alert_description` (before fix)

`monitoring.py` `_queue_quality_event` stores `condition_description` as a JSON-serialised dict:
```json
{"updateId": "abc-123", "sensorId": "sensor-1", "payload": {...}}
```

`_alert_description` returned this string verbatim, directly violating the ticket requirement "Alert descriptions plain English" and testing step 6 ("Alert description contains no error codes or technical identifiers"). The integration test did not catch this because all test alerts were seeded with manually written plain-English descriptions.

**Fix applied** to both `alerts.py` and `timeline.py` (which had the same latent issue):

```python
def _alert_description(alert: Alert) -> str:
    description = (alert.condition_description or "").strip()
    if description:
        if description.startswith("{"):
            try:
                data = json.loads(description)
                if isinstance(data, dict) and "sensorId" in data:
                    return f"Quality event received from sensor '{data['sensorId']}'"
            except (ValueError, TypeError):
                pass
        return description
    severity = (alert.severity or "alert").upper()
    return f"{severity.title()} alert triggered"
```

This also resolves **E3-T2 MIN-3** (timeline alert description) which was noted as a carry-forward in the previous review — a `_humanize_alert_description` helper was added to `timeline.py` with the same logic.

---

### MIN-1 — `_assert_contract_access` is now duplicated in four files

`contracts.py`, `milestones.py`, `timeline.py`, and `alerts.py` all define an identical local helper. This is the fourth copy. Should be centralised in `app/core/contracts.py` — see E3-T2 MIN-1.

---

### MIN-2 — `list_active_alerts` does not exclude `resolved` alerts

**Location:** `alerts.py` line 138

```python
active_alerts = [
    alert for alert in contract.alerts or [] if alert.acknowledged_at is None
]
```

An alert that has `resolved_at` set (but `acknowledged_at` is still `None`) still appears in the active list. The badge logic in `contracts.py` `_has_active_high_alert` checks **both** `acknowledged_at is None AND resolved_at is None`. The active list filter should match:

```python
active_alerts = [
    alert for alert in contract.alerts or []
    if alert.acknowledged_at is None and alert.resolved_at is None
]
```

This is a product question too — the decision to only check `acknowledged_at` may be intentional — but the inconsistency with the badge logic is worth resolving explicitly.

---

### MIN-3 — `PENDING` severity in `AlertSeverity` enum is undocumented

`AlertSeverity.PENDING` is added to the enum with sort order 4 (lowest). The ticket spec defines ordering as `CRITICAL, HIGH, MEDIUM, LOW` only. The `PENDING` severity exists to support `QUALITY_EVENT_PENDING` alerts from the monitoring service. This is the right pragmatic choice, but it should be documented as an internal/system severity that is not visible to consumers in the standard alert flow (i.e. these should be triaged into a real severity before being shown to consumers).

---

### MIN-4 — `AlertResponse.description` field has a redundant `alias`

**Location:** `schemas/alert.py` line 12

```python
description: str = Field(alias="description")
```

`alias="description"` on a field already named `description` is a no-op. Remove the `Field(...)` wrapper entirely:
```python
description: str
```

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E3-T3 | ✅ **Approved** | IMP-1 found and fixed; E3-T2 MIN-3 also resolved; 4 minor findings remain |

**The implementation is solid.** The severity ordering map, the `pageSize + 1`-free approach (loading all alerts per contract into memory via `selectinload` is fine at this scale), and the idempotent acknowledge (re-acknowledging an already-acknowledged alert is a no-op) are all good choices. The date range filter using `.date()` on timezone-aware datetimes is correct.

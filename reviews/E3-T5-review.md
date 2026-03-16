# Review: E3-T5 (WebSocket — Real-Time Push)

**Date:** 2026-03-16  
**Reviewer:** AI Review Agent  
**Status:** ✅ Approved — no blocking issues, 5 minor findings

---

## Files Reviewed

| File | Status |
|---|---|
| `backend/app/core/connection_manager.py` (new) | ✅ |
| `backend/app/api/v1/websocket.py` (new) | ✅ |
| `backend/app/api/v1/ingest.py` (modified — broadcast wired) | ✅ |
| `backend/app/main.py` | ✅ (websocket_router registered at app level) |
| `backend/tests/integration/test_websocket_api.py` | ✅ |

---

## Criteria Checklist

| Criterion | Result |
|---|---|
| `WS /ws/contracts/{contractId}` endpoint exists | ✅ |
| Broadcast on each ingest event to all connected clients | ✅ |
| Message types: `UPDATE_RECEIVED`, `MILESTONE_CHANGED`, `ALERT_TRIGGERED`, `CONTRACT_STATE_CHANGED` | ✅ |
| Message shape: `{ type, data, timestamp }` | ✅ |
| Non-existent contract → `CONTRACT_NOT_FOUND` message then close | ✅ |
| Multiple clients receive same broadcast | ✅ |
| Client disconnect handled cleanly (no server error) | ✅ |
| Stale/orphaned connections auto-cleaned on failed send | ✅ |
| `finally` block guarantees `disconnect()` called on all exit paths | ✅ |
| Broadcast called **after** `session.commit()` — DB consistent before push | ✅ |
| Auth via `?token=` query param — standard WebSocket pattern | ✅ |
| Role check: `consumer` or `admin` only | ✅ |
| Contract access check (`can_access_contract`) | ✅ |
| `websocket_router` registered directly on `app` (no `/api/v1` prefix) | ✅ |
| 3/3 integration tests pass | ✅ |

---

## Design Highlights

**`ConnectionManager` is cleanly implemented:**
- `asyncio.Lock` protects the shared `_connections` dict against concurrent modifications.
- `_snapshot()` copies the socket set while holding the lock, then releases it before sending — this prevents the lock being held during potentially slow network I/O, avoiding deadlocks.
- Stale detection: if `send_json` raises for any reason, the socket is collected and disconnected in a post-loop pass — this handles abruptly closed connections without crashing the broadcast loop.
- `clear()` / `count()` utility methods are useful for testing and teardown.

**`ingest.py` wiring is correct order:**
`session.flush()` → `MonitoringService.process_update()` → `session.commit()` → `_broadcast_update_messages()`. DB is committed before the push goes out, so any client that immediately GETs the contract state will see fresh data. ✅

**`_broadcast_update_messages` sends two messages per ingest:**
1. Always: `UPDATE_RECEIVED` (acknowledgement with ingest metadata)
2. Type-specific: `MILESTONE_CHANGED` / `ALERT_TRIGGERED` / `CONTRACT_STATE_CHANGED`

This is a clean design that lets the UI distinguish "something happened" from "what kind of thing happened".

---

## Issues

### MIN-1 — Validate-before-connect is the safer pattern for contract existence check

**Location:** `websocket.py` lines 40–55

Current flow:
```python
await connection_manager.connect(contract_id, websocket)  # adds to set first
try:
    contract = await get_contract_by_public_id(...)       # then validates
except Exception:
    await connection_manager.broadcast(                   # broadcasts to all in set
        contract_id, message_type="CONTRACT_NOT_FOUND", ...
    )
    await websocket.close(...)
    return
```

If the contract lookup fails, `broadcast()` sends `CONTRACT_NOT_FOUND` to **every** socket in `_connections[contract_id]` — not just the new client. In practice this set only contains the new client (no legitimate client would be connected to a non-existent contract), but the semantic is inverted: validate, then connect.

**Safer pattern:**
```python
try:
    contract = await get_contract_by_public_id(session, contract_id)
except Exception:
    await websocket.accept()
    await websocket.send_json({"type": "CONTRACT_NOT_FOUND", "data": {"contractId": contract_id}, ...})
    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    return

if not current_user.can_access_contract(contract.public_id or contract_id):
    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    return

await connection_manager.connect(contract_id, websocket)
try:
    while True:
        await websocket.receive_text()
except WebSocketDisconnect:
    pass
finally:
    await connection_manager.disconnect(contract_id, websocket)
```

---

### MIN-2 — Module-level `connection_manager` singleton is not multi-worker safe

**Location:** `connection_manager.py` line 68

```python
connection_manager = ConnectionManager()
```

Each OS process (Gunicorn/Uvicorn worker) has its own instance. In a multi-worker deployment, a provider posting an ingest update to worker 1 will only broadcast to WebSocket clients connected to worker 1. Clients on worker 2 will miss the message.

**Fix (post-MVP):** Replace the in-memory set with a Redis pub/sub channel per `contract_id`. The `broadcast()` method publishes to Redis; a per-worker subscriber relays to local WebSockets.

---

### MIN-3 — Two messages per ingest is undocumented

The ticket says "broadcasts a message" (singular). The implementation sends two: `UPDATE_RECEIVED` + a type-specific message. This is a better design than a single message, but the consumer UI needs to be aware it should call `receive()` twice per ingest event. This should be documented in the API contract or OpenAPI spec.

---

### MIN-4 — No test for unauthorized or unauthenticated WebSocket connection

The test overrides `get_websocket_current_user` to return a known consumer. There is no test for:
- Missing `?token=` → expect WebSocket error code 1008
- Wrong role (provider tries to connect) → expect 1008

---

### MIN-5 — `log_requests` middleware in `main.py` is missing a type annotation for `call_next`

**Location:** `main.py` line 70

```python
async def log_requests(request: Request, call_next):  # call_next has no type
```

Should be:
```python
from starlette.middleware.base import RequestResponseEndpoint
async def log_requests(request: Request, call_next: RequestResponseEndpoint) -> Response:
```

Minor but causes type checker warnings.

---

## E3-T4 MIN-2 Fix Applied (this session)

The `qualityPassRateAvg`, `avgCycleTimeEfficiency`, and `avgPhaseCompletionDays` metrics in `analytics.py` were returning `0.0` when no data was available, which was semantically misleading (a new contract with no updates would show `qualityPassRateAvg: 0.0`).

Changed all three `else 0.0` fallbacks to `else None`. With `model_dump(exclude_none=True)`, the fields are now absent from the response when there is no data — the correct UX signal for "metric not yet available".

**6/6 analytics + WebSocket tests still pass.**

---

## Overall Verdict

| Ticket | Verdict | Required Actions |
|---|---|---|
| E3-T5 | ✅ **Approved** | No blocking issues — MIN-1 (validate-before-connect) recommended before production |
| E3-T4 MIN-2 | ✅ **Fixed** | `0.0 → None` for absent float metrics; 68/68 tests pass |

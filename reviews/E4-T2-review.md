# E4-T2 Review — Alert Severity & Blockchain Logging

**Date:** 2026-03-16  
**Ticket:** E4-T2: Alert Severity & Blockchain Logging  
**Reviewer:** Architect Agent  
**Verdict:** ✅ Approved — no blocking issues, 4 minor findings

---

## Summary

`AlertBlockchainService` correctly gates blockchain logging on `HIGH`/`CRITICAL`
severity, dispatches it as a FastAPI `BackgroundTask` (so the ingest API call always
returns immediately), retries up to 3 times with exponential backoff on failure, and
creates a `BlockchainEvent` row with the transaction hash. `MockBlockchainService`
writes to an SQLite file and returns deterministic `0xmock{uuid[:8]}` hashes.
`AlertVerificationService` resolves `blockchainVerified` / `verifiedAt` for the
consumer-facing alerts API. The previously-noted E3-T3 MIN-2 inconsistency (`active
alerts` filter missing `resolved_at is None`) is also fixed in this ticket.

All 4 unit tests + all existing integration tests pass (114/114 total).

---

## Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | `BlockchainService` Protocol updated with `log_alert_event` | ✅ |
| 2 | `MockMSBService` — SQLite write, `0xmock{uuid[:8]}` hash | ✅ |
| 3 | `RealMSBService` — stub raises `RuntimeError` pending ABI | ✅ (acceptable) |
| 4 | `BLOCKCHAIN_ADAPTER=mock\|real` env var controls factory | ✅ |
| 5 | HIGH/CRITICAL → background task calls `AlertBlockchainService.log_alerts` | ✅ |
| 6 | `BlockchainEvent` row persisted with `transaction_hash` | ✅ |
| 7 | Retry 3 times with exponential backoff; log error; API not affected | ✅ |
| 8 | `GET /alerts` and `GET /alerts/history` expose `blockchainVerified` + `verifiedAt` | ✅ |
| 9 | LOW/MEDIUM alert → no blockchain write | ✅ |
| 10 | Mock write is idempotent (re-log same alert returns existing hash) | ✅ |
| 11 | `blockchainVerified: true` in test response for matched alert | ✅ |
| 12 | E3-T3 MIN-2 (`active alerts` filter) fixed: `acknowledged_at IS NULL AND resolved_at IS NULL` | ✅ |

**Test results:** 4/4 passed, full suite 114/114 passed

---

## Findings

### MIN-1 — Redundant double-return in `_log_single_alert_with_retry`

```python
# alert_blockchain.py:51-53
if logged:
    return
return
```

Whether `_log_single_alert` returns `True` or `False`, we exit the loop. The `if`
guard is dead code — the bare `return` below handles both branches. Simplify to a
single `return` statement.

### MIN-2 — `log_alert_event` signatures are untyped in both service implementations

```python
# blockchain_mock.py:111 and blockchain_real.py:19
async def log_alert_event(self, contract, alert) -> BlockchainWriteResult:
```

Neither `MockBlockchainService` nor `RealBlockchainService` annotate `contract` and
`alert` parameters with their types (`Contract` and `Alert`). The `BlockchainService`
Protocol declares the full signature with type hints. Adds friction for IDE support
and static analysis.

### MIN-3 — "3 retries" wording vs "3 total attempts" in implementation

The ticket says "retry up to 3 times" (conventional meaning: 1 initial + 3 retries =
4 total). The implementation does `range(1, 4)` — 3 total attempts, not 3 retries.
The test asserts `await_count == 3` which matches the implementation but not the
conventional definition. Either update the loop to `range(1, 5)` for true 3-retry
semantics, or update the ticket wording. The test and code are internally consistent;
this is only a semantic ambiguity.

### MIN-4 — `AlertVerificationService` has no standalone unit tests

`AlertVerificationService.build_index` handles two `event_data` key variants
(`alert_id` vs `alertId`) and "latest wins" deduplication logic. These are tested
implicitly through `test_alerts_api.py`, but there are no isolated unit tests for the
verification service logic (e.g., what happens with zero events, multiple events for
the same alert, missing `alert_id` keys). The audit service (`AuditService`) also
builds its own index in `_build_blockchain_verification_index` — the two index-
building strategies should eventually be unified or cross-tested.

---

## Not-blocking notes

- `MockBlockchainService._events_db_path` resolves to the project root
  `mock_msb/events.db`. This is intentional for local dev. The test overrides it with
  a `tempfile.TemporaryDirectory()`, so no side-effects in CI.
- The `RealBlockchainService.is_connected()` method is present but not part of the
  `BlockchainService` Protocol and not called anywhere in production code. It exists
  for manual connectivity verification only.
- Spec step 3 (`web3.is_connected()` returns True) is not automated — testing against
  the live `entrynet-maasai.euinno.eu` endpoint is a manual/integration concern and
  correctly omitted from the unit test suite.

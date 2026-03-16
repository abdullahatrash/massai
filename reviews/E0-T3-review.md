# Review: E0-T3

**Date:** March 16, 2026
**Ticket:** E0-T3 — Provider Service Account Tokens
**Verdict:** ✅ **Approved with one required fix** (IMP-1 — safe crash path in simulator)

---

## Verification Checklist

| Criteria | Status | Notes |
|---|---|---|
| `provider-factor-sa` service account client in `realm-export.json` | ✅ | `serviceAccountsEnabled: true`, secrets set, no user-facing flows |
| `provider-tasowheel-sa` service account client | ✅ | Same config |
| `provider-e4m-sa` service account client | ✅ | Same config |
| Each SA client has `provider` role (via `setup.sh`) | ✅ | `sync_service_account` syncs realm roles onto the SA user |
| Each SA client has `contract_ids` attribute on its service account user | ✅ | `sync_service_account` PUTs `attributes: {"contract_ids": [...]}` via Admin API |
| `defaultClientScopes: ["contract_ids"]` on each SA client | ✅ | Mapper reads from SA user attributes → emits claim in token |
| `backend/app/core/token_cache.py` — async cache helper | ✅ | Double-checked locking, 30s buffer, TTL-based refresh |
| `mock-sensors/base_simulator.py` authenticates via client credentials | ✅ | Sync `ServiceAccountTokenProvider`, appropriate for non-async script |
| Simulator logs `"authenticated"` on token fetch | ✅ | JSON event emitted via `print(json.dumps(...))` |
| `docker-compose.dev.yml` — all 3 simulators have `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` | ✅ | Secrets reference `${PROVIDER_*_CLIENT_SECRET:-...}` with defaults |
| `.env.example` documents `PROVIDER_*_CLIENT_SECRET` | ✅ | All 3 secrets documented |
| Existing tests still pass | ✅ | 5/5 auth unit tests pass |

---

## Architecture Notes (Correct)

**Two-layer token handling is appropriate:**
- `backend/app/core/token_cache.py` — **async** `ServiceAccountTokenCache` (for backend-to-service calls in future epics)
- `mock-sensors/base_simulator.py` — **sync** `ServiceAccountTokenProvider` (correct: simulators are plain sync Python scripts with no async runtime)

Both implement the same 30-second expiry buffer and double-checked re-fetch on near-expiry. The async version uses `asyncio.Lock`, the sync version is single-threaded so no lock is needed.

**`contract_ids` claim flow for service accounts is correct:**
1. SA client has `defaultClientScopes: ["contract_ids"]`
2. The `contract_ids` scope mapper is `oidc-usermodel-attribute-mapper` with `multivalued: true`
3. `setup.sh` PUTs `{"contract_ids": ["contract-factor-001"]}` onto the service account user via the Admin API
4. Keycloak reads the SA user attribute when issuing the token → claim is present
5. `auth.py` `_normalize_contract_ids` reads `claims.get("contract_ids")` — handles both list and single-string cases

---

## Issues

### Important

#### IMP-1: Direct `payload["access_token"]` access can crash the simulator with `KeyError`

**File:** `mock-sensors/base_simulator.py`, line 51

```python
self._access_token = payload["access_token"]   # KeyError if Keycloak response is malformed
```

The outer `while True` loop in `run_simulator` only catches `HTTPError` and `URLError`. A `KeyError` (malformed but valid-HTTP response from Keycloak) propagates unhandled and terminates the simulator process. The fix is a single line:

```python
access_token = payload.get("access_token")
if not access_token:
    raise RuntimeError(f"Keycloak token response missing access_token: {payload}")
self._access_token = access_token
```

The `RuntimeError` also won't be caught by the outer loop as-is. The correct fix is to catch all exceptions in the simulator loop:

```python
        except Exception as exc:
            backend_status = f"error ({type(exc).__name__}: {exc})"
            backend_payload = {}
```

---

### Minor

#### MIN-1: `base_simulator.py` does not retry on first authentication failure before `while True` starts

If Keycloak is not yet ready to accept the `client_credentials` grant when the simulator first calls `get_access_token()`, the loop catches the error and logs it, then sleeps `INTERVAL_SECONDS` and retries. This is resilient enough. However, the `keycloak-setup` container must complete before Keycloak's realm is usable. The Docker Compose ordering (`simulators depend_on backend: service_healthy`, `backend depends_on keycloak: service_started`) gives a window where the realm import might not be complete.

This is acceptable for local dev — the simulator will log a heartbeat error on the first few ticks and auto-recover once Keycloak is ready. No action required before the next ticket.

#### MIN-2: `token_cache.py` (async) not yet wired into the app

`backend/app/core/token_cache.py` exists and works but is not imported anywhere in the app. This is expected — it will be used in E2 when the backend needs to call SCT or other services. No action needed.

#### MIN-3: SA clients are missing the `email` inline protocol mapper

`massai-backend` and `massai-frontend` both have inline `email`, `preferred_username`, and `realm_roles` mappers. The SA clients (`provider-*-sa`) only have `preferred_username` and `realm_roles` — no `email`. Service accounts don't have emails, so this has no functional impact. Keeping it consistent is a cosmetic improvement only.

#### MIN-4: `.env.example` `BACKEND_CORS_ORIGINS` changed to JSON array format

Was `http://localhost:3000,http://127.0.0.1:3000`, now `["http://localhost:3000","http://127.0.0.1:3000"]`. pydantic-settings v2 tries JSON deserialization first for list fields, so both formats work. However it diverges from the validator which explicitly handles comma-separated strings. Recommended to revert to comma-separated for consistency with the validator and avoid confusing future developers.

---

## Required Actions

| Priority | Action | File | Urgency |
|---|---|---|---|
| IMP-1 | Catch `KeyError` / add broad `except Exception` to `while True` loop in `run_simulator` | `mock-sensors/base_simulator.py` | Fix now |
| MIN-4 | Revert `BACKEND_CORS_ORIGINS` to comma-separated format | `.env.example` | Quick cleanup |

---

## Ticket Status

| Ticket | Status | Notes |
|---|---|---|
| E0-T3 | ✅ Closed after IMP-1 fix | All criteria met |

**Next:** E0-T4 (Frontend Keycloak login flow) → E1-T3 (Database schema + Alembic migrations)

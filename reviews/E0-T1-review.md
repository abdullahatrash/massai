# Code Review — EPIC E0, Ticket E0-T1
## Keycloak Docker Setup + Realm Configuration

| Field | Value |
|---|---|
| Review Date | March 16, 2026 |
| Reviewer | Senior Engineering Review |
| Ticket | E0-T1 — Keycloak Docker Setup + Realm Configuration |
| Epic | E0 — Authentication & Authorization (Keycloak) |
| Files Reviewed | `user-service/realm-export.json` · `user-service/seed-users.json` · `user-service/setup.sh` · `docker-compose.dev.yml` |
| Reviewed Against | `docs/plans/2026-03-16-epics-and-tickets.md` → E0-T1 acceptance criteria |
| Overall Verdict | ✅ **Approved with Required Fixes** — 2 important issues must be resolved before E0-T2 begins |

---

## Summary

E0-T1 is functionally complete. All required components are present: the Keycloak Docker service, realm import, both clients, all three roles, the `contract_ids` custom claim mapper, all 5 seed users with correct roles and contract scopes, the idempotent setup script, and the one-shot `keycloak-setup` Docker service.

Two important issues were identified that must be fixed **before E0-T2 (Backend JWT Middleware) is built** — if left unfixed they will cause silent auth failures that are difficult to diagnose later. Three minor issues are noted for awareness.

---

## Acceptance Criteria Verification

| # | Criteria | Status | Evidence |
|---|---|---|---|
| 1 | `keycloak` service in `docker-compose.dev.yml`, image `keycloak:24` | ✅ Pass | `quay.io/keycloak/keycloak:24.0` |
| 2 | `--import-realm` flag on startup command | ✅ Pass | Present in `command` array |
| 3 | Realm volume mount to `/opt/keycloak/data/import/` | ✅ Pass | `./user-service/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro` |
| 4 | Realm name: `massai` | ✅ Pass | `"realm": "massai"` |
| 5 | `massai-backend` — confidential, service accounts enabled | ✅ Pass | `"publicClient": false`, `"serviceAccountsEnabled": true` |
| 6 | `massai-frontend` — public client, PKCE S256 | ✅ Pass | `"publicClient": true`, `"pkce.code.challenge.method": "S256"` |
| 7 | `massai-frontend` — redirect URI `http://localhost:3000/*` | ✅ Pass | Present in `redirectUris` |
| 8 | Roles: `consumer`, `provider`, `admin` defined | ✅ Pass | All 3 in `roles.realm` array |
| 9 | `contract_ids` custom client scope with mapper | ✅ Pass | `oidc-usermodel-attribute-mapper`, `multivalued: true` |
| 10 | 5 seed users with correct roles and `contract_ids` | ✅ Pass | All 5 users match spec exactly |
| 11 | `setup.sh` — idempotent (create-or-update, no duplicates) | ✅ Pass | `sync_user()` calls `get_user()` before creating |
| 12 | `keycloak-setup` one-shot service, `restart: "no"` | ✅ Pass | Correct |
| 13 | Setup reads `SEED_USERS_FILE` from environment | ✅ Pass | Env var with `/work/seed-users.json` default |
| 14 | Admin credentials read from environment variables | ✅ Pass | `${KEYCLOAK_ADMIN:-admin}` pattern used throughout |

---

## Issues

### 🔴 Critical — 0 issues

None.

---

### 🟡 Important — 2 issues

---

#### IMP-1 — `sslRequired` missing from `realm-export.json`

**File:** `user-service/realm-export.json`

**Problem:**
The `sslRequired` field is absent from the realm configuration. Keycloak's default value for this field is `"external"`, which enforces HTTPS for all non-loopback requests. Inside Docker, when the React frontend (`http://localhost:3000`) makes token requests to Keycloak at `http://localhost:8080`, the path goes through Docker networking. Depending on the Keycloak version and network setup, this can cause token requests to be rejected with a cryptic `"HTTPS required"` error that is difficult to trace back to this missing field.

**Risk:** Blocks the entire auth flow when testing E0-T4 (frontend login). Can cause a multi-hour debugging session.

**Fix — add one line to `realm-export.json`:**
```json
{
  "realm": "massai",
  "sslRequired": "none",
  ...
}
```

**Note:** `"none"` is safe for development. For production, this should be `"external"` or `"all"` and managed via a separate production realm export.

---

#### IMP-2 — `contract_ids` claim presence in JWT is unverified

**File:** `user-service/realm-export.json`

**Problem:**
The `contract_ids` custom scope is defined in `clientScopes` and referenced in each client's `defaultClientScopes`. However, during Keycloak realm import, the order in which client scopes are resolved vs. client configurations are applied is not guaranteed. If the `contract_ids` scope is processed after the clients during import, it may not be correctly wired, and the claim will silently be absent from all JWTs.

This is a known Keycloak import ordering issue with custom scopes. The token will still be issued successfully — there will be no error — but the `contract_ids` array will be missing from the payload. The backend middleware (E0-T2) depends entirely on this claim for contract-ownership access control. If it's absent, all consumers will see all contracts or will be blocked entirely.

**Risk:** Invisible auth bug — everything appears to work but access control is broken.

**Verification required before E0-T2 starts:**
After `docker compose up`, decode a token and confirm `contract_ids` is present:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/massai/protocol/openid-connect/token \
  -d "client_id=massai-frontend&grant_type=password&username=consumer-factor@test.com&password=password" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo $TOKEN | python3 -c "
import sys, json, base64
token = sys.stdin.read().strip()
payload = token.split('.')[1]
payload += '=' * (4 - len(payload) % 4)
print(json.dumps(json.loads(base64.b64decode(payload).decode()), indent=2))
"
```

**Expected:** `contract_ids: ["contract-factor-001"]` present in decoded output.

**If claim is absent — fix:** Move the mapper inline to each client definition rather than relying on a standalone `clientScope`. Add directly under each client in `realm-export.json`:

```json
"protocolMappers": [
  {
    "name": "contract_ids",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "consentRequired": false,
    "config": {
      "access.token.claim": "true",
      "claim.name": "contract_ids",
      "id.token.claim": "true",
      "jsonType.label": "String",
      "multivalued": "true",
      "userinfo.token.claim": "true",
      "user.attribute": "contract_ids"
    }
  }
]
```

---

### 🔵 Minor — 3 issues

---

#### MIN-1 — `directAccessGrantsEnabled: true` on `massai-frontend` should be documented

**File:** `user-service/realm-export.json`

The ticket specification calls for "authorization code + PKCE" only. `directAccessGrantsEnabled: true` additionally enables the Resource Owner Password Credentials (ROPC) flow — a legacy pattern that bypasses the browser redirect entirely and accepts username + password directly. It is enabled here for testing convenience (allows curl-based token requests without a browser).

This is acceptable for development but must be disabled before production. It should be explicitly documented.

**Action:** When `.env.example` is created (E1-T1), add this note:
```
# SECURITY NOTE: massai-frontend has directAccessGrantsEnabled=true in the dev realm.
# This is intentional for local testing with curl. Disable in production realm config.
```

No code change required now.

---

#### MIN-2 — `depends_on` without health condition on `keycloak-setup`

**File:** `docker-compose.dev.yml`

```yaml
keycloak-setup:
  depends_on:
    - keycloak
```

This starts `keycloak-setup` immediately when the Keycloak *container starts*, not when Keycloak is *ready to accept requests*. The `wait_for_realm()` function in `setup.sh` compensates for this by polling the OIDC discovery endpoint up to 120 seconds, so it will not fail in practice.

However, the intent would be clearer and more correct with an explicit condition:

```yaml
keycloak-setup:
  depends_on:
    keycloak:
      condition: service_started
```

A full `service_healthy` condition would require adding a `healthcheck` to the `keycloak` service, which is a worthwhile addition:

```yaml
keycloak:
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost:8080/health/ready || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 12
    start_period: 30s
```

Not blocking — the polling in `setup.sh` handles it — but this would make the startup sequence explicit and remove the 2-second polling delay.

---

#### MIN-3 — `fullScopeAllowed: true` on both clients is over-permissive

**File:** `user-service/realm-export.json`

Both `massai-backend` and `massai-frontend` have `"fullScopeAllowed": true`, which includes all realm roles and scopes in every token regardless of what the client actually needs. This means a `provider` token issued to `massai-frontend` will contain all realm roles in its payload, not just the `provider` role.

For development this is harmless. For production it slightly expands the token surface area and makes role containment harder to audit.

**Future action (not now):** Set `"fullScopeAllowed": false` on each client and explicitly list only the scopes each client requires. Document in `OPEN_QUESTIONS.md` as a pre-production hardening step.

---

## What Is Not Implemented (Expected — Separate Tickets)

The following are intentionally not part of E0-T1 and are tracked as separate tickets:

| Ticket | What's Missing |
|---|---|
| E0-T2 | `backend/app/core/auth.py` — FastAPI JWT validation middleware and role-check dependencies |
| E0-T3 | Service account clients (`provider-factor-sa`, `provider-tasowheel-sa`, `provider-e4m-sa`) in `realm-export.json` and `backend/app/core/token_cache.py` |
| E0-T4 | `frontend/src/auth/keycloak.ts`, `AuthProvider.tsx`, `ProtectedRoute.tsx`, API client token injection |

---

## Strengths

- **`setup.sh` design is excellent.** Using a Python heredoc inside a shell script avoids any pip dependency while getting the full expressiveness of Python's `urllib`. Pure stdlib, runs in `python:3.12-slim` with zero additional installs. Clean and portable.
- **`sync_user()` is properly idempotent.** It queries for the user before creating, then creates or updates as appropriate. Re-running the setup container will never create duplicate users.
- **Seed users match the spec exactly.** All 5 users have the correct roles, `contract_ids` attributes, and realistic test data aligned with the seeded contracts from E1-T4.
- **`contract_ids` mapper is correctly multivalued.** The `"multivalued": "true"` config means a user with multiple contracts will get all of them as a JSON array in the token — future-proof.
- **`restart: "no"` on `keycloak-setup`.** Correct. A one-shot setup container that restarts on failure would loop forever on a permanent Keycloak error.
- **Environment variable defaults use safe fallbacks.** `${KEYCLOAK_ADMIN:-admin}` pattern throughout ensures the compose file works out of the box without a `.env` file.

---

## Required Actions Before E0-T2 Starts

| # | Action | Severity | Owner |
|---|---|---|---|
| 1 | Add `"sslRequired": "none"` to `realm-export.json` | 🟡 Important | Agent / Developer |
| 2 | Run token decode verification — confirm `contract_ids` appears in JWT | 🟡 Important | Agent / Developer |
| 2a | If claim absent: move mapper inline to each client in `realm-export.json` | 🟡 Important | Agent / Developer |

---

## Sign-off

| Status | Condition |
|---|---|
| ✅ Approved to proceed to E0-T2 | After IMP-1 and IMP-2 are resolved and verified |
| 🔵 Minor issues | Noted for backlog — no action needed before proceeding |

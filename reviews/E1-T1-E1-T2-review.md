# Review: E1-T1 + E1-T2

**Date:** March 16, 2026
**Tickets:** E1-T1 (Monorepo Scaffold + Docker Compose) · E1-T2 (Backend Project Init — FastAPI + uv)
**Verdict:** ✅ **Both approved** — minor fixes below, and a notable bonus: E0-T2 (JWT Middleware) is effectively complete.

---

## Verification Checklist

### E1-T1 — Monorepo Scaffold + Docker Compose

| Criteria | Status | Notes |
|---|---|---|
| `backend/`, `frontend/`, `mock-sensors/`, `docs/` directories exist | ✅ | |
| `docker-compose.dev.yml` — postgres, backend, frontend, 3 mock simulators | ✅ | Keycloak + keycloak-setup also included from E0-T1 |
| `.env.example` contains `DATABASE_URL`, `BLOCKCHAIN_ADAPTER`, `ENVIRONMENT`, `API_URL` | ✅ | All documented with safe defaults |
| Root `README.md` with setup instructions | ✅ | Clear quick-start and service table |
| `backend/Dockerfile` | ✅ | See notes below |
| `frontend/Dockerfile.dev` | ✅ | Lightweight node:20 placeholder |
| `mock-sensors/Dockerfile` | ✅ | See minor issue below |
| `docker-compose.yml` (production stub) | ✅ | Minimal but correct stub |
| Health checks on postgres, backend, frontend | ✅ | `pg_isready`, Python urllib, Node fetch |
| Backend waits for healthy postgres | ✅ | `condition: service_healthy` |

**Testing steps verified locally:**

```
GET /health       → 200 {"status":"ok","environment":"development"}
GET /api/v1/      → 200 {"name":"MaaSAI Monitoring API","version":"1","environment":"development"}
GET /docs         → 200 Swagger UI
Structured JSON log emitted on every request ✅
```

---

### E1-T2 — Backend Project Init (FastAPI + uv)

| Criteria | Status | Notes |
|---|---|---|
| `uv` project initialised (`pyproject.toml`, `uv.lock`) | ✅ | Python 3.12 pinned via `.python-version` |
| All required dependencies present | ✅ | + `httpx` added (needed for JWKS fetch) |
| `app/main.py` — FastAPI app, CORS, `/health` | ✅ | |
| `app/core/config.py` — pydantic-settings | ✅ | Settings load cleanly |
| `app/core/database.py` — async SQLAlchemy engine + session factory | ✅ | `pool_pre_ping=True`, `expire_on_commit=False` |
| Structured JSON logging | ✅ | Custom `JsonFormatter`, reserved-key filtering |
| `app/api/v1/router.py` | ✅ | `/` + includes auth sub-router |
| `GET /health` → `{"status":"ok","environment":"development"}` | ✅ | Verified live |
| `GET /docs` → Swagger UI | ✅ | HTTP 200 confirmed |
| JSON logs appear on each request | ✅ | Confirmed in terminal output |

---

## Bonus — E0-T2 Done Early

The agent implemented the full JWT validation middleware as part of this ticket, delivering work that belongs to E0-T2. This is **good work** and the implementation is correct. See assessment below.

**Files added beyond E1-T2 scope:**

| File | Purpose |
|---|---|
| `backend/app/core/auth.py` | JWKS fetch + cache, signature verification, claims extraction, `CurrentUser` dataclass, `get_current_user` dependency |
| `backend/app/core/dependencies.py` | `require_roles`, `require_consumer`, `require_provider`, `require_admin`, `require_contract_access` |
| `backend/app/api/v1/auth.py` | `GET /api/v1/auth/me` endpoint |

**Auth implementation assessment:**

- ✅ Double-checked locking on `_jwks_lock` — correct, prevents redundant fetches under concurrency
- ✅ JWKS cache with configurable TTL (`keycloak_jwks_cache_ttl_seconds`, default 600s)
- ✅ Manual signature verification via `jose.jwk` — avoids trusting `python-jose`'s full decode for claim validation; claims validated separately
- ✅ `realm_access.roles` used as the roles path — matches the inline mapper in `realm-export.json`
- ✅ `can_access_contract` correctly bypasses `contract_ids` check for admin users
- ✅ `_validate_audience` handles both `aud` (string or list) and `azp` fallback — covers both Keycloak token styles

---

## Issues

### Important

#### IMP-1: `on_event("startup")` is deprecated in FastAPI

**File:** `backend/app/main.py`, line 66

`@app.on_event("startup")` was deprecated in FastAPI 0.93 in favour of the `lifespan` context manager. It still works but will generate deprecation warnings in the uvicorn logs. Should be replaced before adding more startup logic (DB connection pool warm-up in E1-T3 will need it).

**Required fix:**

```python
# Replace the on_event pattern with lifespan
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("application_started", extra={
        "environment": settings.environment,
        "blockchain_adapter": settings.blockchain_adapter,
    })
    yield

app = FastAPI(..., lifespan=lifespan)
```

---

### Minor

#### MIN-1: `enable_decoding=False` is not a valid `SettingsConfigDict` key

**File:** `backend/app/core/config.py`, line 14

`enable_decoding` is not a recognised key in pydantic-settings v2's `SettingsConfigDict`. It is silently ignored, which means it has no effect. Remove it to avoid confusion.

```python
# Remove this line:
enable_decoding=False,
```

#### MIN-2: Private function `_forbidden` imported across module boundary

**File:** `backend/app/core/dependencies.py`, line 8

```python
from app.core.auth import CurrentUser, _forbidden, get_current_user
```

`_forbidden` is a private helper (leading underscore convention). `dependencies.py` should not import it. Use `HTTPException` directly instead, or expose a public `raise_forbidden(detail: str)` function in `auth.py`.

```python
# In dependencies.py, replace _forbidden usage with:
from fastapi import HTTPException, status

raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="...")
```

#### MIN-3: `mock-sensors/Dockerfile` uses `COPY . .`

**File:** `mock-sensors/Dockerfile`, line 8

`COPY . .` copies `__pycache__/` and any `.pyc` files into the image, which wastes layer cache. Replace with an explicit copy:

```dockerfile
COPY *.py ./
```

#### MIN-4: `database.py` calls `get_settings()` at module import time

**File:** `backend/app/core/database.py`, lines 9–15

```python
settings = get_settings()          # ← runs at import time
engine = create_async_engine(...)
```

This means a missing `DATABASE_URL` causes an import error rather than a startup error. The engine is also created as a global — fine for now, but E1-T3 will need to move engine teardown into the lifespan handler (`await engine.dispose()`). Flag for E1-T3.

#### MIN-5: `docker-compose.yml` (prod stub) uses list-style `depends_on`

**File:** `docker-compose.yml`, lines 33–35

```yaml
depends_on:
  - postgres
  - keycloak
```

The production stub uses the old list-style `depends_on` without health conditions. This is not critical while it remains a stub, but update to `condition: service_healthy` when you wire it up for real.

---

## Required Actions Before Proceeding

| Priority | Action | Owner |
|---|---|---|
| IMP-1 | Replace `on_event("startup")` with `lifespan` in `main.py` | Fix now — E1-T3 will add more startup logic |
| MIN-1 | Remove `enable_decoding=False` from config | Quick cleanup |
| MIN-2 | Remove import of `_forbidden` in `dependencies.py` | Quick cleanup |
| MIN-3 | Fix `mock-sensors/Dockerfile` COPY | Fix before E5 |

---

## Ticket Status Update

| Ticket | New Status | Notes |
|---|---|---|
| E1-T1 | ✅ Closed | All scaffold and Docker Compose criteria met |
| E1-T2 | ✅ Closed | All backend init criteria met |
| E0-T2 | ✅ Closed (early) | JWT middleware fully implemented in `app/core/auth.py` + `app/core/dependencies.py` |

**Next:** E0-T3 (Provider service account tokens) → E1-T3 (Database schema + Alembic migrations)

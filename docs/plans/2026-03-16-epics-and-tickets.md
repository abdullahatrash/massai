# MaaSAI Production Monitoring Tool

## EPICs & Tickets

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build the full MaaSAI production monitoring tool — backend API, visual mock sensor environment, and consumer dashboard — across 6 EPICs.

**Architecture:** Generic FastAPI backend with schema-driven pilot extensibility, PostgreSQL for operational data, mock/real blockchain adapter. Visual sensor simulator UI for interactive testing. React 19 consumer dashboard with real-time WebSocket updates.

**Tech Stack:** Python 3.12 · FastAPI · uv · SQLAlchemy async · Alembic · PostgreSQL 16 · React 19 · React Router v7 · pnpm · TypeScript · Docker Compose · web3.py · Keycloak 24

---

## EPIC Index


| Epic                                                  | Name                                      | Tickets       |
| ----------------------------------------------------- | ----------------------------------------- | ------------- |
| [E0](#epic-e0-authentication--authorization-keycloak) | Authentication & Authorization (Keycloak) | E0-T1 → E0-T4 |
| [E1](#epic-e1-infrastructure--project-setup)          | Infrastructure & Project Setup            | E1-T1 → E1-T7 |
| [E2](#epic-e2-provider-ingest-api)                    | Provider Ingest API                       | E2-T1 → E2-T7 |
| [E3](#epic-e3-consumer-read-api--websocket)           | Consumer Read API & WebSocket             | E3-T1 → E3-T8 |
| [E4](#epic-e4-alert--rule-engine)                     | Alert & Rule Engine                       | E4-T1 → E4-T4 |
| [E5](#epic-e5-visual-mock-sensor-environment)         | Visual Mock Sensor Environment            | E5-T1 → E5-T5 |
| [E6](#epic-e6-consumer-dashboard-frontend)            | Consumer Dashboard (Frontend)             | E6-T1 → E6-T8 |


---

## Build Progress

> Last updated: March 16, 2026. Update this section after each ticket is completed.

### Status Key


| Symbol | Meaning                                       |
| ------ | --------------------------------------------- |
| ✅      | Done — reviewed and approved                  |
| ⚠️     | Done — approved with required fixes pending   |
| 🔄     | In Progress — agent currently working on this |
| ⏳      | Up Next — queued, ready to start              |
| 🔲     | Pending — not yet started                     |
| 🔴     | Blocked — waiting on a dependency or decision |


---

### Ticket Status Board


| Ticket | Name                                        | Status | Notes                                                                                                                                  |
| ------ | ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **E0** | **Auth & Authorization**                    |        |                                                                                                                                        |
| E0-T1  | Keycloak Docker Setup + Realm Config        | ✅     | IMP-1 fixed (`sslRequired: none`). IMP-2 fixed (inline mappers on both clients; roles via `realm_access.roles`). Review → `reviews/E0-T1-review.md` |
| E0-T2  | Backend JWT Validation Middleware           | ✅     | Implemented early in E1-T2. `app/core/auth.py` + `app/core/dependencies.py`. Review → `reviews/E1-T1-E1-T2-review.md`                  |
| E0-T3  | Provider Service Account Tokens             | ✅     | 3 SA clients in realm-export + setup.sh syncs roles+contract_ids. Simulator auth + token cache done. Review → `reviews/E0-T3-review.md` |
| E0-T4  | Frontend Auth (Keycloak login flow)         | 🔲     |                                                                                                                                        |
| **E1** | **Infrastructure & Project Setup**          |        |                                                                                                                                        |
| E1-T1  | Monorepo Scaffold + Docker Compose          | ✅     | All scaffold + Docker Compose criteria met. Review → `reviews/E1-T1-E1-T2-review.md`                                                  |
| E1-T2  | Backend Project Init (FastAPI + uv)         | ✅     | FastAPI + uv + structured logging + lifespan handler. Review → `reviews/E1-T1-E1-T2-review.md`                                        |
| E1-T3  | Database Schema + Migrations                | 🔲     |                                                                                                                                        |
| E1-T4  | Database Seed Data (3 Pilot Contracts)      | 🔲     |                                                                                                                                        |
| E1-T5  | Standardised API Response Envelope          | 🔲     |                                                                                                                                        |
| E1-T6  | Error Handling Strategy                     | 🔲     |                                                                                                                                        |
| E1-T7  | Test Infrastructure Setup                   | 🔲     | Needed before auth unit tests in E0-T2                                                                                                 |
| **E2** | **Provider Ingest API**                     |        |                                                                                                                                        |
| E2-T1  | Pilot JSON Schemas                          | 🔲     |                                                                                                                                        |
| E2-T2  | Ingest Endpoint (Core)                      | 🔲     |                                                                                                                                        |
| E2-T3  | Monitoring Service (Update Processing)      | 🔲     |                                                                                                                                        |
| E2-T4  | Milestone Auto-Verification                 | 🔲     |                                                                                                                                        |
| E2-T5  | Consumer Milestone Approval Endpoint        | 🔲     |                                                                                                                                        |
| E2-T6  | Python Background Simulators                | 🔲     |                                                                                                                                        |
| E2-T7  | Pilot Extensibility Validation              | 🔲     |                                                                                                                                        |
| **E3** | **Consumer Read API & WebSocket**           |        |                                                                                                                                        |
| E3-T1  | Contract List & Overview Endpoints          | 🔲     |                                                                                                                                        |
| E3-T2  | Milestones & Timeline Endpoints             | 🔲     |                                                                                                                                        |
| E3-T3  | Alerts Endpoints                            | 🔲     |                                                                                                                                        |
| E3-T4  | Analytics Endpoint                          | 🔲     |                                                                                                                                        |
| E3-T5  | WebSocket — Real-Time Push                  | 🔲     |                                                                                                                                        |
| E3-T6  | Documents API Endpoint                      | 🔲     |                                                                                                                                        |
| E3-T7  | Audit Export Endpoint                       | 🔲     |                                                                                                                                        |
| E3-T8  | Admin Contract Onboarding + Blockchain Sync | 🔲     |                                                                                                                                        |
| **E4** | **Alert & Rule Engine**                     |        |                                                                                                                                        |
| E4-T1  | Rule Engine Core                            | 🔲     |                                                                                                                                        |
| E4-T2  | Alert Severity & Blockchain Logging         | 🔲     |                                                                                                                                        |
| E4-T3  | No-Data-Received Background Worker          | 🔲     |                                                                                                                                        |
| E4-T4  | Notification Delivery Service               | 🔲     |                                                                                                                                        |
| **E5** | **Visual Mock Sensor Environment**          |        |                                                                                                                                        |
| E5-T1  | Sensor UI Scaffold & Layout                 | 🔲     |                                                                                                                                        |
| E5-T2  | Scenario Runner (Automated Playback)        | 🔲     |                                                                                                                                        |
| E5-T3  | Manual Update Form                          | 🔲     |                                                                                                                                        |
| E5-T4  | Live Event Log Panel                        | 🔲     |                                                                                                                                        |
| E5-T5  | Milestone Trigger Panel                     | 🔲     |                                                                                                                                        |
| **E6** | **Consumer Dashboard (Frontend)**           |        |                                                                                                                                        |
| E6-T1  | Frontend Scaffold & Routing                 | 🔲     |                                                                                                                                        |
| E6-T2  | Contracts List Page                         | 🔲     |                                                                                                                                        |
| E6-T3  | Contract Overview Page                      | 🔲     |                                                                                                                                        |
| E6-T4  | Milestone Timeline Page                     | 🔲     |                                                                                                                                        |
| E6-T5  | Production Feed Page (Live)                 | 🔲     |                                                                                                                                        |
| E6-T6  | Alert Center Page                           | 🔲     |                                                                                                                                        |
| E6-T7  | Analytics Page                              | 🔲     |                                                                                                                                        |
| E6-T8  | Notification Bell & In-App Notifications    | 🔲     |                                                                                                                                        |


---

### Active Build Sequence

The current agreed sequence (revised from original to wire auth in early):

```
✅ E0-T1  Keycloak realm + Docker (IMP-1 + IMP-2 fixed ✅)
✅ E1-T1  Monorepo scaffold + Docker Compose
✅ E1-T2  FastAPI + uv project init
✅ E0-T2  JWT middleware (implemented early as part of E1-T2)
✅ E0-T3  Provider service account tokens (3 SA clients, setup.sh sync, simulator auth)
⏳ E1-T3  Database schema + migrations
⏳ E1-T4  Seed data (3 pilot contracts)
⏳ E1-T5  API response envelope
⏳ E1-T6  Error handling strategy
⏳ E1-T7  Test infrastructure (pytest config, conftest, fixtures)
   ... then E2 → E4 → E3 → E5 → E6 per original order
```

---

### Review Log


| Ticket | Review File               | Verdict                           | Date           |
| ------ | ------------------------- | --------------------------------- | -------------- |
| E0-T1  | `reviews/E0-T1-review.md`         | ✅ Closed — both fixes verified and applied              | March 16, 2026 |
| E1-T1  | `reviews/E1-T1-E1-T2-review.md`  | ✅ Closed — all scaffold criteria met, 4 minor fixes applied | March 16, 2026 |
| E1-T2  | `reviews/E1-T1-E1-T2-review.md`  | ✅ Closed — FastAPI init complete; E0-T2 delivered early    | March 16, 2026 |
| E0-T2  | `reviews/E1-T1-E1-T2-review.md`  | ✅ Closed (early) — JWT middleware in `app/core/auth.py`    | March 16, 2026 |
| E0-T3  | `reviews/E0-T3-review.md`        | ✅ Closed — SA clients, setup.sh sync, simulator auth wired  | March 16, 2026 |


---

---

## EPIC E0: Authentication & Authorization (Keycloak)

**Goal:** Stand up Keycloak as the identity provider and wire it into both the backend API and the frontend so every request is authenticated and role-scoped.

**Architecture:**

- Keycloak runs as a Docker container alongside the other services — it is the *user service* for this system
- A `user-service/` directory holds Keycloak realm config (exported JSON), setup scripts, and seed users for local dev
- The FastAPI backend validates JWTs issued by Keycloak on every protected endpoint
- The React frontend redirects to Keycloak login and stores the access token

**Roles defined in Keycloak:**

- `consumer` — can read contracts they own, approve/reject milestones
- `provider` — can POST to ingest endpoints for their contracts
- `admin` — can onboard contracts, view all data, manage users

**Definition of Done:** Login flow works end-to-end. A `consumer` user cannot access another consumer's contracts. A `provider` token can ingest but cannot read the consumer dashboard endpoints. Bearer token missing → 401. Wrong role → 403.

---

### E0-T1: Keycloak Docker Setup + Realm Configuration

**As a developer, I want Keycloak running in Docker with the MaaSAI realm pre-configured so auth works out of the box on `docker compose up`.**

**Functionality:**

- Add `keycloak` service to `docker-compose.dev.yml`
  - Image: `quay.io/keycloak/keycloak:24`
  - Admin credentials via env: `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`
  - Import realm on startup: `--import-realm` flag pointing to `user-service/realm-export.json`
- Create `user-service/realm-export.json` — the `massai` realm config containing:
  - Realm name: `massai`
  - Client `massai-backend` (confidential, client credentials grant, for backend→Keycloak introspection)
  - Client `massai-frontend` (public, authorization code + PKCE, redirect URIs: `http://localhost:3000/`*)
  - Roles: `consumer`, `provider`, `admin`
- Create `user-service/seed-users.json` — dev users:
  - `consumer-factor@test.com` / `password` → role `consumer`, linked to `contract-factor-001`
  - `provider-factor@test.com` / `password` → role `provider`, linked to `contract-factor-001`
  - `consumer-e4m@test.com` / `password` → role `consumer`, linked to `contract-e4m-001`
  - `provider-tasowheel@test.com` / `password` → role `provider`, linked to `contract-tasowheel-001`
  - `admin@test.com` / `password` → role `admin`
- Create `user-service/setup.sh` — script to import realm + create seed users via Keycloak Admin REST API

**Project structure additions:**

```
user-service/
├── realm-export.json         ← Keycloak realm definition
├── seed-users.json           ← Dev users with contract mappings
└── setup.sh                  ← Import script (runs after Keycloak starts)
```

**Files to create:**

- `user-service/realm-export.json`
- `user-service/seed-users.json`
- `user-service/setup.sh`
- Update `docker-compose.dev.yml` with `keycloak` service and `keycloak-setup` one-shot service

**Testing steps:**

1. `docker compose -f docker-compose.dev.yml up keycloak` → Keycloak starts, accessible at `http://localhost:8080`
2. Open `http://localhost:8080/admin` → login with admin credentials → `massai` realm exists
3. Verify clients `massai-backend` and `massai-frontend` exist in the realm
4. Verify roles `consumer`, `provider`, `admin` exist
5. Verify 5 seed users created with correct roles
6. `docker compose down -v && docker compose up keycloak` → realm re-imported, seed users recreated (idempotent)
7. Obtain a token: `curl -X POST http://localhost:8080/realms/massai/protocol/openid-connect/token -d "client_id=massai-frontend&grant_type=password&username=consumer-factor@test.com&password=password"` → returns `access_token`

---

### E0-T2: Backend JWT Validation Middleware

**As the FastAPI backend, I want every protected endpoint to validate the Keycloak JWT so unauthenticated and unauthorised requests are rejected before reaching business logic.**

**Functionality:**

- Install `python-jose[cryptography]` and `httpx` (to fetch Keycloak JWKS)
- Create `backend/app/core/auth.py`:
  - `get_current_user()` FastAPI dependency — extracts and validates Bearer token from `Authorization` header
  - Fetches Keycloak JWKS from `{KEYCLOAK_URL}/realms/massai/protocol/openid-connect/certs` (cached, refreshed every 10 min)
  - Validates: signature, expiry, issuer, audience
  - Returns `CurrentUser(id, email, roles, contract_ids)` — `contract_ids` extracted from token custom claim
  - Raises `HTTPException(401)` if token missing or invalid
  - Raises `HTTPException(403)` if role check fails
- Create role-check dependencies: `require_consumer()`, `require_provider()`, `require_admin()`
- Apply to all existing endpoints:
  - Ingest endpoints → `require_provider()`
  - Consumer read endpoints → `require_consumer()`
  - Admin endpoints → `require_admin()`
- Add `contract_id` ownership check: consumer can only access contracts in their `contract_ids` claim

**Keycloak custom claim:** Add a mapper in the realm that includes the user's `contract_ids` (set as a user attribute in Keycloak) in the JWT as a custom claim.

**Files to create:**

- `backend/app/core/auth.py`
- `backend/app/core/dependencies.py` — role-check dependency factory
- Update all `backend/app/api/v1/*.py` to use auth dependencies
- `backend/tests/unit/test_auth.py`

**Testing steps:**

1. `GET /api/v1/contracts` without token → HTTP 401
2. `GET /api/v1/contracts` with valid consumer token → HTTP 200, returns only that consumer's contracts
3. `GET /api/v1/contracts` with provider token → HTTP 403
4. `POST /api/v1/ingest/contract-factor-001` with provider token (linked to factor-001) → HTTP 200
5. `POST /api/v1/ingest/contract-e4m-001` with provider token (linked to factor-001 only) → HTTP 403
6. `GET /api/v1/contracts` with expired token → HTTP 401, `"Token expired"`
7. `GET /api/v1/contracts` with a forged token (wrong signature) → HTTP 401
8. Admin token → can access all contracts regardless of `contract_ids`
9. Run `pytest backend/tests/unit/test_auth.py -v` — all pass

---

### E0-T3: Provider Service Account Tokens

**As a provider system (or mock sensor), I want to authenticate using a service account (client credentials flow) rather than a user login so automated systems can push data without a human password.**

**Functionality:**

- Create a Keycloak *service account* client per provider in `realm-export.json`:
  - `provider-factor-sa` (client credentials grant, `provider` role)
  - `provider-tasowheel-sa` (client credentials grant, `provider` role)
  - `provider-e4m-sa` (client credentials grant, `provider` role)
- Each service account has a `contract_ids` attribute matching its pilot's contracts
- Mock sensors and background simulators authenticate using client credentials:
  ```
  POST /realms/massai/protocol/openid-connect/token
  grant_type=client_credentials
  client_id=provider-factor-sa
  client_secret={secret}
  ```
- Token cached in simulator until near expiry, then refreshed automatically
- Create `backend/app/core/token_cache.py` — thin helper that holds and auto-refreshes a service account token

**Files to create:**

- Update `user-service/realm-export.json` with service account clients
- `backend/app/core/token_cache.py`
- Update `mock-sensors/base_simulator.py` to authenticate before pushing
- Update `docker-compose.dev.yml` — add `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET` env vars to each simulator service

**Testing steps:**

1. `curl -X POST http://localhost:8080/realms/massai/protocol/openid-connect/token -d "grant_type=client_credentials&client_id=provider-factor-sa&client_secret=..."` → returns access token with `provider` role
2. Use that token to POST to ingest endpoint → HTTP 200
3. Use `provider-factor-sa` token to call consumer `GET /contracts` endpoint → HTTP 403
4. Simulator starts → logs "Authenticated as provider-factor-sa"
5. Simulate token expiry (set short lifetime) → simulator auto-refreshes and continues pushing without error
6. Simulator sends update with no token → ingest endpoint returns 401

---

### E0-T4: Frontend Auth (Keycloak Login Flow + Protected Routes)

**As a consumer, I want to log in via Keycloak and have my session managed automatically so I don't need to think about tokens.**

**Functionality:**

- Install `keycloak-js` (official Keycloak JS adapter)
- Create `frontend/src/auth/keycloak.ts` — Keycloak instance config (realm, client, URL from env)
- Create `frontend/src/auth/AuthProvider.tsx` — React context provider that:
  - Initialises Keycloak on mount with `check-sso` flow
  - Exposes `isAuthenticated`, `user`, `token`, `login()`, `logout()`
  - Auto-refreshes token 30 seconds before expiry
- Wrap entire app in `AuthProvider`
- Create `frontend/src/components/ProtectedRoute.tsx` — redirects to Keycloak login if not authenticated
- Wrap all dashboard routes with `ProtectedRoute`
- Simulator route additionally checks for `admin` role
- API client (`src/api/client.ts`) automatically attaches `Authorization: Bearer {token}` header on every request
- Login page: not a custom page — Keycloak handles login UI; app redirects to Keycloak and back
- After login, user's name shown in dashboard header with logout button

**Files to create:**

- `frontend/src/auth/keycloak.ts`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- Update `frontend/src/api/client.ts` to inject token
- Update `frontend/src/router.tsx` to wrap routes with `ProtectedRoute`
- Update `frontend/src/layouts/DashboardLayout.tsx` to show user name + logout button

**Testing steps:**

1. Open `http://localhost:3000/contracts` while not logged in → redirected to Keycloak login page
2. Login as `consumer-factor@test.com` → redirected back to `/contracts`, dashboard loads
3. Dashboard header shows "[consumer-factor@test.com](mailto:consumer-factor@test.com)" and a Logout button
4. Click Logout → redirected to Keycloak logout → session cleared → redirected back to login
5. Login as `consumer-e4m@test.com` → can only see E4M contract (not Factor or Tasowheel)
6. Login as `admin@test.com` → can see all 3 contracts
7. Token auto-refreshes → no unexpected logout after 5 minutes
8. All API calls include `Authorization: Bearer ...` header (verify in browser devtools Network tab)

---

---

## EPIC E1: Infrastructure & Project Setup

**Goal:** Get the full project scaffolded, running, and seeded with realistic test data for all 3 pilots.

**Definition of Done:** `docker compose -f docker-compose.dev.yml up` brings up all services with no errors. Database is seeded with 3 contracts (one per pilot). Backend health check returns 200.

---

### E1-T1: Monorepo Scaffold + Docker Compose

**As a developer, I want the project structure and Docker environment set up so every service can be started with a single command.**

**Functionality:**

- Create monorepo root with `backend/`, `frontend/`, `mock-sensors/`, `docs/` directories
- Create `docker-compose.dev.yml` with services: `postgres`, `backend`, `frontend`, `mock-factor`, `mock-tasowheel`, `mock-e4m`
- Create `.env.example` with all required environment variables documented
- Create root `README.md` with setup instructions

**Files to create:**

- `docker-compose.dev.yml`
- `docker-compose.yml` (production stub)
- `.env.example`
- `README.md`
- `backend/Dockerfile`
- `frontend/Dockerfile.dev`
- `mock-sensors/Dockerfile`

**Testing steps:**

1. Run `docker compose -f docker-compose.dev.yml up postgres` — postgres container starts, port 5432 accessible
2. Run `docker compose -f docker-compose.dev.yml up` — all containers start without errors
3. Run `curl http://localhost:8000/health` — returns `{"status": "ok"}`
4. Run `curl http://localhost:3000` — frontend dev server responds
5. Verify `.env.example` contains: `DATABASE_URL`, `BLOCKCHAIN_ADAPTER`, `ENVIRONMENT`, `API_URL` (for simulators)

---

### E1-T2: Backend Project Init (FastAPI + uv)

**As a developer, I want the FastAPI backend bootstrapped with uv, with a working health endpoint and project structure.**

**Functionality:**

- Initialise Python project with `uv init` in `backend/`
- Add dependencies: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pydantic-settings`, `jsonschema`, `python-jose`
- Create `app/main.py` with FastAPI app, CORS middleware, and `GET /health` endpoint
- Create `app/core/config.py` using `pydantic-settings` — reads from env
- Create `app/core/database.py` — async SQLAlchemy engine + session factory
- Structured JSON logging configured from startup

**Files to create:**

- `backend/pyproject.toml`
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/app/api/__init__.py`
- `backend/app/api/v1/router.py`

**Testing steps:**

1. Run `uv run uvicorn app.main:app --reload` from `backend/` — server starts on port 8000
2. `GET /health` → `{"status": "ok", "environment": "development"}`
3. `GET /docs` → FastAPI Swagger UI loads
4. `GET /api/v1/` → returns API version info
5. Confirm structured JSON logs appear in terminal on each request

---

### E1-T3: Database Schema + Migrations

**As a developer, I want the PostgreSQL schema created via Alembic migrations so the database is always in a known, versioned state.**

**Functionality:**

- Create Alembic setup in `backend/migrations/`
- Create initial migration with all 5 core tables: `contracts`, `milestones`, `status_updates`, `alerts`, `blockchain_events`
- All tables use UUID primary keys
- `contracts.config` is a JSONB column for pilot-specific config
- `milestones.evidence` is a JSONB array column
- `alerts.blockchain_logged` boolean defaults to false

**Schema (exact):**

```sql
contracts (id UUID PK, blockchain_contract_address VARCHAR, pilot_type VARCHAR,
  agreement_type VARCHAR, status VARCHAR, provider_id VARCHAR, consumer_id VARCHAR,
  product_name VARCHAR, quantity_total INTEGER, delivery_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(), activated_at TIMESTAMPTZ, config JSONB)

milestones (id UUID PK, contract_id UUID FK→contracts, milestone_ref VARCHAR,
  name VARCHAR, planned_date DATE, actual_date DATE, status VARCHAR DEFAULT 'PENDING',
  approval_required BOOLEAN DEFAULT false, completion_criteria JSONB, evidence JSONB DEFAULT '[]')

status_updates (id UUID PK, contract_id UUID FK→contracts, update_type VARCHAR,
  sensor_id VARCHAR, timestamp TIMESTAMPTZ, payload JSONB, processed BOOLEAN DEFAULT false)

alerts (id UUID PK, contract_id UUID FK→contracts, rule_id VARCHAR,
  condition_description TEXT, severity VARCHAR, triggered_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, blockchain_logged BOOLEAN DEFAULT false)

blockchain_events (id UUID PK, contract_id UUID FK→contracts, event_type VARCHAR,
  transaction_hash VARCHAR, block_number BIGINT, event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now())
```

**Files to create:**

- `backend/migrations/env.py`
- `backend/migrations/versions/0001_initial_schema.py`
- `backend/app/models/contract.py`
- `backend/app/models/milestone.py`
- `backend/app/models/status_update.py`
- `backend/app/models/alert.py`
- `backend/app/models/blockchain_event.py`

**Testing steps:**

1. Run `uv run alembic upgrade head` — migration runs without errors
2. Connect to PostgreSQL: `psql -U massai massai_monitoring`
3. Run `\dt` — all 5 tables exist
4. Run `\d contracts` — confirm all columns present with correct types
5. Run `\d milestones` — confirm `evidence JSONB DEFAULT '[]'`
6. Run `uv run alembic downgrade -1` then `upgrade head` — idempotent, no errors

---

### E1-T4: Database Seed Data (3 Pilot Contracts)

**As a developer, I want the database seeded with one realistic contract per pilot so I can test without any real data sources.**

**Functionality:**

- Create `backend/app/seeds/seed.py` script runnable with `uv run python -m app.seeds.seed`
- Seed 3 contracts: `contract-factor-001`, `contract-tasowheel-001`, `contract-e4m-001`
- Each contract has 3–6 realistic milestones with planned dates in the future
- Factor contract: 4 milestones (Turning, Heat Treatment, Grinding, Inspection)
- Tasowheel contract: 4 milestones matching routing steps
- E4M contract: 6 milestones (M1–M6), M2/M3/M5/M6 have `approval_required: true`
- Seed is idempotent — re-running does not create duplicates

**Files to create:**

- `backend/app/seeds/seed.py`
- `backend/app/seeds/data/factor_contract.json`
- `backend/app/seeds/data/tasowheel_contract.json`
- `backend/app/seeds/data/e4m_contract.json`

**Testing steps:**

1. Run `uv run python -m app.seeds.seed` — prints "Seeded 3 contracts, 13 milestones"
2. Query: `SELECT pilot_type, status, product_name FROM contracts` — 3 rows, one per pilot
3. Query: `SELECT name, approval_required FROM milestones WHERE contract_id = '<e4m-id>'` — M2, M3, M5, M6 have `approval_required = true`
4. Run seed again — row counts unchanged (idempotent)
5. `GET /api/v1/contracts` → returns 3 contracts in JSON

---

### E1-T5: Standardised API Response Envelope

**As a frontend developer, I want every API response to follow the same structure so I can handle success and errors consistently without guessing the shape.**

**Functionality:**

- All API responses wrapped in a consistent envelope:
  ```json
  // Success
  { "data": { ... }, "meta": { "timestamp": "...", "version": "1" } }

  // Error
  { "error": { "code": "CONTRACT_NOT_FOUND", "message": "Contract not found", "details": [] }, "meta": { "timestamp": "...", "version": "1" } }
  ```
- Create `backend/app/core/response.py` — `success(data, meta=None)` and `error(code, message, details=None)` helper functions
- Create a custom FastAPI exception handler that catches all `HTTPException` and unhandled exceptions, formats them into the error envelope
- All existing endpoint responses refactored to use `success()` helper
- Validation errors (422) formatted as error envelope with `details` array listing each field error
- `meta.timestamp` is always UTC ISO8601
- `meta.version` is `"1"` — bump if breaking API changes are introduced

**Files to create:**

- `backend/app/core/response.py`
- `backend/app/core/exception_handlers.py`
- Update `backend/app/main.py` to register exception handlers
- `backend/tests/unit/test_response_envelope.py`

**Testing steps:**

1. `GET /api/v1/contracts` → response has top-level `data` array and `meta.timestamp`
2. `GET /api/v1/contracts/nonexistent` → response has `error.code = "CONTRACT_NOT_FOUND"`, `error.message` is human-readable, HTTP 404
3. `POST /api/v1/ingest/contract-factor-001` with invalid schema → response has `error.code = "VALIDATION_ERROR"`, `error.details` lists each invalid field
4. No endpoint returns a raw string, raw array, or un-enveloped object
5. Unhandled exception (simulate by raising `RuntimeError` in a test endpoint) → returns `error.code = "INTERNAL_ERROR"`, HTTP 500, no stack trace in response body
6. Run `pytest backend/tests/unit/test_response_envelope.py -v` — all pass

---

### E1-T6: Error Handling Strategy

**As the system, I want all failure modes handled gracefully so the platform never crashes silently or returns unformatted errors.**

**Functionality:**

- Database unavailable → `GET /health` returns `{"status": "degraded", "db": "unreachable"}`, all data endpoints return HTTP 503 with error envelope
- Blockchain write fails after 3 retries → error logged with full context, alert saved to DB with `blockchain_logged: false`, API response is still 200 (blockchain is async — failure must not fail the user request)
- WebSocket client disconnects mid-message → connection cleaned up silently, no server error log
- Ingest payload is not valid JSON (parse error, not schema error) → HTTP 400 `"INVALID_JSON"`
- Keycloak unreachable → backend starts in degraded mode with warning log; auth middleware returns 503 with `"AUTH_SERVICE_UNAVAILABLE"`
- All unhandled exceptions → logged with full traceback at ERROR level, response is 500 with generic message (no stack trace exposed)
- Create `backend/app/core/health.py` — liveness and readiness check endpoints
  - `GET /health` — always 200 (liveness)
  - `GET /health/ready` — checks DB + Keycloak reachability, returns 503 if either down

**Files to create:**

- `backend/app/core/health.py`
- Update `backend/app/main.py` to register `/health` and `/health/ready` routes
- `backend/tests/integration/test_error_handling.py`

**Testing steps:**

1. `GET /health` → always HTTP 200 even if DB is down
2. `GET /health/ready` with DB running → HTTP 200, `{"db": "ok", "auth": "ok"}`
3. Stop postgres container → `GET /health/ready` → HTTP 503, `{"db": "unreachable", "auth": "ok"}`
4. `POST /api/v1/ingest/...` with body `"not json"` → HTTP 400, `error.code = "INVALID_JSON"`
5. Blockchain mock configured to always fail → POST ingest succeeds (200), blockchain_events row has `transaction_hash = null`, error appears in logs
6. Kill Keycloak container → backend logs warning, `GET /health/ready` returns 503 with `"auth": "unreachable"`

---

---

## EPIC E2: Provider Ingest API

**Goal:** Build the generic HTTP endpoint that factory systems (or mock sensors) push production updates to. Validates payload against pilot-specific JSON schema and processes the update.

**Definition of Done:** All 3 pilot payload types accepted and validated. Invalid payloads return structured errors. Successful ingest saves to DB and triggers rule engine evaluation.

---

### E2-T1: Pilot JSON Schemas

**As a developer, I want JSON Schema files for each pilot type so incoming payloads can be validated without code changes when a new pilot is added.**

**Functionality:**

- Create 3 JSON Schema files in `backend/app/pilot_schemas/`
- Each schema validates the `payload` field of an ingest request for that pilot
- Factor schema: requires `quantityProduced` (int), `quantityPlanned` (int), `currentStage` (enum), `qualityPassRate` (float 0–1), optional: `machineUtilization`, `qualityRejectCount`, `shiftsCompleted`, `estimatedCompletionDate`
- Tasowheel schema: requires `routingStep` (int), `stepName` (string), `stepStatus` (enum: IN_PROGRESS, COMPLETE), optional: `setupTimeActualMin`, `cycleTimeActualSec`, `downtimeMinutes`, `energyKwh`, `carbonKgCo2e`
- E4M schema: requires `currentPhase` (enum: M1–M6), `completionPct` (int 0–100), optional: `approvalRequired` (bool), `deliverables` (array), `testResults` (array), `issues` (array)

**Files to create:**

- `backend/app/pilot_schemas/factor_update.json`
- `backend/app/pilot_schemas/tasowheel_update.json`
- `backend/app/pilot_schemas/e4m_update.json`
- `backend/app/core/schema_validator.py` — loads and caches schemas, exposes `validate(pilot_type, payload)`

**Testing steps:**

1. Unit test: valid Factor payload passes validation
2. Unit test: Factor payload with `qualityPassRate: 1.5` (> 1) fails with field error
3. Unit test: Factor payload missing `quantityProduced` fails with "required field" error
4. Unit test: valid Tasowheel payload passes
5. Unit test: E4M payload with `completionPct: 110` fails
6. Unit test: unknown pilot type raises `SchemaNotFoundError`
7. Run `pytest backend/tests/unit/test_schema_validator.py -v` — all pass

---

### E2-T2: Ingest Endpoint (Core)

**As a provider system, I want to push a production update via HTTP POST and receive confirmation that it was accepted and processed.**

**Functionality:**

- `POST /api/v1/ingest/{contractId}` — accepts the generic update envelope
- Request body: `updateType` (enum), `timestamp` (ISO8601), `sensorId` (string), `payload` (object — pilot-schema validated), `evidence` (optional array of URL strings)
- Steps on valid request:
  1. Look up contract by `contractId` — 404 if not found
  2. Validate `payload` against `pilot_schemas/{contract.pilot_type}_update.json` — 422 on failure
  3. Save `status_update` row to DB
  4. Return response with `updateId`, `contractId`, `processed: true`
- Authentication: validate `Authorization: Bearer {token}` header — 401 if missing, 403 if invalid

**Files to create:**

- `backend/app/api/v1/ingest.py`
- `backend/app/schemas/ingest.py` (Pydantic request/response models)

**Testing steps:**

1. `POST /api/v1/ingest/contract-factor-001` with valid Factor payload → HTTP 200, `processed: true`
2. `POST /api/v1/ingest/nonexistent-id` → HTTP 404, `error: "Contract not found"`
3. `POST /api/v1/ingest/contract-factor-001` with `qualityPassRate: 2.0` → HTTP 422, error lists field
4. `POST /api/v1/ingest/contract-factor-001` without `Authorization` header → HTTP 401
5. After valid request: `SELECT * FROM status_updates WHERE contract_id = 'contract-factor-001'` — row exists with correct payload
6. Test all 3 pilot types accept their respective valid payloads

---

### E2-T3: Monitoring Service (Update Processing)

**As the system, I want incoming updates processed to keep contract state current and milestones up-to-date.**

**Functionality:**

- `MonitoringService.process_update(update: StatusUpdate)` — called after saving to DB
- For `MILESTONE_COMPLETE` updateType: find matching milestone by `milestone_ref` in payload, update status to `SUBMITTED`, set `actual_date = now()`, attach evidence
- For `PRODUCTION_UPDATE`: update contract's `config.last_known_state` JSONB with latest metrics
- For `PHASE_CHANGE` (E4M): update contract `config.current_phase`
- For `QUALITY_EVENT`: log to alert evaluation queue
- After processing, mark `status_update.processed = true`

**Files to create:**

- `backend/app/services/monitoring.py`
- `backend/tests/unit/test_monitoring_service.py`

**Testing steps:**

1. Unit test: `MILESTONE_COMPLETE` with `milestone_ref: "M1"` → milestone M1 status becomes `SUBMITTED`
2. Unit test: `PRODUCTION_UPDATE` → contract config updated with latest qty and quality values
3. Unit test: `PHASE_CHANGE` with `currentPhase: "M2_CONCEPT"` → contract config `current_phase` updated
4. Unit test: processed update has `processed = true` in DB
5. Integration test: POST ingest → verify milestone status in DB changed
6. Run `pytest backend/tests/unit/test_monitoring_service.py -v` — all pass

---

### E2-T4: Milestone Auto-Verification

**As the system, I want milestones to auto-verify when completion criteria are met and route to consumer approval when required.**

**Functionality:**

- `MilestoneService.evaluate_submission(milestone_id)` — called when a milestone moves to `SUBMITTED`
- Check `milestone.approval_required`:
  - If `false`: run auto-verification (check all `completion_criteria` conditions against latest `status_updates`), if pass → status `COMPLETED`, else → status `REJECTED`
  - If `true`: status stays `SUBMITTED`, send notification to consumer (log to `notifications` table)
- Auto-verification checks:
  - Factor: `qualityPassRate >= criteria.minQualityPassRate` AND `quantityProduced >= quantityPlanned`
  - Tasowheel: `stepStatus == "COMPLETE"`
  - E4M: `completionPct == 100` AND no open `HIGH`/`CRITICAL` issues
- Milestone completion logged to blockchain queue

**Files to create:**

- `backend/app/services/milestone.py`
- `backend/tests/unit/test_milestone_service.py`

**Testing steps:**

1. Unit test: Factor milestone with `approval_required: false`, criteria met → status `COMPLETED`
2. Unit test: Factor milestone with `approval_required: false`, quality below threshold → status `REJECTED`
3. Unit test: E4M M2 milestone (`approval_required: true`) → stays `SUBMITTED`, notification queued
4. Unit test: E4M milestone with open CRITICAL issue → auto-verify fails even at 100%
5. Integration test: POST ingest with `MILESTONE_COMPLETE` for non-approval milestone → DB shows `COMPLETED`
6. Run `pytest backend/tests/unit/test_milestone_service.py -v` — all pass

---

### E2-T5: Consumer Milestone Approval Endpoint

**As a consumer, I want to approve or reject a submitted milestone via the API.**

**Functionality:**

- `POST /api/v1/contracts/{contractId}/milestones/{milestoneId}/approve` — body: `{ "notes": "..." }`
- `POST /api/v1/contracts/{contractId}/milestones/{milestoneId}/reject` — body: `{ "reason": "string (required)" }`
- Approve: milestone status → `APPROVED` → `COMPLETED`, record `actual_date`, log blockchain event
- Reject: milestone status → `REJECTED`, store rejection reason in `evidence` JSONB, notify provider
- 400 if milestone is not in `SUBMITTED` state
- 403 if calling user is not the consumer on this contract

**Files to create:**

- `backend/app/api/v1/milestones.py`
- `backend/app/schemas/milestone.py`

**Testing steps:**

1. `POST /approve` on milestone in `SUBMITTED` state → HTTP 200, milestone status `COMPLETED`
2. `POST /approve` on milestone in `PENDING` state → HTTP 400, `"Milestone not awaiting approval"`
3. `POST /reject` without `reason` field → HTTP 422
4. `POST /reject` with reason → milestone status `REJECTED`, reason stored in `evidence`
5. After approve: `SELECT status FROM milestones WHERE id = ?` → `COMPLETED`
6. After reject: provider notification logged in DB

---

### E2-T6: Python Background Simulators (Autonomous Docker Services)

**As a developer, I want autonomous Python simulator services that push data continuously without any human interaction so CI, long-running demos, and overnight tests work without touching the simulator UI.**

> **Note:** These are separate from the Visual Simulator UI (E5). E5 is interactive (human-driven). These simulators run headlessly in Docker and are configured entirely via environment variables.

**Functionality:**

- Create `mock-sensors/` Python project (uv-managed, separate from backend)
- `base_simulator.py` — shared logic:
  - Authenticates with Keycloak via client credentials (E0-T3)
  - Loops at `INTERVAL_SECONDS`, loads the active scenario, generates payload, POSTs to ingest API
  - Logs each push: `[FACTOR] Step 3/8 — pushed PRODUCTION_UPDATE → 200 OK, alerts: []`
  - On HTTP error → logs and continues (does not crash)
  - On `STOP_AFTER_STEPS` env set → exits cleanly after N steps (for CI use)
- `factor_simulator.py` — generates Factor payloads, reads scenario from `scenarios/factor_{SCENARIO}.json`
- `tasowheel_simulator.py` — generates Tasowheel payloads
- `e4m_simulator.py` — generates E4M payloads
- Scenario JSON files: `normal`, `delay`, `quality_failure`, `milestone_complete`, `dispute` per pilot

**Scenario file format:**

```json
{
  "scenario": "factor_quality_failure",
  "steps": [
    { "updateType": "PRODUCTION_UPDATE", "payload": { "quantityProduced": 50, "quantityPlanned": 500, "currentStage": "turning", "qualityPassRate": 0.99 } },
    { "updateType": "PRODUCTION_UPDATE", "payload": { "quantityProduced": 100, "qualityPassRate": 0.81 } }
  ]
}
```

**Files to create:**

- `mock-sensors/pyproject.toml`
- `mock-sensors/Dockerfile`
- `mock-sensors/base_simulator.py`
- `mock-sensors/factor_simulator.py`
- `mock-sensors/tasowheel_simulator.py`
- `mock-sensors/e4m_simulator.py`
- `mock-sensors/scenarios/factor_normal.json`
- `mock-sensors/scenarios/factor_delay.json`
- `mock-sensors/scenarios/factor_quality_failure.json`
- `mock-sensors/scenarios/tasowheel_normal.json`
- `mock-sensors/scenarios/tasowheel_downtime.json`
- `mock-sensors/scenarios/e4m_normal.json`
- `mock-sensors/scenarios/e4m_test_failure.json`

**Testing steps:**

1. `docker compose -f docker-compose.dev.yml up mock-factor` → simulator authenticates and starts pushing, logs show each step
2. `SELECT COUNT(*) FROM status_updates WHERE contract_id = 'contract-factor-001'` → count increases every `INTERVAL_SECONDS`
3. Set `SCENARIO=quality_failure` → after step 3, alert appears in DB
4. Set `STOP_AFTER_STEPS=5` → simulator exits after exactly 5 pushes (useful for CI)
5. Kill backend mid-run → simulator logs error, retries on next tick, does not crash
6. All 3 simulators run simultaneously in Docker Compose without conflict

---

### E2-T7: Pilot Extensibility Validation

**As a developer, I want to prove that adding a 4th pilot requires only a new JSON schema file and seed data — no backend code changes.**

**Functionality:**

- Create a test pilot type: `PILOT_TEST` with a simple schema `{ "testValue": integer, "testLabel": string }`
- Add `mock-sensors/pilot_schemas/pilot_test_update.json`
- Seed one test contract with `pilot_type = "PILOT_TEST"` via a test fixture
- Write an integration test that:
  1. Creates contract with new pilot type
  2. POSTs a valid `PILOT_TEST` payload → expect 200
  3. POSTs an invalid `PILOT_TEST` payload → expect 422
  4. Confirms no backend Python files were modified (checked via git diff)

**Files to create:**

- `backend/app/pilot_schemas/pilot_test_update.json`
- `backend/tests/integration/test_pilot_extensibility.py`

**Testing steps:**

1. Run `pytest backend/tests/integration/test_pilot_extensibility.py -v` — all pass
2. Verify `git diff --name-only` shows only the new schema JSON file and test file — no changes to `ingest.py`, `monitoring.py`, or any service
3. Ingest with valid payload → 200
4. Ingest with missing required field → 422, field name in error details
5. Remove `pilot_test_update.json` → ingest returns HTTP 400 `"SCHEMA_NOT_FOUND"` (not a crash)

---

---

## EPIC E3: Consumer Read API & WebSocket

**Goal:** Build all read-only endpoints the consumer dashboard uses to display contract state, milestones, alerts, timeline, and analytics. Add WebSocket for live updates.

**Definition of Done:** All GET endpoints return correct data for seeded contracts. WebSocket delivers a push message to connected client within 1 second of an ingest event.

---

### E3-T1: Contract List & Overview Endpoints

**As a consumer, I want to list all my contracts and view a single contract's current state via the API.**

**Functionality:**

- `GET /api/v1/contracts` — returns paginated list: id, pilot_type, status, product_name, provider_id, delivery_date, milestone progress (`done/total`)
- `GET /api/v1/contracts/{id}` — returns full contract overview: all list fields + last_known_state from config, next upcoming milestone (name + planned_date + days remaining)
- Status badge logic: `ON_TRACK` (no overdue milestones, no HIGH alerts), `DELAYED` (overdue milestone), `ACTION_REQUIRED` (milestone awaiting consumer approval), `COMPLETED`, `DISPUTED`
- No blockchain terms in response — `blockchain_contract_address` not included in consumer response

**Files to create:**

- `backend/app/api/v1/contracts.py`
- `backend/app/schemas/contract.py`

**Testing steps:**

1. `GET /api/v1/contracts` → returns array of 3 seeded contracts
2. Each contract object has: `id`, `status`, `productName`, `pilotType`, `deliveryDate`, `milestonesCompleted`, `milestonesTotal`
3. Response contains NO field named `blockchain_contract_address` or `transactionHash`
4. `GET /api/v1/contracts/contract-e4m-001` → includes `nextMilestone` object
5. Approve milestone M2 for E4M contract → `GET /api/v1/contracts/contract-e4m-001` shows updated `milestonesCompleted`
6. `GET /api/v1/contracts/nonexistent` → HTTP 404

---

### E3-T2: Milestones & Timeline Endpoints

**As a consumer, I want to view all milestones for a contract with their current statuses and evidence.**

**Functionality:**

- `GET /api/v1/contracts/{id}/milestones` — returns all milestones ordered by `planned_date`
- `GET /api/v1/contracts/{id}/milestones/{mId}` — single milestone with full `evidence` array
- `GET /api/v1/contracts/{id}/timeline` — all events chronologically: milestone changes + alerts + blockchain events, each with `timestamp`, `type`, `description` (human-readable), `icon` hint
- Timeline descriptions are plain English: "Milestone 'Turning' marked complete", not "STATE_TRANSITION: SUBMITTED→COMPLETED"
- Each milestone includes `isOverdue` boolean (planned_date < today AND status not COMPLETED)

**Files to create:**

- Extend `backend/app/api/v1/milestones.py`
- `backend/app/schemas/timeline.py`
- `backend/app/api/v1/timeline.py`

**Testing steps:**

1. `GET /api/v1/contracts/contract-factor-001/milestones` → 4 milestones, ordered by planned_date
2. E4M milestones: M2, M3, M5, M6 have `approvalRequired: true`
3. `GET /api/v1/contracts/contract-factor-001/timeline` → events array, all `description` fields are human-readable
4. Set a milestone's `planned_date` to yesterday → `isOverdue: true` appears
5. `GET /api/v1/contracts/{id}/milestones/{mId}` → includes `evidence` array (empty array if none)
6. Timeline events contain NO blockchain jargon

---

### E3-T3: Alerts Endpoints

**As a consumer, I want to view active alerts and their history, and acknowledge alerts I've seen.**

**Functionality:**

- `GET /api/v1/contracts/{id}/alerts` — active (unacknowledged) alerts, ordered by severity then triggered_at
- `GET /api/v1/contracts/{id}/alerts/history` — all alerts ever, with optional `?severity=HIGH` filter and `?from=&to=` date range
- `POST /api/v1/contracts/{id}/alerts/{aId}/acknowledge` — sets `acknowledged_at = now()`, moves alert out of active list
- Alert severity ordering: CRITICAL first, then HIGH, MEDIUM, LOW
- Alert descriptions plain English: "No production update received for 12 hours (expected: every 4 hours)"

**Files to create:**

- `backend/app/api/v1/alerts.py`
- `backend/app/schemas/alert.py`

**Testing steps:**

1. Seed an alert for `contract-factor-001` → `GET /alerts` returns it
2. `POST /acknowledge` → `GET /alerts` no longer shows it; `GET /alerts/history` still shows it
3. `GET /alerts/history?severity=HIGH` → only HIGH alerts returned
4. `GET /alerts/history?from=2026-01-01&to=2026-01-31` → date range filter works
5. CRITICAL alert appears before HIGH in the list
6. Alert description contains no error codes or technical identifiers

---

### E3-T4: Analytics Endpoint

**As a consumer, I want to see KPI metrics for my contract so I can measure production performance against plan.**

**Functionality:**

- `GET /api/v1/contracts/{id}/analytics` — returns pilot-adaptive KPI object
- Factor: `automatedUpdatesPct` (count status_updates / expected updates), `qualityPassRateAvg` (average over all updates), `scheduleAdherence` (% milestones on time)
- Tasowheel: `totalDowntimeMinutes`, `avgCycleTimeEfficiency` (planned/actual ratio), `totalEnergyKwh`, `totalCarbonKgCo2e`, `resourceUtilisationPct`
- E4M: `phasesCompleted`, `avgPhaseCompletionDays`, `testPassRate` (from all test results), `openIssueCount`
- All pilots: `overallProgress` (milestones done / total), `daysUntilDelivery`, `isOnTrack` (bool)

**Files to create:**

- `backend/app/api/v1/analytics.py`
- `backend/app/services/analytics.py`
- `backend/app/schemas/analytics.py`

**Testing steps:**

1. `GET /analytics` for Factor contract → response includes `automatedUpdatesPct`, `qualityPassRateAvg`
2. `GET /analytics` for Tasowheel contract → response includes `totalEnergyKwh`, `totalCarbonKgCo2e`
3. `GET /analytics` for E4M contract → response includes `testPassRate`, `openIssueCount`
4. All three responses include `overallProgress` and `daysUntilDelivery`
5. After posting 5 Factor updates → `qualityPassRateAvg` reflects average of all 5 quality values
6. After a test failure in E4M → `testPassRate` decreases

---

### E3-T5: WebSocket — Real-Time Push

**As a consumer UI, I want to receive live push updates when new production data arrives so the dashboard updates without page refresh.**

**Functionality:**

- `WS /ws/contracts/{contractId}` — consumer connects to get live updates for one contract
- On each ingest event for that contractId, backend broadcasts a message to all connected clients
- Message types: `UPDATE_RECEIVED`, `MILESTONE_CHANGED`, `ALERT_TRIGGERED`, `CONTRACT_STATE_CHANGED`
- Message payload: `{ "type": "ALERT_TRIGGERED", "data": { "severity": "HIGH", "description": "..." }, "timestamp": "..." }`
- Clients disconnecting cleanly handled (no errors on orphan connections)
- Multiple clients can connect to the same contract simultaneously

**Files to create:**

- `backend/app/api/v1/websocket.py`
- `backend/app/core/connection_manager.py` — manages active WebSocket connections per contractId

**Testing steps:**

1. Connect WebSocket client to `ws://localhost:8000/ws/contracts/contract-factor-001`
2. POST a valid ingest update → WebSocket client receives message within 1 second
3. Message has `type`, `data`, `timestamp` fields
4. Connect two clients to same contract → both receive the message
5. Disconnect one client → second client continues receiving; no server error
6. Connect to non-existent contract → WebSocket accepts connection but sends `CONTRACT_NOT_FOUND` message then closes

---

### E3-T6: Documents API Endpoint

**As a consumer, I want to retrieve all documents and evidence files associated with a contract via the API so the Documents page has data to display.**

**Functionality:**

- `GET /api/v1/contracts/{id}/documents` — returns flat list of all documents across all milestones for this contract
- Each document entry: `{ "id", "milestoneId", "milestoneName", "name", "url", "format", "uploadedAt" }`
- Documents sourced from `milestones.evidence` JSONB array — aggregated across all milestones
- Ordered by `uploadedAt` descending
- Optional filter: `?milestoneId=M2` to get documents for a specific milestone
- `GET /api/v1/contracts/{id}/milestones/{mId}/documents` — documents for a single milestone
- This service stores **references only** (URLs) — actual files live in external storage (S3/IPFS). No file upload handled here.

**Files to create:**

- `backend/app/api/v1/documents.py`
- `backend/app/schemas/document.py`

**Testing steps:**

1. Seed a milestone with `evidence: [{"name": "inspection.pdf", "url": "https://...", "format": "PDF", "uploadedAt": "..."}]`
2. `GET /api/v1/contracts/contract-factor-001/documents` → returns that document
3. `GET /api/v1/contracts/contract-e4m-001/documents?milestoneId=M2` → returns only M2 documents
4. Contract with no evidence → returns empty array (not 404)
5. Response fields: `id`, `milestoneId`, `milestoneName`, `name`, `url`, `format`, `uploadedAt`
6. Auth: consumer token for wrong contract → 403

---

### E3-T7: Audit Export Endpoint

**As a consumer or auditor, I want to export a complete audit trail of a contract as a structured JSON or PDF report.**

**Functionality:**

- `GET /api/v1/contracts/{id}/audit-export` — returns full audit trail as JSON
  - Contract metadata (no blockchain address in response)
  - All timeline events in chronological order
  - All milestones with statuses, completion dates, evidence
  - All alerts (active and resolved) with acknowledgement timestamps
  - Blockchain-verified events marked with `"blockchainVerified": true` and `"verifiedAt"` timestamp
  - Blockchain transaction hashes included **only** in this endpoint (for auditors)
- `GET /api/v1/contracts/{id}/audit-export?format=pdf` — same data as PDF (use `weasyprint` or return structured JSON for frontend-driven PDF generation via `window.print()`)
- Requires `admin` OR `consumer` role (consumers can export their own contracts)

**Files to create:**

- `backend/app/api/v1/audit.py`
- `backend/app/schemas/audit.py`
- `backend/app/services/audit.py` — assembles the full audit object from DB

**Testing steps:**

1. `GET /api/v1/contracts/contract-factor-001/audit-export` → returns JSON with all fields
2. Response includes `milestones` array with evidence, `alerts` array, `timelineEvents` array
3. A blockchain-confirmed milestone has `"blockchainVerified": true` and a `transactionHash`
4. The main consumer dashboard endpoints (`GET /contracts`, `GET /milestones`) still contain NO `transactionHash` field
5. `GET .../audit-export` with provider token → HTTP 403
6. Export contains `"exportedAt"` timestamp and `"contractId"`

---

### E3-T8: Admin Contract Onboarding + Blockchain Sync

**As an admin, I want to register a new contract by providing its blockchain address so monitoring begins automatically without manual DB seeding.**

**Functionality:**

- `POST /api/v1/admin/contracts` — body: `{ "blockchainContractAddress": "0x...", "pilotType": "FACTOR|TASOWHEEL|E4M" }`
- Requires `admin` role
- Steps:
  1. Validate contract address format
  2. Call `BlockchainService.get_contract_metadata(address)` → pulls agreement data from MSB (or mock)
  3. If mock adapter: return pre-defined fixture data keyed by address
  4. If real adapter: call `entrynet-maasai.euinno.eu` JSON-RPC to read contract state
  5. Create `contracts` row in DB from blockchain metadata
  6. Create `milestones` rows from agreement's schedule data
  7. Set alert rules from agreement's `alertConditions`
  8. Return created contract with DB id
- `GET /api/v1/admin/contracts` — list all contracts (admin only)
- `GET /api/v1/admin/contracts/{id}/blockchain-sync` — re-sync a contract's state from blockchain (manual refresh)

**Blockchain metadata the mock returns:**

```json
{
  "agreementId": "...",
  "pilotType": "FACTOR",
  "providerName": "Factor External Supplier S.L.",
  "consumerName": "Factor Ingeniería y Decoletaje SL",
  "productName": "Helical Gear Type A - Batch 500",
  "quantityTotal": 500,
  "deliveryDate": "2026-06-01",
  "milestones": [...],
  "alertConditions": [...],
  "contractStatus": "ACTIVE"
}
```

**Files to create:**

- `backend/app/api/v1/admin.py`
- `backend/app/schemas/admin.py`
- `backend/app/services/contract_onboarding.py`
- Update `backend/app/core/blockchain.py` — add `get_contract_metadata(address)` to the Protocol
- Update `backend/app/services/blockchain_mock.py` — return fixture metadata for known test addresses
- `backend/tests/integration/test_admin_onboarding.py`

**Testing steps:**

1. `POST /api/v1/admin/contracts` with a known mock address + `pilotType: FACTOR` → HTTP 201, contract created
2. `GET /api/v1/contracts` as the relevant consumer → new contract appears
3. `GET /api/v1/contracts/{newId}/milestones` → milestones pre-populated from blockchain metadata
4. `POST /api/v1/admin/contracts` without admin token → HTTP 403
5. `POST /api/v1/admin/contracts` with invalid address format → HTTP 400
6. `POST /api/v1/admin/contracts` with address already registered → HTTP 409 `"CONTRACT_ALREADY_EXISTS"`
7. `GET /api/v1/admin/contracts/{id}/blockchain-sync` → re-reads blockchain, updates status if changed

---

---

## EPIC E4: Alert & Rule Engine

**Goal:** Build the rule engine that evaluates every incoming update against configured alert conditions and fires structured alerts when thresholds are breached.

**Definition of Done:** All 5 built-in rule types fire correctly for all 3 pilots. No-data alert fires on schedule without any ingest trigger.

---

### E4-T1: Rule Engine Core

**As the system, I want incoming updates evaluated against alert rules so problems are detected automatically without human monitoring.**

**Functionality:**

- `RuleEngine.evaluate(contract_id, update)` — runs all rules configured for this contract
- Built-in rule types (implemented as strategy classes):
  - `NO_DATA_RECEIVED` — checked by background worker, not per-update (see E4-T3)
  - `QUALITY_THRESHOLD` — fires when `qualityPassRate < threshold`
  - `DELAY` — fires when production progress is behind schedule by `> N days`
  - `TEST_FAILURE` — fires when any E4M `testResults[].result == "FAIL"`
  - `MILESTONE_OVERDUE` — fires when milestone `planned_date < today` and status not `COMPLETED`
- Each rule returns `AlertResult(triggered: bool, severity, description)` or `None`
- When triggered: create `Alert` record, set `blockchain_logged = false` if severity < HIGH, queue blockchain write if HIGH/CRITICAL

**Files to create:**

- `backend/app/services/rule_engine.py`
- `backend/app/services/rules/quality_threshold.py`
- `backend/app/services/rules/delay_rule.py`
- `backend/app/services/rules/test_failure.py`
- `backend/app/services/rules/milestone_overdue.py`
- `backend/tests/unit/test_rule_engine.py`

**Testing steps:**

1. Unit test: Factor update with `qualityPassRate: 0.80` (threshold 0.95) → `QUALITY_THRESHOLD` alert fires, severity HIGH
2. Unit test: Factor update with `qualityPassRate: 0.97` → no alert
3. Unit test: E4M update with `testResults: [{result: "FAIL"}]` → `TEST_FAILURE` alert fires, severity CRITICAL
4. Unit test: E4M update with all tests passing → no alert
5. Unit test: milestone with `planned_date` yesterday and status `IN_PROGRESS` → `MILESTONE_OVERDUE` fires
6. Integration test: POST Factor ingest with failing quality → alert row appears in DB
7. Run `pytest backend/tests/unit/test_rule_engine.py -v` — all pass

---

### E4-T2: Alert Severity & Blockchain Logging

**As the system, I want HIGH and CRITICAL alerts logged on the blockchain so they form an immutable audit record.**

**Functionality:**

- `BlockchainService` interface with two implementations:
  - `MockMSBService` — writes to SQLite file at `mock_msb/events.db`, returns deterministic fake tx hash `0xmock{uuid[:8]}`
  - `RealMSBService` — connects to `https://entrynet-maasai.euinno.eu` via `web3.py`, submits event log transaction
- Controlled via `BLOCKCHAIN_ADAPTER=mock|real` env var
- Alert creation: if `severity in (HIGH, CRITICAL)` → async background task writes event to blockchain
- Blockchain event record saved to `blockchain_events` table with real or fake `transaction_hash`
- Failed blockchain write → retry up to 3 times with exponential backoff, then log error (do NOT fail the API request)

**Files to create:**

- `backend/app/core/blockchain.py` (Protocol + factory function)
- `backend/app/services/blockchain_mock.py`
- `backend/app/services/blockchain_real.py`
- `backend/tests/unit/test_blockchain_service.py`

**Testing steps:**

1. `BLOCKCHAIN_ADAPTER=mock`: fire HIGH alert → `blockchain_events` table has row with `transaction_hash` starting with `0xmock`
2. `BLOCKCHAIN_ADAPTER=mock`: LOW alert → no `blockchain_events` row created
3. `BLOCKCHAIN_ADAPTER=real`: `web3.is_connected()` returns True for `entrynet-maasai.euinno.eu`
4. Mock blockchain write failure (3 times) → error logged, API still returns 200, alert still saved to DB
5. `GET /api/v1/contracts/{id}/alerts/history` → HIGH alert has `blockchainVerified: true` in response

---

### E4-T3: No-Data-Received Background Worker

**As the system, I want a background job that detects when a provider has stopped sending data so the consumer is alerted even without an ingest trigger.**

**Functionality:**

- Background task runs every 5 minutes (configurable)
- For each `IN_PROGRESS` contract: check `last status_update timestamp` vs `config.dataUpdateFrequency`
- If `now() - last_update > 2 × dataUpdateFrequency` AND no existing unresolved `NO_DATA_RECEIVED` alert → fire alert
- Alert severity: MEDIUM if overdue by < 3× interval, HIGH if overdue by > 3× interval
- Alert auto-resolves when new update received for that contract

**Files to create:**

- `backend/app/workers/no_data_checker.py`
- Background task registered in `app/main.py` as lifespan event

**Testing steps:**

1. Set contract `dataUpdateFrequency` to 1 minute, do not send any updates
2. Wait 3 minutes → `GET /alerts` shows `NO_DATA_RECEIVED` alert (MEDIUM severity)
3. Wait 4 more minutes → severity upgrades to HIGH
4. POST a valid ingest update → alert `resolved_at` is set; `GET /alerts` no longer shows it as active
5. Worker runs again → no duplicate alert created (idempotent)
6. `GET /alerts/history` → resolved alert still visible with `resolved_at` timestamp

---

### E4-T4: Notification Delivery Service

**As a consumer or provider, I want to receive notifications when important events happen so I don't need to keep the dashboard open to stay informed.**

**Functionality:**

- Create `backend/app/services/notification.py` — `NotificationService.send(recipient_id, event_type, message, contract_id)`
- Two delivery channels (both implemented, configurable per environment):
  - **In-app:** Write to `notifications` table; consumer UI polls or receives via WebSocket
  - **Email (optional):** Send via SMTP if `SMTP_HOST` env var set; silently skipped if not configured
- Notification triggers (called from existing services):
  - `MILESTONE_AWAITING_APPROVAL` → notify consumer
  - `MILESTONE_APPROVED` / `MILESTONE_REJECTED` → notify provider
  - `ALERT_TRIGGERED` (HIGH/CRITICAL) → notify consumer
  - `CONTRACT_STATE_CHANGED` → notify both parties
  - `NO_DATA_RECEIVED` → notify consumer
- New DB table:
  ```sql
  notifications (id UUID PK, recipient_id VARCHAR, contract_id UUID FK,
    event_type VARCHAR, message TEXT, read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now())
  ```
- `GET /api/v1/notifications` — returns unread notifications for current user
- `POST /api/v1/notifications/{id}/read` — marks as read
- Unread count included in `GET /api/v1/contracts` response meta for badge display

**Files to create:**

- `backend/app/services/notification.py`
- `backend/app/models/notification.py`
- `backend/app/api/v1/notifications.py`
- `backend/app/schemas/notification.py`
- New Alembic migration: `0002_add_notifications.py`
- `backend/tests/unit/test_notification_service.py`

**Testing steps:**

1. Submit E4M milestone M2 → `GET /api/v1/notifications` as consumer → notification `MILESTONE_AWAITING_APPROVAL` appears
2. Consumer rejects milestone → `GET /api/v1/notifications` as provider → `MILESTONE_REJECTED` with rejection reason appears
3. Trigger HIGH alert → consumer has unread notification
4. `POST /notifications/{id}/read` → `GET /notifications` no longer shows that notification
5. `GET /api/v1/contracts` response includes `meta.unreadNotifications: 3` count
6. `SMTP_HOST` not set → notifications written to DB only, no crash, no email error in logs
7. Run `pytest backend/tests/unit/test_notification_service.py -v` — all pass

---

---

## EPIC E5: Visual Mock Sensor Environment

**Goal:** Build an interactive browser-based UI where a developer or demo user can simulate a factory floor — select a pilot, pick a scenario, view live data flowing, and manually trigger events. This is the dev/testing tool that replaces real factory connections.

**Definition of Done:** User can open the sensor UI, select Factor/Tasowheel/E4M, pick a contract, run a scenario, and see the consumer dashboard update in real time.

> **Note:** This is a separate frontend app (or a protected route in the main app) — **not** visible to consumers. It is the "factory side" simulation tool for development and demos.

---

### E5-T1: Sensor UI Scaffold & Layout

**As a developer, I want a dedicated sensor simulator UI that is clearly separate from the consumer dashboard.**

**Functionality:**

- Add a `/simulator` route to the React app (protected — only available in development mode via `VITE_ENABLE_SIMULATOR=true`)
- Simulator has its own layout: dark theme, "FACTORY SIMULATOR" header badge to distinguish from consumer UI
- Sidebar shows: list of seeded contracts with pilot type icons
- Clicking a contract loads the simulator panel for that contract
- Connection status indicator: shows if backend API is reachable

**Files to create:**

- `frontend/src/pages/simulator/SimulatorLayout.tsx`
- `frontend/src/pages/simulator/SimulatorIndex.tsx`
- `frontend/src/pages/simulator/ContractSimulator.tsx`
- Add `/simulator` route to `frontend/src/router.tsx`

**Testing steps:**

1. Navigate to `http://localhost:3000/simulator` — simulator layout loads (dark theme, "FACTORY SIMULATOR" header)
2. Sidebar shows 3 contracts with pilot type labels: FACTOR, TASOWHEEL, E4M
3. Click Factor contract → right panel shows "Factor Simulator" heading
4. Verify `/simulator` route is NOT linked from consumer dashboard navigation
5. With `VITE_ENABLE_SIMULATOR=false` → route returns 404 or redirects
6. API connection status badge shows green "Connected" when backend is up

---

### E5-T2: Scenario Runner (Automated Playback)

**As a developer, I want to select a pre-built scenario and watch it play out automatically, pushing updates to the backend at realistic intervals.**

**Functionality:**

- Each contract panel shows a "Scenarios" section with available scenarios per pilot:
  - Factor: `Normal Production`, `Quality Failure`, `Production Delay`
  - Tasowheel: `Normal Routing`, `Machine Downtime`
  - E4M: `Normal Development`, `Test Failure at M5`
- Selecting a scenario and clicking "Run" starts automated playback
- Each step in the scenario pushes a payload to `POST /api/v1/ingest/{contractId}`
- Playback speed: configurable slider (1× = real interval, 10× = 10× faster, 100× = near instant)
- Running indicator shows current step: "Step 3/8 — Pushing quality update..."
- Stop button halts playback
- After each step, response (success / error / alerts triggered) shown in a log panel

**Files to create:**

- `frontend/src/pages/simulator/ScenarioRunner.tsx`
- `frontend/src/simulator/scenarios/factor_scenarios.ts`
- `frontend/src/simulator/scenarios/tasowheel_scenarios.ts`
- `frontend/src/simulator/scenarios/e4m_scenarios.ts`
- `frontend/src/simulator/runner.ts` — step executor with configurable interval

**Testing steps:**

1. Select Factor contract → select "Quality Failure" scenario → click Run
2. Log panel shows each step as it executes: payload sent, response received
3. After step where quality drops below threshold → log shows "Alert triggered: QUALITY_THRESHOLD (HIGH)"
4. Open consumer dashboard in another tab → alert appears in Alert Center
5. Click Stop → playback halts; Run again → restarts from step 1
6. At 100× speed → all steps complete in < 5 seconds
7. E4M "Test Failure at M5" scenario → at M5 step, test failure alert appears in consumer dashboard

---

### E5-T3: Manual Update Form

**As a developer, I want to manually fill in a production update form and send it to the backend so I can test edge cases that pre-built scenarios don't cover.**

**Functionality:**

- Each contract panel has a "Manual Send" tab alongside "Scenarios"
- Form adapts to the selected contract's pilot type:
  - Factor form: number inputs for `quantityProduced`, `qualityPassRate`, a dropdown for `currentStage`
  - Tasowheel form: `routingStep`, `stepName`, `stepStatus` dropdown, optional `downtimeMinutes`, `energyKwh`
  - E4M form: `currentPhase` dropdown (M1–M6), `completionPct` slider, toggle `approvalRequired`, add test results
- `updateType` dropdown: always visible
- Submit button → POST to ingest API
- Response panel shows: HTTP status, `alertsTriggered` array, `milestoneUpdated`
- Form pre-fills with the last known state values for that contract

**Files to create:**

- `frontend/src/pages/simulator/ManualSendForm.tsx`
- `frontend/src/pages/simulator/forms/FactorForm.tsx`
- `frontend/src/pages/simulator/forms/TasowheelForm.tsx`
- `frontend/src/pages/simulator/forms/E4mForm.tsx`

**Testing steps:**

1. Open Factor manual form → all expected fields visible
2. Set `qualityPassRate: 0.80` → submit → response shows `alertsTriggered: ["QUALITY_THRESHOLD"]`
3. Open E4M form → `currentPhase` dropdown shows all 6 phases
4. Submit E4M update with `completionPct: 100` for M1 → response shows milestone updated
5. Submit with invalid data (e.g. `qualityPassRate: 2.0`) → form shows validation error before sending
6. Submitted data immediately visible in consumer dashboard production feed (via WebSocket)

---

### E5-T4: Live Event Log Panel

**As a developer, I want to see all events flowing through the system in real time so I can debug and demonstrate the platform.**

**Functionality:**

- Right side of simulator: scrolling event log panel
- Listens to the same WebSocket endpoint: `WS /ws/contracts/{contractId}`
- Each WebSocket message appears as a log entry: timestamp, type, key fields
- Color-coded: green for successful updates, yellow for milestones, red for alerts, blue for blockchain events
- "Clear log" button
- Log entries include the raw JSON (collapsible) for debugging

**Files to create:**

- `frontend/src/pages/simulator/EventLogPanel.tsx`

**Testing steps:**

1. Connect to simulator for Factor contract
2. Run "Normal Production" scenario → log panel shows entries for each step
3. Alert entry appears in red with severity badge
4. Milestone completion entry appears in yellow
5. Each entry is expandable to show raw JSON
6. "Clear log" empties the panel
7. Log auto-scrolls to latest entry

---

### E5-T5: Milestone Trigger Panel

**As a developer, I want to manually trigger a milestone completion from the simulator so I can test the approval flow end-to-end.**

**Functionality:**

- "Milestones" tab in simulator panel
- Shows list of milestones for the selected contract with current status
- Each milestone has a "Submit Complete" button (disabled if already COMPLETED)
- Submitting sends a `MILESTONE_COMPLETE` update with the milestone's `milestone_ref`
- For milestones with `approval_required: true`, a tooltip shows: "Consumer approval required after submission"
- After submission, milestone status updates in the list
- "Open Consumer View" button → opens the consumer dashboard for this contract in a new tab

**Files to create:**

- `frontend/src/pages/simulator/MilestoneTriggerPanel.tsx`

**Testing steps:**

1. Factor contract → click "Submit Complete" for "Turning" milestone → status changes to `SUBMITTED` then `COMPLETED` (auto-verified)
2. E4M contract → click "Submit Complete" for M2 (approval required) → status shows `SUBMITTED`, awaiting approval
3. Open consumer dashboard in new tab → M2 appears with "Approve / Reject" buttons
4. Approve in consumer dashboard → simulator milestone panel refreshes, M2 shows `COMPLETED`
5. "Submit Complete" button disabled for already-COMPLETED milestone
6. "Open Consumer View" button opens correct contract in consumer dashboard

---

---

## EPIC E6: Consumer Dashboard (Frontend)

**Goal:** Build the React 19 consumer-facing dashboard that gives full production visibility with zero blockchain terminology.

**Definition of Done:** All 6 pages work with real API data from seeded contracts and mock sensors. WebSocket updates reflect within 1 second. No blockchain jargon visible anywhere.

---

### E6-T1: Frontend Scaffold & Routing

**As a developer, I want the React 19 project bootstrapped with routing, API client, and shared layout.**

**Functionality:**

- Initialise with `pnpm create vite frontend --template react-ts`
- Install: `react-router-dom@7`, `@tanstack/react-query`, `recharts` (charts), `date-fns` (dates), `clsx` (classnames)
- Create `DashboardLayout.tsx` — sidebar nav + main content area
- Create typed API client in `src/api/client.ts` — wraps fetch with base URL, auth headers, error handling
- Routes: `/contracts` (list), `/contracts/:id` (overview), `/contracts/:id/milestones`, `/contracts/:id/feed`, `/contracts/:id/alerts`, `/contracts/:id/documents`, `/contracts/:id/analytics`
- Global error boundary + 404 page

**Files to create:**

- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/router.tsx`
- `frontend/src/layouts/DashboardLayout.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/api/contracts.ts`
- `frontend/src/api/milestones.ts`
- `frontend/src/api/alerts.ts`

**Testing steps:**

1. `pnpm dev` → dev server starts at `localhost:3000`
2. Navigate to `/contracts` → no crash, layout renders
3. Navigate to `/contracts/nonexistent` → 404 page
4. `client.get('/contracts')` → typed response, no `any` TypeScript errors
5. All navigation links in sidebar work without full page reload
6. Browser back/forward buttons work correctly

---

### E6-T2: Contracts List Page

**As a consumer, I want to see all my contracts at a glance with their status so I know which need attention.**

**Functionality:**

- Fetches `GET /api/v1/contracts` via React Query
- Renders a card or table row per contract
- Each row: product name, pilot type icon (⚙️ Factor / ⚡ Tasowheel / 🔌 E4M), provider name, delivery date, milestone progress bar (`done/total`), status badge
- Status badge colours: green (ON_TRACK), amber (DELAYED), red (ACTION_REQUIRED), grey (COMPLETED)
- `ACTION_REQUIRED` contracts sorted to top
- Loading skeleton shown while fetching
- Empty state shown if no contracts
- Clicking a row navigates to `/contracts/:id`

**Files to create:**

- `frontend/src/pages/ContractsList.tsx`
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/MilestoneProgressBar.tsx`

**Testing steps:**

1. Page loads showing 3 seeded contracts
2. Each card has status badge with correct colour
3. Milestone progress bar shows correct `done/total` fraction
4. Trigger `ACTION_REQUIRED` status on E4M contract → E4M contract moves to top of list
5. Loading skeleton visible for 1 second if API response delayed (add artificial delay to test)
6. Click Factor card → navigates to `/contracts/contract-factor-001`

---

### E6-T3: Contract Overview Page

**As a consumer, I want a single page that gives me the full picture of one contract — status, progress, next steps, and recent activity.**

**Functionality:**

- Header: product name, status badge, delivery countdown ("14 days remaining" / "2 days overdue" in red)
- Progress section: overall milestone progress bar, current stage or phase (pilot-adaptive)
- Next milestone card: name, planned date, `approvalRequired` indicator
- Key metrics strip (pilot-adaptive): Factor shows qty/quality, Tasowheel shows routing step, E4M shows current phase
- Recent activity feed: last 5 timeline events, human-readable, with timestamps
- Quick action buttons: "View Milestones", "View Alerts" (with badge count if active), "View Documents"
- WebSocket connected — status badge and metrics update live

**Files to create:**

- `frontend/src/pages/ContractOverview.tsx`
- `frontend/src/components/MetricCard.tsx`
- `frontend/src/components/ActivityFeed.tsx`
- `frontend/src/hooks/useWebSocket.ts`

**Testing steps:**

1. Page loads for Factor contract — shows product name, delivery date, milestone progress
2. Page loads for E4M contract — shows current phase (M1–M6) in metrics strip
3. POST update via simulator → key metrics update without page refresh (WebSocket)
4. Alert badge on "View Alerts" button updates when new alert fires
5. Delivery date 3 days in past → countdown shows in red "3 days overdue"
6. Recent activity feed shows last 5 events in plain English

---

### E6-T4: Milestone Timeline Page

**As a consumer, I want to see all milestones on a visual timeline so I can understand what's done, what's coming, and what needs my action.**

**Functionality:**

- Vertical timeline layout — each milestone is a card with:
  - Status icon: ✅ Completed, 🔵 In Progress, ⏳ Pending, ❌ Overdue, 🔶 Awaiting Approval
  - Name, planned date, actual completion date (if completed)
  - Evidence document count badge (if any)
  - "Approve" / "Reject" buttons visible only when status is `SUBMITTED` and `approvalRequired: true`
- Clicking a milestone expands to show evidence documents and notes
- Overdue milestones highlighted with red border
- Rejection reason shown on rejected milestones
- After approval/rejection, milestone status updates instantly (optimistic update)

**Files to create:**

- `frontend/src/pages/MilestoneTimeline.tsx`
- `frontend/src/components/MilestoneCard.tsx`
- `frontend/src/components/ApprovalAction.tsx`

**Testing steps:**

1. Factor timeline shows 4 milestones in planned_date order
2. E4M timeline: M2 in SUBMITTED state shows Approve/Reject buttons
3. Click Approve → button shows loading state → milestone card updates to COMPLETED
4. Milestone past planned_date with non-COMPLETED status → red border visible
5. Expand completed milestone with evidence → document names listed with download links
6. Reject with empty reason → UI shows validation error (reason required)

---

### E6-T5: Production Feed Page (Live)

**As a consumer, I want to see a live feed of production metrics updating in real time.**

**Functionality:**

- Page connects to WebSocket for this contract
- Layout adapts to pilot type:
  - **Factor:** Progress bar (qty produced / planned), quality pass rate gauge (green/amber/red based on threshold), current stage chip, machine utilisation %
  - **Tasowheel:** Routing steps checklist (steps ticked off as complete), running totals for energy (kWh) and carbon (kgCO₂e), efficiency % gauge
  - **E4M:** Phase pipeline (M1→M6 with current highlighted), completionPct progress bar, test results table (type / result / defects), open issues list
- "Last updated" timestamp — updates on each WebSocket message
- Offline warning banner: "Provider data delayed — last update was 3 hours ago" when no update > 2× frequency
- History sparkline for quality/efficiency showing last 20 data points

**Files to create:**

- `frontend/src/pages/ProductionFeed.tsx`
- `frontend/src/components/PilotMetrics/FactorMetrics.tsx`
- `frontend/src/components/PilotMetrics/TasowheelMetrics.tsx`
- `frontend/src/components/PilotMetrics/E4mMetrics.tsx`
- `frontend/src/components/Gauge.tsx`
- `frontend/src/components/Sparkline.tsx`

**Testing steps:**

1. Open Factor production feed — shows qty progress bar and quality gauge
2. Run Factor scenario in simulator → qty progress bar animates, quality gauge updates
3. Run Factor "Quality Failure" scenario → quality gauge turns red
4. Open Tasowheel feed → shows routing steps checklist and energy counter
5. Open E4M feed → shows phase pipeline with current phase highlighted
6. Stop simulator → after 2× frequency, "Provider data delayed" banner appears
7. Resume simulator → banner disappears
8. Quality sparkline shows last 20 quality values as a line chart

---

### E6-T6: Alert Center Page

**As a consumer, I want to see and manage all alerts for a contract.**

**Functionality:**

- Active alerts list: ordered by severity (CRITICAL first), each shows severity badge, plain English description, time elapsed since triggered ("2 hours ago")
- "Acknowledge" button per alert — moves to history
- Alert history: full list with date filter and severity filter, acknowledged alerts shown with checkmark
- Empty state for active alerts: "No active alerts — production is on track"
- Critical alerts shown with pulsing red indicator
- Alert count in page title and in sidebar badge

**Files to create:**

- `frontend/src/pages/AlertCenter.tsx`
- `frontend/src/components/AlertItem.tsx`

**Testing steps:**

1. No seeded alerts → empty state message shown
2. Trigger CRITICAL alert via simulator → alert appears at top with pulsing red indicator
3. Trigger MEDIUM alert → appears below CRITICAL
4. Acknowledge CRITICAL alert → moves to history, sidebar badge count decreases
5. History shows acknowledged alert with timestamp
6. Filter history by `severity=HIGH` → only HIGH alerts shown
7. Alert description is plain English — no error codes or blockchain terms

---

### E6-T7: Analytics Page

**As a consumer, I want to see KPI charts and metrics for my contract to understand performance against plan.**

**Functionality:**

- Summary KPI cards at top (pilot-adaptive — see E3-T4 for KPI lists)
- Charts (using Recharts):
  - All pilots: milestone plan vs. actual completion dates (bar chart)
  - Factor: quality pass rate over time (line chart), production velocity (qty per day)
  - Tasowheel: energy consumption per routing step (bar), cumulative carbon (area chart)
  - E4M: phase duration vs. planned (bar), test pass/fail breakdown (pie chart)
- Export button → `GET /api/v1/contracts/{id}/analytics/export` → downloads PDF (or triggers print dialog as fallback)
- KPI cards use colour: green if on/above target, amber if within 10% below, red if > 10% below target

**Files to create:**

- `frontend/src/pages/Analytics.tsx`
- `frontend/src/components/KpiCard.tsx`
- `frontend/src/components/charts/MilestoneChart.tsx`
- `frontend/src/components/charts/QualityChart.tsx`
- `frontend/src/components/charts/EnergyChart.tsx`
- `frontend/src/components/charts/PhaseChart.tsx`

**Testing steps:**

1. Factor analytics page loads → quality trend line chart renders with historical data points
2. Tasowheel analytics page → energy bar chart shows one bar per routing step
3. E4M analytics page → phase duration chart shows planned (outline) vs. actual (filled) bars
4. KPI card for `automatedUpdatesPct: 100%` → green colour
5. KPI card for quality below threshold → red colour
6. After running simulator scenarios → charts update with new data
7. Export button → browser opens print dialog or downloads file

---

### E6-T8: Notification Bell & In-App Notifications

**As a consumer, I want a notification bell in the dashboard header that shows unread notifications so I always know when something needs my attention.**

**Functionality:**

- Bell icon in `DashboardLayout.tsx` header with unread count badge (red dot with number)
- Clicking the bell opens a dropdown panel showing last 10 notifications:
  - Each notification: icon by type, plain English message, contract name, time elapsed
  - "Mark all as read" button
  - "View all" link → `/notifications` full page
- Unread count fetched from `meta.unreadNotifications` on the contracts list response
- WebSocket also pushes `NOTIFICATION` message type → bell badge updates instantly without polling
- Notification types and their icons:
  - `MILESTONE_AWAITING_APPROVAL` → 🔶 amber — "M2 Concept Validation needs your approval"
  - `ALERT_TRIGGERED` → 🔴 red — "Quality issue detected on Factor order"
  - `MILESTONE_APPROVED` / `REJECTED` → 🔵 blue — "Milestone approved by consumer"
  - `CONTRACT_STATE_CHANGED` → ⚪ grey — "Contract moved to In Progress"
- Clicking a notification → navigates to the relevant contract page and marks as read

**Files to create:**

- `frontend/src/components/NotificationBell.tsx`
- `frontend/src/components/NotificationDropdown.tsx`
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/api/notifications.ts`
- Add `/notifications` route to `frontend/src/router.tsx`
- Update `frontend/src/layouts/DashboardLayout.tsx` to include bell

**Testing steps:**

1. Submit E4M M2 milestone from simulator → bell badge shows "1" within 1 second (WebSocket)
2. Click bell → dropdown shows "M2 Concept Validation needs your approval"
3. Click notification → navigates to E4M milestone timeline page, badge disappears
4. Trigger HIGH alert → bell shows red badge, notification appears in dropdown
5. "Mark all as read" → badge count resets to 0
6. `/notifications` page shows full paginated history
7. Notification message contains NO blockchain terminology

---

## Execution Plan

**Plan complete and saved to `docs/plans/2026-03-16-epics-and-tickets.md`.**

### Recommended Build Order

> ⚠️ **Revised March 16, 2026** — Auth (E0-T2/T3) moved earlier so all endpoints are born protected.
> See **Active Build Sequence** in the progress tracker above for current state.

```
✅ E0-T1                                           ← Keycloak up (fix IMP-1+IMP-2 first)
🔄 E1-T1                                           ← Monorepo scaffold + Docker Compose
⏳ E1-T2                                           ← FastAPI + uv project init
⏳ E0-T2 → E0-T3                                   ← Auth wired BEFORE any endpoints exist
⏳ E1-T3 → E1-T4 → E1-T5 → E1-T6 → E1-T7         ← DB, seed, envelope, errors, test infra
⏳ E2-T1 → E2-T2 → E2-T3 → E2-T4 → E2-T5         ← Data flows in (all endpoints auth-protected)
⏳ E2-T6                                           ← Autonomous simulators running
⏳ E4-T1 → E4-T2 → E4-T3 → E4-T4                 ← System detects and notifies
⏳ E3-T1 → E3-T2 → E3-T3 → E3-T4 → E3-T5         ← Consumer read API complete
⏳ E3-T6 → E3-T7 → E3-T8                          ← Documents, export, onboarding
⏳ E2-T7                                           ← Prove extensibility
⏳ E0-T4                                           ← Frontend auth
⏳ E6-T1 → E6-T2 → E6-T3 → E6-T4                 ← Consumer UI (core pages)
⏳ E5-T1 → E5-T2 → E5-T3 → E5-T4 → E5-T5         ← Interactive simulator for demos
⏳ E6-T5 → E6-T6 → E6-T7 → E6-T8                 ← Consumer UI (advanced + notifications)
```

### Total Ticket Count

> Updated March 16, 2026 — EPIC E0 fully closed (E0-T1 → E0-T3; E0-T2 done early). Next: E0-T4 (Frontend auth) + E1-T3 (DB schema).


| Epic      | Name                            | Tickets        | Done  | Remaining | Est. Sessions    |
| --------- | ------------------------------- | -------------- | ----- | --------- | ---------------- |
| E0        | Auth & Authorization (Keycloak) | 4              | 4 ✅  | 0         | 0                |
| E1        | Infrastructure & Project Setup  | 7              | 2 ✅  | 5         | 2                |
| E2        | Provider Ingest API             | 7              | 0     | 7         | 2                |
| E3        | Consumer Read API & WebSocket   | 8              | 0     | 8         | 3                |
| E4        | Alert & Rule Engine             | 4              | 0     | 4         | 1                |
| E5        | Visual Simulator UI             | 5              | 0     | 5         | 2                |
| E6        | Consumer Dashboard              | 8              | 0     | 8         | 3                |
| **Total** |                                 | **43 tickets** | **1** | **42**    | **~15 sessions** |



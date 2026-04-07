# MaaSAI Production Monitoring Tool

MaaSAI is a production monitoring platform for outsourced manufacturing contracts. It gives consumers a live view of contract progress, milestones, alerts, documents, and analytics while providers push structured production updates from their systems. Key events can also be forwarded to a blockchain-backed audit trail without exposing blockchain details in the user experience.

This repository contains the local development stack for the MaaSAI monitoring product discussed in the architecture and PRD documents. It includes:

- A FastAPI backend for ingest, monitoring, alerts, milestones, analytics, notifications, and audit endpoints
- A React 19 consumer dashboard for tracking contracts end to end
- An admin operations console in the frontend for system health, contract inspection, and lightweight testing
- A Python-based Simulator Studio for shaping factory data into MaaSAI's canonical intake model
- Keycloak-based authentication and role-based authorization
- PostgreSQL for operational storage and query performance
- Mock provider simulators for the `factor`, `tasowheel`, and `e4m` pilot flows

## What The System Does

At a high level, the platform supports this loop:

```text
Provider pushes update -> backend validates payload -> monitoring rules evaluate state
-> alerts and milestone changes are recorded -> consumer dashboard updates in real time
-> important events can be synced to blockchain
```

The current product shape is:

- Providers send updates through a generic ingest API
- Consumers log into a dashboard and monitor only the contracts they are allowed to access
- Contracts expose overview, milestones, alerts, documents, analytics, notifications, and timeline data
- Real-time changes are pushed to the UI over WebSockets
- Pilot-specific payloads are supported through contract type configuration rather than separate apps

## Architecture Summary

The system is built around a split between fast operational storage and immutable audit logging:

- PostgreSQL stores contracts, status updates, alerts, milestones, notification state, and analytics-ready data
- The backend serves the consumer dashboard and processes provider ingest events
- Mock or real blockchain integration is used for selected audit events, not for primary UI queries
- Keycloak issues tokens and scopes access by role and contract assignment

Local development runs as a Docker Compose stack:

```text
mock sensors -> FastAPI backend -> PostgreSQL
                           -> WebSocket updates -> React dashboard
                           -> optional blockchain event logging
Keycloak provides authentication for frontend users and provider/service accounts
```

For the detailed architecture and product rationale, see:

- [ARCHITECTURE.md](/Users/abodiatrash/projects/massai/ARCHITECTURE.md)
- [PRD.md](/Users/abodiatrash/projects/massai/PRD.md)
- [OPEN_QUESTIONS.md](/Users/abodiatrash/projects/massai/OPEN_QUESTIONS.md)

## Repository Layout

```text
.
├── backend/           FastAPI API, domain services, workers, schemas, migrations, tests
├── frontend/          React 19 dashboard, auth, admin UI, charts, route layouts
├── mock-sensors/      Mock provider simulators and named scenarios
├── simulator-studio/  Streamlit-based factory modeling and ingest-profile workbench
├── user-service/      Keycloak realm export, seeded users, local setup scripts
├── docs/              Planning and supporting documents
├── docker-compose.yml
├── docker-compose.dev.yml
├── ARCHITECTURE.md
└── PRD.md
```

## Main Services

### Backend

The backend is a FastAPI application with:

- Provider ingest endpoint for contract updates
- Consumer-facing read APIs for contracts, milestones, alerts, documents, analytics, audit, and notifications
- Role-aware access control using Keycloak JWTs
- WebSocket broadcasting for live contract updates
- Monitoring and notification services
- A pluggable blockchain adapter with mock support for local development

Main entry points:

- [backend/app/main.py](/Users/abodiatrash/projects/massai/backend/app/main.py)
- [backend/app/api/v1/router.py](/Users/abodiatrash/projects/massai/backend/app/api/v1/router.py)

### Frontend

The frontend is a React 19 application built with Vite. It includes:

- Contract list and contract detail routes
- Overview, milestones, feed, alerts, documents, analytics, and notifications pages
- Protected routes backed by Keycloak login
- An admin operations area at `/admin` for admin users
- Lightweight contract testing tools inside the admin area

Main entry points:

- [frontend/src/main.tsx](/Users/abodiatrash/projects/massai/frontend/src/main.tsx)
- [frontend/src/router.tsx](/Users/abodiatrash/projects/massai/frontend/src/router.tsx)

### Simulator Studio

The Simulator Studio is a separate Streamlit app used when real factory integrations are not available yet. It exists to standardize provider-side data before it reaches the backend and to keep MaaSAI's intake model stable across different factory implementations.

It is the right tool for:

- Factory template authoring
- Ingest profile and schema shaping
- Sensor and scenario configuration
- Local draft factory setup
- Provisioning modeled/demo factories into MaaSAI

It is intentionally separate from the frontend admin console:

- Studio at `3001` is the factory data workbench
- Admin at `3000/admin` is the operational control plane

Main entry point:

- [simulator-studio/simulator_studio/app.py](/Users/abodiatrash/projects/massai/simulator-studio/simulator_studio/app.py)

### Identity And Access

Authentication and authorization are handled through Keycloak:

- Realm: `massai`
- Roles: `consumer`, `provider`, `admin`
- Contract-scoped access via a custom `contract_ids` claim
- Seeded local users for development and demos

See [user-service/README.md](/Users/abodiatrash/projects/massai/user-service/README.md) for details.

### Mock Sensors

The `mock-sensors/` package simulates providers for three pilot types:

- `factor`: metal parts manufacturing
- `tasowheel`: gears and routing-style manufacturing progress
- `e4m`: electronics and milestone-heavy development/manufacturing flow

These simulators post updates to the backend so the dashboard can be exercised without live plant integrations.

## Quick Start

### 1. Configure environment

Copy the example environment if you want to override defaults:

```sh
cp .env.example .env
```

You may want to change these ports if they are already in use:

- `POSTGRES_PORT`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `KEYCLOAK_PORT`

### 2. Start the full local stack

```sh
docker compose -f docker-compose.dev.yml up --build
```

This starts:

- `postgres`
- `keycloak`
- `keycloak-setup`
- `backend`
- `frontend`
- `simulator-studio`
- `mock-factor`
- `mock-tasowheel`
- `mock-e4m`

### 3. Verify the core services

```sh
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/
curl http://localhost:3000
```

Helpful local URLs:

- Frontend: `http://localhost:3000`
- Admin console: `http://localhost:3000/admin`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- Simulator Studio: `http://localhost:3001`
- Keycloak: `http://localhost:8080/admin`

## Seeded Development Users

The local Keycloak setup creates a few ready-to-use accounts:

| User | Password | Role | Contract IDs |
| --- | --- | --- | --- |
| `consumer-factor@test.com` | `password` | `consumer` | `contract-factor-001` |
| `provider-factor@test.com` | `password` | `provider` | `contract-factor-001` |
| `consumer-e4m@test.com` | `password` | `consumer` | `contract-e4m-001` |
| `provider-tasowheel@test.com` | `password` | `provider` | `contract-tasowheel-001` |
| `admin@test.com` | `password` | `admin` | none |

The frontend uses the `massai-frontend` Keycloak client, and provider/service flows use dedicated provider clients in local development.

## Example Development Workflow

Typical local flow:

1. Start the Docker Compose stack
2. Log into the frontend with a seeded consumer or admin account
3. Let the simulators push updates into the backend
4. Use the Simulator Studio when you need to model a factory, shape an ingest profile, or provision a demo contract
5. Use the admin console at `/admin` for contract/system inspection and lightweight testing
6. Open contracts in the dashboard and observe:
   - progress updates
   - milestone state changes
   - alert creation and acknowledgement
   - notification count changes
   - analytics and document views
7. Use the admin testing area to inspect ingest history, view events, and run contract-focused debug flows

## Technology Stack

- Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic, asyncpg
- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query
- Auth: Keycloak
- Database: PostgreSQL 16
- Local orchestration: Docker Compose
- Blockchain integration: mock adapter locally, pluggable real adapter design

## Notes

- The top-level architecture has moved beyond an "early scaffold" and now represents a working prototype/MVP stack.
- The blockchain is treated as an audit destination for important events, not the primary query engine for the dashboard.
- The frontend is consumer-oriented by design and avoids exposing blockchain jargon directly to end users.
- Pilot-specific behavior is intended to stay configurable through schemas and contract metadata rather than separate product surfaces.

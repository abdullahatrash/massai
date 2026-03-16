# MaaSAI Monitoring Tool

This repository contains the early scaffold for the MaaSAI production monitoring platform. The current milestone covers:

- Keycloak-based local authentication bootstrap in `user-service/`
- A Docker Compose development stack with PostgreSQL, backend, frontend placeholder, and mock sensors
- A FastAPI backend bootstrapped with `uv`

## Project Layout

```text
.
├── backend/
├── frontend/
├── mock-sensors/
├── user-service/
├── docs/
└── docker-compose.dev.yml
```

## Quick Start

1. Copy `.env.example` to `.env` if you want to override defaults.
   If ports like `5432` are already in use locally, change `POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`, or `KEYCLOAK_PORT` in `.env`.
2. Start the development stack:

   ```sh
   docker compose -f docker-compose.dev.yml up --build
   ```

3. Verify the core services:

   ```sh
   curl http://localhost:8000/health
   curl http://localhost:8000/api/v1/
   curl http://localhost:3000
   ```

## Services

- `postgres`: PostgreSQL 16 for operational data
- `keycloak`: local identity provider on `http://localhost:8080`
- `backend`: FastAPI app on `http://localhost:8000`
- `frontend`: lightweight placeholder server on `http://localhost:3000`
- `mock-factor`, `mock-tasowheel`, `mock-e4m`: stub simulators that will evolve in later tickets

## Notes

- `user-service/realm-export.json` already includes `sslRequired: "none"` for local development.
- `IMP-2` was verified against a live local token: `contract_ids` is present in the JWT payload.
- The frontend and simulators are intentionally lightweight at this stage so the stack can boot before their dedicated epics land.

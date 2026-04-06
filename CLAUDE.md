# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MaaSAI is a manufacturing monitoring platform. Monorepo with four services:

- **backend/** — FastAPI (Python 3.12, uv) — API, monitoring, alerts, milestones, analytics
- **frontend/** — React 19 + TypeScript + Vite (pnpm) — consumer dashboard with real-time WebSocket updates
- **mock-sensors/** — Python simulators for three pilots: Factor, Tasowheel, E4M
- **simulator-studio/** — Streamlit demo interface for live demos

## Development

Start the full dev stack:
```bash
docker compose -f docker-compose.dev.yml up --build
```

Ports: frontend=3000, backend=8000, keycloak=8080, postgres=5432

## Backend Commands

```bash
cd backend
uv run pytest                    # run all tests
uv run pytest -k 'test_name'    # run a single test
uv run ruff check .             # lint
uv run ruff format .            # format
uv run alembic revision --autogenerate -m "description"  # create migration
uv run alembic upgrade head     # apply migrations
```

## Frontend Commands

```bash
cd frontend
pnpm install    # install dependencies
pnpm run dev    # start dev server (usually via docker-compose)
pnpm test       # run tests (vitest)
npx eslint .    # lint
npx prettier --write .  # format
```

## Code Principles

- **Always write tests** for backend changes. Every new endpoint, service method, or bug fix should have corresponding pytest tests.
- **Keep backend configurable** — use environment variables and Pydantic Settings (`app/core/config.py`). Never hardcode URLs, secrets, thresholds, or connection strings.
- **Async throughout** — backend uses async SQLAlchemy with asyncpg. All DB operations are async.

## Architecture

- **Auth:** Keycloak OIDC with roles: `consumer`, `provider`, `admin`. Test users seeded via `user-service/setup.sh`.
- **API versioning:** v1 (legacy routes) and v2 (ingest profiles) under `backend/app/api/`.
- **Database:** PostgreSQL 16 with Alembic migrations in `backend/migrations/versions/`.
- **Frontend:** Tailwind CSS v4, shadcn/ui components, path alias `@/*` → `./src/*`.
- **Simulators:** Each pilot has a Python simulator that authenticates via Keycloak service accounts and POSTs to `/api/v2/ingest`.

## Env Setup

Copy `.env.example` to `.env` before first run. All required variables are documented there.

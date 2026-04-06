---
name: migrate
description: Create or apply Alembic database migrations. Use when database models change or migrations need to be run.
---

## Usage

If `$ARGUMENTS` is provided, use it as the migration message. Otherwise, ask the user for a description.

## Create a new migration

After modifying SQLAlchemy models in `backend/app/models/`:

```bash
cd backend && uv run alembic revision --autogenerate -m "$ARGUMENTS"
```

After generating, review the migration file in `backend/migrations/versions/` to verify:
- The upgrade and downgrade functions are correct
- No unintended changes were included
- Foreign keys and indexes are properly handled

## Apply migrations

```bash
cd backend && uv run alembic upgrade head
```

## Check current state

```bash
cd backend && uv run alembic current
cd backend && uv run alembic history --verbose
```

## If running in Docker

The backend container applies migrations on startup. To run manually inside Docker:
```bash
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

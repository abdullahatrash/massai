---
name: dev
description: Spin up, restart, or reset the Docker Compose development stack. Use when the user needs to start or reset the local environment.
---

## Commands

Start the full dev stack:
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Restart a specific service (e.g., after code changes):
```bash
docker compose -f docker-compose.dev.yml restart backend
```

Full reset (rebuild everything from scratch):
```bash
docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up --build -d
```

Check service health:
```bash
docker compose -f docker-compose.dev.yml ps
```

View logs for a service:
```bash
docker compose -f docker-compose.dev.yml logs -f backend
```

If `$ARGUMENTS` specifies a service name, operate on that service only. Otherwise, operate on the full stack.

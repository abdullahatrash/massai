from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from time import perf_counter
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers
from app.core.health import get_dependency_health, router as health_router
from app.core.logging import configure_logging

configure_logging()

settings = get_settings()
logger = logging.getLogger("massai.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    dependency_health = await get_dependency_health(settings=settings)
    if dependency_health["status"] != "ok":
        logger.warning(
            "application_started_degraded",
            extra={
                "environment": settings.environment,
                "blockchain_adapter": settings.blockchain_adapter,
                "db_status": dependency_health["db"],
                "auth_status": dependency_health["auth"],
            },
        )
    logger.info(
        "application_started",
        extra={
            "environment": settings.environment,
            "blockchain_adapter": settings.blockchain_adapter,
        },
    )
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    openapi_url="/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(health_router)
app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        logger.exception(
            "request_failed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "duration_ms": duration_ms,
            },
        )
        raise

    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    logger.info(
        "request_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response

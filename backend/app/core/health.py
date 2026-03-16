from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings, get_settings
from app.core.database import engine
from app.core.response import success

logger = logging.getLogger("massai.api")

router = APIRouter(prefix="/health", tags=["health"])


async def check_database_health() -> str:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return "unreachable"
    return "ok"


def _realm_metadata_url(settings: Settings) -> str:
    return (
        f"{settings.keycloak_url.rstrip('/')}/realms/"
        f"{settings.keycloak_realm}/.well-known/openid-configuration"
    )


async def check_auth_health(*, settings: Settings | None = None) -> str:
    resolved_settings = settings or get_settings()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(_realm_metadata_url(resolved_settings))
            response.raise_for_status()
    except httpx.HTTPError:
        return "unreachable"
    return "ok"


async def get_dependency_health(*, settings: Settings | None = None) -> dict[str, str]:
    resolved_settings = settings or get_settings()
    db_status = await check_database_health()
    auth_status = await check_auth_health(settings=resolved_settings)
    overall_status = "ok" if db_status == "ok" and auth_status == "ok" else "degraded"
    return {
        "status": overall_status,
        "db": db_status,
        "auth": auth_status,
        "environment": resolved_settings.environment,
    }


@router.get("")
async def healthcheck() -> dict[str, object]:
    return success(await get_dependency_health())


@router.get("/ready", response_model=None)
async def readiness_check() -> Response:
    payload = success(await get_dependency_health())
    if payload["data"]["status"] == "ok":
        return JSONResponse(status_code=status.HTTP_200_OK, content=payload)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=payload,
    )

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings


def _timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _meta(extra_meta: dict[str, Any] | None = None) -> dict[str, Any]:
    meta = {
        "timestamp": _timestamp(),
        "version": get_settings().api_version,
    }
    if extra_meta:
        meta.update(extra_meta)
    return meta


def success(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "data": data,
        "meta": _meta(meta),
    }


def error(
    code: str,
    message: str,
    details: list[dict[str, Any]] | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
        },
        "meta": _meta(meta),
    }


class ApiException(HTTPException):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details or []
        super().__init__(
            status_code=status_code,
            detail=message,
            headers=headers,
        )

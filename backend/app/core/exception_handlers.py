from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.response import ApiException, error

logger = logging.getLogger("massai.api")
HTTP_422_STATUS = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", None)
if HTTP_422_STATUS is None:
    HTTP_422_STATUS = status.HTTP_422_UNPROCESSABLE_ENTITY

_DEFAULT_ERROR_CODES = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    status.HTTP_409_CONFLICT: "CONFLICT",
    HTTP_422_STATUS: "VALIDATION_ERROR",
    status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
}


def _message_from_http_exception(exc: StarletteHTTPException) -> str:
    if isinstance(exc, ApiException):
        return exc.message

    detail = exc.detail
    if isinstance(detail, dict):
        message = detail.get("message")
        if isinstance(message, str) and message:
            return message
    if isinstance(detail, str) and detail:
        return detail
    return "Request failed."


def _details_from_http_exception(exc: StarletteHTTPException) -> list[dict[str, Any]]:
    if isinstance(exc, ApiException):
        return exc.details

    detail = exc.detail
    if isinstance(detail, dict):
        details = detail.get("details")
        if isinstance(details, list):
            return [item for item in details if isinstance(item, dict)]
    return []


def _code_from_http_exception(exc: StarletteHTTPException) -> str:
    if isinstance(exc, ApiException):
        return exc.code

    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code")
        if isinstance(code, str) and code:
            return code

    return _DEFAULT_ERROR_CODES.get(exc.status_code, "REQUEST_FAILED")


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error(
            code=_code_from_http_exception(exc),
            message=_message_from_http_exception(exc),
            details=_details_from_http_exception(exc),
        ),
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    if any(err["type"] == "json_invalid" for err in exc.errors()):
        details = [
            {
                "field": ".".join(str(part) for part in err["loc"]),
                "message": err["msg"],
                "type": err["type"],
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error(
                code="INVALID_JSON",
                message="Request body contains invalid JSON.",
                details=details,
            ),
        )

    details = [
        {
            "field": ".".join(str(part) for part in err["loc"]),
            "message": err["msg"],
            "type": err["type"],
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=HTTP_422_STATUS,
        content=error(
            code="VALIDATION_ERROR",
            message="Request validation failed.",
            details=details,
        ),
    )


async def database_exception_handler(
    request: Request,
    exc: SQLAlchemyError,
) -> JSONResponse:
    logger.exception(
        "database_unavailable",
        extra={
            "method": request.method,
            "path": request.url.path,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=error(
            code="DATABASE_UNAVAILABLE",
            message="Database unavailable.",
        ),
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception(
        "unhandled_exception",
        extra={
            "method": request.method,
            "path": request.url.path,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error(
            code="INTERNAL_ERROR",
            message="An internal server error occurred.",
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

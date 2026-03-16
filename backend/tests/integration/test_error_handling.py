from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.core.exception_handlers import register_exception_handlers
from app.main import app


class PayloadModel(BaseModel):
    value: int


def build_test_app() -> FastAPI:
    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.post("/json")
    async def json_endpoint(payload: PayloadModel) -> dict[str, int]:
        return {"value": payload.value}

    @test_app.get("/db-error")
    async def db_error() -> dict[str, str]:
        raise SQLAlchemyError("database down")

    return test_app


class ErrorHandlingIntegrationTestCase(unittest.TestCase):
    def test_health_returns_200_with_degraded_status(self) -> None:
        degraded_payload = {
            "status": "degraded",
            "db": "unreachable",
            "auth": "ok",
            "environment": "development",
        }

        with (
            patch("app.core.health.get_dependency_health", AsyncMock(return_value=degraded_payload)),
            patch("app.main.get_dependency_health", AsyncMock(return_value=degraded_payload)),
        ):
            client = TestClient(app)
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["status"], "degraded")
        self.assertEqual(payload["data"]["db"], "unreachable")
        self.assertEqual(payload["data"]["auth"], "ok")

    def test_health_ready_returns_200_when_dependencies_are_ready(self) -> None:
        healthy_payload = {
            "status": "ok",
            "db": "ok",
            "auth": "ok",
            "environment": "development",
        }

        with (
            patch("app.core.health.get_dependency_health", AsyncMock(return_value=healthy_payload)),
            patch("app.main.get_dependency_health", AsyncMock(return_value=healthy_payload)),
        ):
            client = TestClient(app)
            response = client.get("/health/ready")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["db"], "ok")
        self.assertEqual(payload["data"]["auth"], "ok")

    def test_health_ready_returns_503_when_dependency_is_down(self) -> None:
        degraded_payload = {
            "status": "degraded",
            "db": "unreachable",
            "auth": "ok",
            "environment": "development",
        }

        with (
            patch("app.core.health.get_dependency_health", AsyncMock(return_value=degraded_payload)),
            patch("app.main.get_dependency_health", AsyncMock(return_value=degraded_payload)),
        ):
            client = TestClient(app)
            response = client.get("/health/ready")

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["data"]["status"], "degraded")
        self.assertEqual(payload["data"]["db"], "unreachable")
        self.assertEqual(payload["data"]["auth"], "ok")

    def test_invalid_json_returns_400_error_envelope(self) -> None:
        client = TestClient(build_test_app())

        response = client.post(
            "/json",
            content="not json",
            headers={"content-type": "application/json"},
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "INVALID_JSON")
        self.assertEqual(payload["error"]["message"], "Request body contains invalid JSON.")
        self.assertEqual(payload["error"]["details"][0]["field"], "body.0")

    def test_database_error_returns_503_error_envelope(self) -> None:
        client = TestClient(build_test_app(), raise_server_exceptions=False)

        response = client.get("/db-error")

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "DATABASE_UNAVAILABLE")
        self.assertEqual(payload["error"]["message"], "Database unavailable.")

    def test_auth_service_unavailable_returns_503_error_envelope(self) -> None:
        client = TestClient(app)

        with patch(
            "app.core.auth.fetch_jwks",
            AsyncMock(side_effect=httpx.ConnectError("keycloak down")),
        ):
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer dummy-token"},
            )

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "AUTH_SERVICE_UNAVAILABLE")
        self.assertEqual(payload["error"]["message"], "Authentication service unavailable.")


if __name__ == "__main__":
    unittest.main()

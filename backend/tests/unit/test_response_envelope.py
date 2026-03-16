from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.exception_handlers import register_exception_handlers
from app.core.response import ApiException
from app.main import app


class PayloadModel(BaseModel):
    quantity: int


def build_error_test_app() -> FastAPI:
    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.get("/contracts/{contract_id}")
    async def contract_detail(contract_id: str) -> dict[str, str]:
        raise ApiException(
            status_code=404,
            code="CONTRACT_NOT_FOUND",
            message="Contract not found",
        )

    @test_app.post("/validate")
    async def validate_payload(payload: PayloadModel) -> dict[str, int]:
        return {"quantity": payload.quantity}

    @test_app.get("/explode")
    async def explode() -> dict[str, str]:
        raise RuntimeError("boom")

    return test_app


class ResponseEnvelopeTestCase(unittest.TestCase):
    def test_health_route_returns_success_envelope(self) -> None:
        with (
            patch(
                "app.core.health.get_dependency_health",
                AsyncMock(
                    return_value={
                        "status": "ok",
                        "db": "ok",
                        "auth": "ok",
                        "environment": "development",
                    }
                ),
            ),
            patch(
                "app.main.get_dependency_health",
                AsyncMock(
                    return_value={
                        "status": "ok",
                        "db": "ok",
                        "auth": "ok",
                        "environment": "development",
                    }
                ),
            ),
        ):
            client = TestClient(app)
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["status"], "ok")
        self.assertEqual(payload["meta"]["version"], "1")
        self.assertTrue(payload["meta"]["timestamp"].endswith("Z"))

    def test_auth_missing_token_uses_error_envelope(self) -> None:
        client = TestClient(app)

        response = client.get("/api/v1/auth/me")

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")
        self.assertEqual(payload["error"]["message"], "Missing bearer token.")
        self.assertEqual(payload["error"]["details"], [])
        self.assertEqual(response.headers["www-authenticate"], "Bearer")

    def test_api_exception_uses_custom_error_code(self) -> None:
        client = TestClient(build_error_test_app())

        response = client.get("/contracts/nonexistent")

        self.assertEqual(response.status_code, 404)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "CONTRACT_NOT_FOUND")
        self.assertEqual(payload["error"]["message"], "Contract not found")
        self.assertEqual(payload["error"]["details"], [])
        self.assertEqual(payload["meta"]["version"], "1")

    def test_validation_error_uses_error_envelope(self) -> None:
        client = TestClient(build_error_test_app())

        response = client.post("/validate", json={"quantity": "invalid"})

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(payload["error"]["message"], "Request validation failed.")
        self.assertEqual(payload["error"]["details"][0]["field"], "body.quantity")

    def test_unhandled_exception_uses_internal_error_envelope(self) -> None:
        client = TestClient(build_error_test_app(), raise_server_exceptions=False)

        response = client.get("/explode")

        self.assertEqual(response.status_code, 500)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "INTERNAL_ERROR")
        self.assertEqual(payload["error"]["message"], "An internal server error occurred.")
        self.assertEqual(payload["error"]["details"], [])


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import tempfile
import unittest
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.ingest import router as ingest_router
from app.core import schema_validator
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.contract import Contract


class FakeScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(self, contract: Contract | None) -> None:
        self.contract = contract
        self.added: list[Any] = []
        self.flush_called = False
        self.commit_called = False

    async def execute(self, statement: Any) -> FakeScalarResult:
        return FakeScalarResult(self.contract)

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if self.contract is not None and identifier == self.contract.id:
            return self.contract
        return None

    def add(self, instance: Any) -> None:
        self.added.append(instance)

    async def flush(self) -> None:
        self.flush_called = True

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(ingest_router, prefix="/api/v1")
    return app


def build_contract(public_id: str) -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.pilot_type = "PILOT_TEST"
    contract.config = {"public_id": public_id, "last_known_state": {}}
    return contract


class PilotExtensibilityIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.contract = build_contract("contract-pilot-test-001")
        self.session = FakeSession(self.contract)
        self.valid_body = {
            "updateType": "PRODUCTION_UPDATE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sensorId": "pilot-test-sensor-01",
            "payload": {
                "testValue": 7,
                "testLabel": "hello",
            },
        }

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="provider-test",
                email="provider-test@example.com",
                preferred_username="provider-test@example.com",
                roles=("provider",),
                contract_ids=("contract-pilot-test-001",),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session
        schema_validator.load_schema.cache_clear()
        schema_validator._get_validator.cache_clear()

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        schema_validator.load_schema.cache_clear()
        schema_validator._get_validator.cache_clear()

    def test_valid_pilot_test_payload_is_accepted(self) -> None:
        client = TestClient(self.app)

        response = client.post(
            "/api/v1/ingest/contract-pilot-test-001",
            json=self.valid_body,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["contractId"], "contract-pilot-test-001")
        self.assertTrue(payload["data"]["processed"])
        self.assertEqual(len(self.session.added), 1)
        self.assertTrue(self.session.flush_called)
        self.assertTrue(self.session.commit_called)

    def test_missing_required_field_returns_422(self) -> None:
        client = TestClient(self.app)

        response = client.post(
            "/api/v1/ingest/contract-pilot-test-001",
            json={
                **self.valid_body,
                "payload": {
                    "testValue": 7,
                },
            },
        )

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(payload["error"]["details"][0]["field"], "payload.testLabel")

    def test_missing_schema_returns_400_without_crashing(self) -> None:
        client = TestClient(self.app)

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(schema_validator, "SCHEMA_DIR", Path(tmpdir)):
                schema_validator.load_schema.cache_clear()
                schema_validator._get_validator.cache_clear()

                response = client.post(
                    "/api/v1/ingest/contract-pilot-test-001",
                    json=self.valid_body,
                )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "SCHEMA_NOT_FOUND")

from __future__ import annotations

import unittest
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v2.admin import router as admin_router
from app.api.v2.contracts import router as contracts_router
from app.api.v2.ingest import router as ingest_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.contract import Contract
from app.models.ingest_profile import IngestProfile
from app.models.status_update import StatusUpdate
from app.services.ingest_profiles import IngestProfileService


class FakeScalarCollection:
    def __init__(self, values: list[Any]) -> None:
        self._values = values

    def all(self) -> list[Any]:
        return list(self._values)


class FakeResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value

    def scalars(self) -> FakeScalarCollection:
        if isinstance(self._value, list):
            return FakeScalarCollection(self._value)
        if self._value is None:
            return FakeScalarCollection([])
        return FakeScalarCollection([self._value])


class FakeSession:
    def __init__(self, contracts: list[Contract] | None = None) -> None:
        self.contracts = list(contracts or [])
        self.contracts_by_public_id = {
            contract.public_id: contract for contract in self.contracts if contract.public_id
        }
        self.profiles: list[IngestProfile] = []
        self.profiles_by_key_version: dict[tuple[str, int], IngestProfile] = {}
        self.added: list[Any] = []
        self.commit_called = False
        self.flush_called = False

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        statement_text = str(statement)

        if "FROM contracts" in statement_text and "contracts.public_id =" in statement_text:
          public_id = next((value for value in params.values() if isinstance(value, str)), None)
          return FakeResult(self.contracts_by_public_id.get(public_id))

        if "FROM ingest_profiles" in statement_text and "ingest_profiles.profile_key =" in statement_text:
            values = list(params.values())
            profile_key = next((value for value in values if isinstance(value, str)), None)
            version = next((value for value in values if isinstance(value, int)), None)
            if profile_key is None or version is None:
                return FakeResult(None)
            return FakeResult(self.profiles_by_key_version.get((profile_key, version)))

        if "FROM ingest_profiles" in statement_text:
            ordered = sorted(
                self.profiles,
                key=lambda profile: (
                    profile.pilot_type or "",
                    profile.profile_key,
                    profile.version,
                ),
            )
            return FakeResult(ordered)

        return FakeResult(None)

    def add(self, instance: Any) -> None:
        self.added.append(instance)
        if isinstance(instance, IngestProfile):
            self.profiles.append(instance)
            self.profiles_by_key_version[(instance.profile_key, instance.version)] = instance

    async def flush(self) -> None:
        self.flush_called = True

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(admin_router, prefix="/api/v2")
    app.include_router(contracts_router, prefix="/api/v2")
    app.include_router(ingest_router, prefix="/api/v2")
    return app


def build_contract(public_id: str, pilot_type: str = "FACTOR") -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.consumer_id = "consumer-factor@test.com"
    contract.provider_id = "provider-factor@test.com"
    contract.config = {
        "public_id": public_id,
        "quality_target": 0.95,
        "last_known_state": {},
    }
    contract.alerts = []
    contract.milestones = []
    contract.notifications = []
    IngestProfileService.bind_default_profile(contract)
    return contract


class IngestV2ApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.session = FakeSession([build_contract("contract-factor-001")])

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_db_session] = override_session

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="provider-1",
                email="provider-factor@test.com",
                preferred_username="provider-factor@test.com",
                roles=("provider",),
                contract_ids=("contract-factor-001",),
            )

        self.app.dependency_overrides[get_current_user] = override_current_user

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_get_contract_ingest_spec_returns_resolved_snapshot(self) -> None:
        client = TestClient(self.app)

        response = client.get("/api/v2/contracts/contract-factor-001/ingest-spec")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["profileKey"], "FACTOR_DEFAULT")
        self.assertEqual(payload["profileVersion"], 1)
        self.assertIn("PRODUCTION_UPDATE", payload["allowedUpdateTypes"])
        self.assertIn("qualityPassRate", payload["updateTypes"]["PRODUCTION_UPDATE"]["jsonSchema"]["properties"])

    def test_v2_ingest_accepts_valid_payload_and_persists_profile_version(self) -> None:
        client = TestClient(self.app)
        body = {
            "updateType": "PRODUCTION_UPDATE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sourceId": "factor-manual-send",
            "profileVersion": 1,
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 0.991,
            },
            "evidence": ["https://example.com/evidence/turning-report"],
        }

        response = client.post("/api/v2/ingest/contract-factor-001", json=body)

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["profileKey"], "FACTOR_DEFAULT")
        self.assertEqual(payload["profileVersion"], 1)
        saved_update = next(item for item in self.session.added if isinstance(item, StatusUpdate))
        self.assertEqual(saved_update.source_id, "factor-manual-send")
        self.assertEqual(saved_update.sensor_id, "factor-manual-send")
        self.assertEqual(saved_update.ingest_profile_version, 1)
        self.assertEqual(saved_update.ingest_schema_version, "2")
        self.assertEqual(
            self.session.contracts_by_public_id["contract-factor-001"].config["last_known_state"]["qualityPassRate"],
            0.991,
        )

    def test_v2_ingest_rejects_payload_that_fails_resolved_schema(self) -> None:
        client = TestClient(self.app)
        body = {
            "updateType": "PRODUCTION_UPDATE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sourceId": "factor-manual-send",
            "profileVersion": 1,
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 2.0,
            },
        }

        response = client.post("/api/v2/ingest/contract-factor-001", json=body)

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")

    def test_v2_ingest_rejects_profile_version_mismatch(self) -> None:
        client = TestClient(self.app)
        body = {
            "updateType": "PRODUCTION_UPDATE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sourceId": "factor-manual-send",
            "profileVersion": 99,
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 0.991,
            },
        }

        response = client.post("/api/v2/ingest/contract-factor-001", json=body)

        self.assertEqual(response.status_code, 409)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "PROFILE_VERSION_MISMATCH")

    def test_admin_can_create_and_bind_custom_profile(self) -> None:
        async def override_admin() -> CurrentUser:
            return CurrentUser(
                id="admin-1",
                email="admin@test.com",
                preferred_username="admin@test.com",
                roles=("admin",),
                contract_ids=(),
            )

        self.app.dependency_overrides[get_current_user] = override_admin
        client = TestClient(self.app)

        create_response = client.post(
            "/api/v2/admin/ingest-profiles",
            json={
                "profileKey": "FACTOR_MINIMAL",
                "factoryKey": "factor",
                "pilotType": "FACTOR",
                "version": 1,
                "status": "ACTIVE",
                "definition": {
                    "supportedUpdateTypes": ["PRODUCTION_UPDATE"],
                    "updateTypes": {
                        "PRODUCTION_UPDATE": {
                            "fields": ["quantityProduced", "currentStage"],
                            "required": ["quantityProduced", "currentStage"],
                            "defaults": {"currentStage": "TURNING", "quantityProduced": 0},
                            "ui": {
                                "fieldOrder": ["quantityProduced", "currentStage"],
                                "fields": {
                                    "quantityProduced": {"label": "Quantity produced", "placeholder": "0"},
                                    "currentStage": {"label": "Current stage"},
                                },
                            },
                        }
                    },
                },
            },
        )

        self.assertEqual(create_response.status_code, 201)
        bind_response = client.post(
            "/api/v2/admin/contracts/contract-factor-001/ingest-profile-binding",
            json={"profileKey": "FACTOR_MINIMAL", "version": 1},
        )

        self.assertEqual(bind_response.status_code, 200)
        bound_payload = bind_response.json()["data"]
        self.assertEqual(bound_payload["profileKey"], "FACTOR_MINIMAL")
        self.assertEqual(bound_payload["allowedUpdateTypes"], ["PRODUCTION_UPDATE"])
        self.assertEqual(
            sorted(bound_payload["updateTypes"]["PRODUCTION_UPDATE"]["jsonSchema"]["properties"].keys()),
            ["currentStage", "quantityProduced"],
        )

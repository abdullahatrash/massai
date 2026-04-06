from __future__ import annotations

import unittest
import uuid
from datetime import date
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v2.admin import router as admin_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.contract import Contract
from app.models.ingest_profile import IngestProfile
from app.models.milestone import Milestone


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
            return FakeScalarCollection(self._values)
        if self._value is None:
            return FakeScalarCollection([])
        return FakeScalarCollection([self._value])

    @property
    def _values(self) -> list[Any]:
        if isinstance(self._value, list):
            return list(self._value)
        if self._value is None:
            return []
        return [self._value]


class FakeSession:
    def __init__(self) -> None:
        self.contracts: list[Contract] = []
        self.contracts_by_public_id: dict[str, Contract] = {}
        self.profiles: list[IngestProfile] = []
        self.profiles_by_key_version: dict[tuple[str, int], IngestProfile] = {}
        self.milestones_by_uuid: dict[uuid.UUID, Milestone] = {}
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

        return FakeResult(None)

    def add(self, instance: Any) -> None:
        if isinstance(instance, Contract):
            self.contracts.append(instance)
            if instance.public_id:
                self.contracts_by_public_id[instance.public_id] = instance
            return
        if isinstance(instance, Milestone):
            self.milestones_by_uuid[instance.id] = instance
            return
        if isinstance(instance, IngestProfile):
            self.profiles.append(instance)
            self.profiles_by_key_version[(instance.profile_key, instance.version)] = instance

    async def flush(self) -> None:
        self.flush_called = True
        for contract in self.contracts:
            if contract.public_id:
                self.contracts_by_public_id[contract.public_id] = contract

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(admin_router, prefix="/api/v2")
    return app


class DemoOnboardingV2ApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.session = FakeSession()
        self.current_user = CurrentUser(
            id="admin-1",
            email="admin@test.com",
            preferred_username="admin@test.com",
            roles=("admin",),
            contract_ids=(),
        )

        async def override_current_user() -> CurrentUser:
            return self.current_user

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_demo_contract_creation_binds_default_profile_snapshot(self) -> None:
        client = TestClient(self.app)

        response = client.post(
            "/api/v2/admin/demo/contracts",
            json={
                "contractId": "contract-demo-factor-001",
                "pilotType": "FACTOR",
                "factoryName": "Demo Factor Factory",
                "providerId": "provider-factor-sa",
                "consumerId": "admin@test.com",
                "productName": "Demo Gear Batch",
                "quantityTotal": 1000,
                "deliveryDate": "2026-06-30",
                "agreementType": "PRODUCTION_MONITORING",
                "status": "ACTIVE",
                "qualityTarget": 0.97,
                "dataUpdateFrequency": {"minutes": 15},
                "milestones": [
                    {
                        "milestoneRef": "TURNING",
                        "name": "Turning",
                        "plannedDate": "2026-04-10",
                        "approvalRequired": False,
                        "completionCriteria": {"currentStage": "TURNING"},
                    },
                    {
                        "milestoneRef": "INSPECTION",
                        "name": "Inspection",
                        "plannedDate": "2026-05-20",
                        "approvalRequired": True,
                        "completionCriteria": {"currentStage": "INSPECTION"},
                    },
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()["data"]
        self.assertEqual(payload["contractId"], "contract-demo-factor-001")
        self.assertEqual(payload["ingestProfileKey"], "FACTOR_DEFAULT")
        self.assertEqual(payload["ingestProfileVersion"], 1)
        self.assertEqual(payload["milestoneCount"], 2)

        contract = self.session.contracts_by_public_id["contract-demo-factor-001"]
        self.assertEqual(contract.config["factory_name"], "Demo Factor Factory")
        self.assertEqual(contract.config["quality_target"], 0.97)
        self.assertEqual(contract.config["dataUpdateFrequency"], {"minutes": 15})
        self.assertEqual(contract.ingest_profile_key, "FACTOR_DEFAULT")
        self.assertEqual(contract.ingest_profile_version, 1)
        self.assertTrue(self.session.commit_called)

    def test_demo_contract_creation_can_bind_custom_profile(self) -> None:
        profile = IngestProfile(
            profile_key="FACTOR_MINIMAL",
            factory_key="factor",
            pilot_type="FACTOR",
            version=3,
            status="ACTIVE",
            supported_update_types=["PRODUCTION_UPDATE"],
            profile_definition={"supportedUpdateTypes": ["PRODUCTION_UPDATE"]},
            resolved_spec={
                "profileKey": "FACTOR_MINIMAL",
                "factoryKey": "factor",
                "pilotType": "FACTOR",
                "schemaVersion": "2",
                "allowedUpdateTypes": ["PRODUCTION_UPDATE"],
                "updateTypes": {
                    "PRODUCTION_UPDATE": {
                        "jsonSchema": {
                            "type": "object",
                            "properties": {
                                "quantityProduced": {"type": "integer"},
                            },
                            "required": ["quantityProduced"],
                            "additionalProperties": False,
                        },
                        "uiSchema": {"fieldOrder": ["quantityProduced"]},
                        "defaults": {"quantityProduced": 0},
                    }
                },
            },
        )
        profile.id = uuid.uuid4()
        self.session.profiles.append(profile)
        self.session.profiles_by_key_version[(profile.profile_key, profile.version)] = profile

        client = TestClient(self.app)
        response = client.post(
            "/api/v2/admin/demo/contracts",
            json={
                "contractId": "contract-demo-factor-002",
                "pilotType": "FACTOR",
                "factoryName": "Custom Profile Factory",
                "providerId": "provider-factor-sa",
                "consumerId": "admin@test.com",
                "productName": "Minimal Batch",
                "quantityTotal": 200,
                "deliveryDate": "2026-07-01",
                "agreementType": "PRODUCTION_MONITORING",
                "status": "ACTIVE",
                "profileKey": "FACTOR_MINIMAL",
                "profileVersion": 3,
                "milestones": [
                    {
                        "milestoneRef": "TURNING",
                        "name": "Turning",
                        "plannedDate": "2026-04-12",
                        "approvalRequired": False,
                        "completionCriteria": {},
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()["data"]
        self.assertEqual(payload["ingestProfileKey"], "FACTOR_MINIMAL")
        self.assertEqual(payload["ingestProfileVersion"], 3)
        contract = self.session.contracts_by_public_id["contract-demo-factor-002"]
        self.assertEqual(contract.ingest_profile_key, "FACTOR_MINIMAL")
        self.assertEqual(contract.ingest_profile_version, 3)
        self.assertEqual(
            contract.ingest_profile_snapshot["allowedUpdateTypes"],
            ["PRODUCTION_UPDATE"],
        )
        self.assertTrue(self.session.commit_called)

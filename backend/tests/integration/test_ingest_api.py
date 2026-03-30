from __future__ import annotations

import unittest
import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.ingest import router as ingest_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.status_update import StatusUpdate


class FakeScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(
        self,
        contract: Contract | None,
        *,
        execute_results: list[Any] | None = None,
    ) -> None:
        self.contract = contract
        self.execute_results = list(execute_results or [])
        self.added: list[Any] = []
        self.commit_called = False
        self.flush_called = False
        self.loaded_milestones: dict[Any, Milestone] = {}

    async def execute(self, statement: Any) -> FakeScalarResult:
        if self.execute_results:
            value = self.execute_results.pop(0)
            if isinstance(value, Milestone):
                self.loaded_milestones[value.id] = value
            return FakeScalarResult(value)
        return FakeScalarResult(self.contract)

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if identifier in self.loaded_milestones:
            return self.loaded_milestones[identifier]
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
    return contract


def build_milestone(contract: Contract, milestone_ref: str) -> Milestone:
    milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
    milestone.milestone_ref = milestone_ref
    milestone.status = "PENDING"
    milestone.evidence = []
    return milestone


class IngestApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.valid_body = {
            "updateType": "PRODUCTION_UPDATE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sensorId": "sensor-factor-01",
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 0.991,
            },
            "evidence": ["https://example.com/evidence/turning-report"],
        }

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def _set_current_user(
        self,
        *,
        roles: tuple[str, ...] = ("provider",),
        contract_ids: tuple[str, ...] = ("contract-factor-001",),
    ) -> None:
        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="provider-1",
                email="provider-factor@test.com",
                preferred_username="provider-factor@test.com",
                roles=roles,
                contract_ids=contract_ids,
            )

        self.app.dependency_overrides[get_current_user] = override_current_user

    def _set_session(self, session: FakeSession) -> None:
        async def override_session() -> Any:
            yield session

        self.app.dependency_overrides[get_db_session] = override_session

    def test_ingest_valid_payload_returns_processed_and_persists_update(self) -> None:
        session = FakeSession(build_contract("contract-factor-001"))
        self._set_current_user()
        self._set_session(session)

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=self.valid_body)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["contractId"], "contract-factor-001")
        self.assertTrue(payload["data"]["processed"])
        self.assertTrue(any(isinstance(item, StatusUpdate) for item in session.added))
        self.assertTrue(session.flush_called)
        self.assertTrue(session.commit_called)
        saved_update = next(item for item in session.added if isinstance(item, StatusUpdate))
        self.assertIsInstance(saved_update, StatusUpdate)
        self.assertEqual(saved_update.update_type, "PRODUCTION_UPDATE")
        self.assertEqual(saved_update.sensor_id, "sensor-factor-01")
        self.assertEqual(saved_update.payload["currentStage"], "TURNING")
        self.assertEqual(
            session.contract.config["last_known_state"]["qualityPassRate"],
            0.991,
        )
        self.assertEqual(
            saved_update.evidence,
            ["https://example.com/evidence/turning-report"],
        )

    def test_ingest_failing_quality_persists_alert_row(self) -> None:
        session = FakeSession(build_contract("contract-factor-001"))
        self._set_current_user()
        self._set_session(session)

        body = {
            **self.valid_body,
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 0.80,
            },
        }

        client = TestClient(self.app)
        with patch(
            "app.api.v1.ingest.AlertBlockchainService.log_alerts",
            new=AsyncMock(),
        ) as log_alerts:
            response = client.post("/api/v1/ingest/contract-factor-001", json=body)

        self.assertEqual(response.status_code, 200)
        alert = next(item for item in session.added if isinstance(item, Alert))
        self.assertEqual(alert.rule_id, "QUALITY_THRESHOLD")
        self.assertEqual(alert.severity, "HIGH")
        log_alerts.assert_awaited_once()
        notifications = [item for item in session.added if isinstance(item, Notification)]
        self.assertEqual(len(notifications), 2)

    def test_ingest_resolves_existing_no_data_alert(self) -> None:
        contract = build_contract("contract-factor-001")
        existing_alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing_alert.rule_id = "NO_DATA_RECEIVED"
        existing_alert.severity = "MEDIUM"
        existing_alert.triggered_at = datetime(2026, 3, 16, 9, 0, tzinfo=UTC)
        existing_alert.resolved_at = None
        contract.alerts = [existing_alert]
        session = FakeSession(contract)
        self._set_current_user()
        self._set_session(session)

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=self.valid_body)

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(existing_alert.resolved_at)

    def test_ingest_returns_404_when_contract_is_missing(self) -> None:
        session = FakeSession(None)
        self._set_current_user(contract_ids=("nonexistent-id",))
        self._set_session(session)

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/nonexistent-id", json=self.valid_body)

        self.assertEqual(response.status_code, 404)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "CONTRACT_NOT_FOUND")
        self.assertEqual(payload["error"]["message"], "Contract not found.")

    def test_ingest_returns_422_when_payload_fails_pilot_schema(self) -> None:
        session = FakeSession(build_contract("contract-factor-001"))
        self._set_current_user()
        self._set_session(session)

        invalid_body = {
            **self.valid_body,
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 2.0,
            },
        }

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=invalid_body)

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(payload["error"]["message"], "Payload schema validation failed.")
        self.assertEqual(payload["error"]["details"][0]["field"], "payload.qualityPassRate")

    def test_ingest_requires_authorization(self) -> None:
        session = FakeSession(build_contract("contract-factor-001"))
        self._set_session(session)

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=self.valid_body)

        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")

    def test_ingest_forbids_provider_without_contract_access(self) -> None:
        session = FakeSession(build_contract("contract-factor-001"))
        self._set_current_user(contract_ids=("contract-e4m-001",))
        self._set_session(session)

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=self.valid_body)

        self.assertEqual(response.status_code, 403)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "FORBIDDEN")

    def test_ingest_milestone_complete_updates_milestone_status(self) -> None:
        contract = build_contract("contract-e4m-001", pilot_type="E4M")
        milestone = build_milestone(contract, "M2")
        milestone.approval_required = True
        milestone.completion_criteria = {"currentPhase": "M2", "completionPct": 100}
        session = FakeSession(contract, execute_results=[contract, milestone])
        self._set_current_user(contract_ids=("contract-e4m-001",))
        self._set_session(session)

        body = {
            "updateType": "MILESTONE_COMPLETE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sensorId": "sensor-e4m-01",
            "payload": {
                "milestoneRef": "M2",
                "currentPhase": "M2",
                "completionPct": 100,
            },
            "evidence": ["https://example.com/evidence/m2-complete"],
        }

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-e4m-001", json=body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(milestone.status, "SUBMITTED")
        self.assertEqual(milestone.evidence, ["https://example.com/evidence/m2-complete"])
        notification = next(
            item for item in session.added if isinstance(item, Notification)
        )
        self.assertEqual(notification.event_type, "MILESTONE_AWAITING_APPROVAL")
        self.assertEqual(notification.payload["milestoneRef"], "M2")

    def test_ingest_milestone_complete_preserves_structured_document_evidence(self) -> None:
        contract = build_contract("contract-e4m-001", pilot_type="E4M")
        milestone = build_milestone(contract, "M2")
        milestone.approval_required = True
        milestone.completion_criteria = {"currentPhase": "M2", "completionPct": 100}
        session = FakeSession(contract, execute_results=[contract, milestone])
        self._set_current_user(contract_ids=("contract-e4m-001",))
        self._set_session(session)

        body = {
            "updateType": "MILESTONE_COMPLETE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sensorId": "sensor-e4m-01",
            "payload": {
                "milestoneRef": "M2",
                "currentPhase": "M2",
                "completionPct": 100,
            },
            "evidence": [
                {
                    "name": "phase-readiness.pdf",
                    "url": "https://example.com/docs/phase-readiness.pdf",
                    "format": "PDF",
                    "uploadedAt": "2026-03-18T08:15:00Z",
                }
            ],
        }

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-e4m-001", json=body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            milestone.evidence,
            [
                {
                    "name": "phase-readiness.pdf",
                    "url": "https://example.com/docs/phase-readiness.pdf",
                    "format": "PDF",
                    "uploadedAt": "2026-03-18T08:15:00Z",
                }
            ],
        )
        saved_update = next(item for item in session.added if isinstance(item, StatusUpdate))
        self.assertEqual(saved_update.evidence, milestone.evidence)

    def test_ingest_auto_verifies_non_approval_milestone_to_completed(self) -> None:
        contract = build_contract("contract-factor-001", pilot_type="FACTOR")
        milestone = build_milestone(contract, "TURNING")
        milestone.approval_required = False
        milestone.completion_criteria = {
            "currentStage": "TURNING",
            "minQualityPassRate": 0.97,
        }
        session = FakeSession(contract, execute_results=[contract, milestone])
        self._set_current_user(contract_ids=("contract-factor-001",))
        self._set_session(session)

        body = {
            "updateType": "MILESTONE_COMPLETE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sensorId": "sensor-factor-01",
            "payload": {
                "milestoneRef": "TURNING",
                "currentStage": "TURNING",
                "qualityPassRate": 0.991,
                "quantityProduced": 12000,
                "quantityPlanned": 12000,
            },
            "evidence": ["https://example.com/evidence/turning-complete"],
        }

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=body)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(milestone.status, "COMPLETED")
        blockchain_event = next(
            item for item in session.added if isinstance(item, BlockchainEvent)
        )
        self.assertEqual(blockchain_event.event_type, "MILESTONE_COMPLETED")
        self.assertEqual(blockchain_event.event_data["milestoneRef"], "TURNING")

    def test_ingest_rejects_invalid_structured_document_evidence(self) -> None:
        session = FakeSession(build_contract("contract-factor-001"))
        self._set_current_user()
        self._set_session(session)

        invalid_body = {
            **self.valid_body,
            "evidence": [
                {
                    "name": "  ",
                    "url": "not-a-url",
                }
            ],
        }

        client = TestClient(self.app)
        response = client.post("/api/v1/ingest/contract-factor-001", json=invalid_body)

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
        fields = {detail["field"] for detail in payload["error"]["details"]}
        self.assertTrue(any(field.endswith(".name") for field in fields))
        self.assertTrue(any(field.endswith(".url") for field in fields))

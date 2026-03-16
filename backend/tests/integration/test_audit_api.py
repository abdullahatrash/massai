from __future__ import annotations

import unittest
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.audit import router as audit_router
from app.api.v1.contracts import router as contracts_router
from app.api.v1.milestones import router as milestones_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone


class FakeResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(self, contracts: list[Contract]) -> None:
        self.contracts_by_public_id = {
            contract.public_id or str(contract.config["public_id"]): contract
            for contract in contracts
        }
        self.milestones_by_uuid: dict[uuid.UUID, Milestone] = {}
        for contract in contracts:
            for milestone in contract.milestones or []:
                self.milestones_by_uuid[milestone.id] = milestone

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        if "id_1" in params:
            milestone = self.milestones_by_uuid.get(params["id_1"])
            contract_uuid = params.get("contract_id_1")
            if milestone is None or (
                contract_uuid is not None and milestone.contract_id != contract_uuid
            ):
                return FakeResult(None)
            return FakeResult(milestone)
        contract_id = params.get("public_id_1") or next(
            (value for value in params.values() if isinstance(value, str)),
            None,
        )
        return FakeResult(self.contracts_by_public_id.get(contract_id))


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(audit_router, prefix="/api/v1")
    app.include_router(contracts_router, prefix="/api/v1")
    app.include_router(milestones_router, prefix="/api/v1")
    return app


def build_contract(public_id: str) -> Contract:
    today = date.today()
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = "FACTOR"
    contract.status = "ACTIVE"
    contract.provider_id = "provider-factor@test.com"
    contract.consumer_id = "consumer-factor@test.com"
    contract.product_name = "Forged Drive Shafts"
    contract.quantity_total = 12000
    contract.delivery_date = today + timedelta(days=45)
    contract.agreement_type = "PRODUCTION_MONITORING"
    contract.config = {
        "public_id": public_id,
        "last_known_state": {"currentStage": "TURNING"},
    }

    milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
    milestone.contract = contract
    milestone.milestone_ref = "TURNING"
    milestone.name = "Turning"
    milestone.planned_date = today - timedelta(days=5)
    milestone.actual_date = today - timedelta(days=4)
    milestone.status = "COMPLETED"
    milestone.approval_required = False
    milestone.evidence = [
        {
            "name": "inspection.pdf",
            "url": "https://example.com/docs/inspection.pdf",
            "format": "PDF",
            "uploadedAt": "2026-03-16T10:00:00Z",
        }
    ]
    contract.milestones = [milestone]

    alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
    alert.contract = contract
    alert.severity = "HIGH"
    alert.condition_description = "No production update received for 12 hours"
    alert.triggered_at = datetime.now(UTC) - timedelta(hours=2)
    alert.acknowledged_at = datetime.now(UTC) - timedelta(hours=1)
    contract.alerts = [alert]

    blockchain_event = BlockchainEvent(id=uuid.uuid4(), contract_id=contract.id)
    blockchain_event.contract = contract
    blockchain_event.event_type = "MILESTONE_COMPLETED"
    blockchain_event.transaction_hash = "0xabc123"
    blockchain_event.created_at = datetime.now(UTC) - timedelta(minutes=30)
    blockchain_event.event_data = {
        "milestone_ref": "TURNING",
        "milestone_id": str(milestone.id),
    }
    contract.blockchain_events = [blockchain_event]
    return contract


class AuditApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.contract = build_contract("contract-factor-001")
        self.session = FakeSession([self.contract])

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-factor@test.com",
                preferred_username="consumer-factor@test.com",
                roles=("consumer",),
                contract_ids=("contract-factor-001",),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_audit_export_returns_full_json_payload(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/audit-export")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["contractId"], "contract-factor-001")
        self.assertIn("exportedAt", payload)
        self.assertIn("contract", payload)
        self.assertIn("milestones", payload)
        self.assertIn("alerts", payload)
        self.assertIn("timelineEvents", payload)

    def test_audit_export_marks_blockchain_verified_milestones_and_includes_transaction_hash(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/audit-export")

        self.assertEqual(response.status_code, 200)
        milestone = response.json()["data"]["milestones"][0]
        self.assertTrue(milestone["blockchainVerified"])
        self.assertEqual(milestone["transactionHash"], "0xabc123")
        self.assertIsNotNone(milestone["verifiedAt"])

    def test_main_consumer_endpoints_still_hide_transaction_hash(self) -> None:
        client = TestClient(self.app)
        contracts_response = client.get("/api/v1/contracts/contract-factor-001")
        milestones_response = client.get(
            f"/api/v1/contracts/contract-factor-001/milestones/{self.contract.milestones[0].id}"
        )

        self.assertEqual(contracts_response.status_code, 200)
        self.assertEqual(milestones_response.status_code, 200)
        self.assertNotIn("transactionHash", str(contracts_response.json()))
        self.assertNotIn("transactionHash", str(milestones_response.json()))

    def test_provider_role_is_forbidden(self) -> None:
        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="provider-1",
                email="provider-factor@test.com",
                preferred_username="provider-factor@test.com",
                roles=("provider",),
                contract_ids=("contract-factor-001",),
            )

        self.app.dependency_overrides[get_current_user] = override_current_user
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/audit-export")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "FORBIDDEN")

    def test_pdf_format_returns_structured_payload_for_frontend_print_flow(self) -> None:
        client = TestClient(self.app)
        response = client.get(
            "/api/v1/contracts/contract-factor-001/audit-export",
            params={"format": "pdf"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["exportFormat"], "pdf")

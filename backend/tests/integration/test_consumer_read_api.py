from __future__ import annotations

import unittest
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.milestones import router as milestones_router
from app.api.v1.timeline import router as timeline_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
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
            return FakeScalarCollection(self._value)
        if self._value is None:
            return FakeScalarCollection([])
        return FakeScalarCollection([self._value])


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

        contract_filter = params.get("public_id_1") or params.get("param_1")
        if isinstance(contract_filter, str):
            return FakeResult(self.contracts_by_public_id.get(contract_filter))
        return FakeResult(None)


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(milestones_router, prefix="/api/v1")
    app.include_router(timeline_router, prefix="/api/v1")
    return app


def build_contract(
    public_id: str,
    *,
    consumer_id: str,
    pilot_type: str,
    milestone_defs: list[dict[str, Any]],
    alerts: list[dict[str, Any]] | None = None,
    blockchain_events: list[dict[str, Any]] | None = None,
) -> Contract:
    today = date.today()
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.consumer_id = consumer_id
    contract.provider_id = f"provider-{public_id}@test.com"
    contract.pilot_type = pilot_type
    contract.product_name = public_id
    contract.config = {"public_id": public_id}

    milestones: list[Milestone] = []
    for milestone_def in milestone_defs:
        milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
        milestone.contract = contract
        milestone.milestone_ref = milestone_def["ref"]
        milestone.name = milestone_def["name"]
        milestone.planned_date = today + timedelta(days=milestone_def["planned_offset_days"])
        milestone.actual_date = milestone_def.get("actual_date")
        milestone.status = milestone_def["status"]
        milestone.approval_required = milestone_def.get("approval_required", False)
        milestone.evidence = list(milestone_def.get("evidence", []))
        milestones.append(milestone)
    contract.milestones = milestones

    alert_models: list[Alert] = []
    for alert_def in alerts or []:
        alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
        alert.contract = contract
        alert.severity = alert_def["severity"]
        alert.condition_description = alert_def["condition_description"]
        alert.triggered_at = alert_def["triggered_at"]
        alert.acknowledged_at = alert_def.get("acknowledged_at")
        alert.resolved_at = alert_def.get("resolved_at")
        alert_models.append(alert)
    contract.alerts = alert_models

    blockchain_models: list[BlockchainEvent] = []
    for event_def in blockchain_events or []:
        event = BlockchainEvent(id=uuid.uuid4(), contract_id=contract.id)
        event.contract = contract
        event.event_type = event_def["event_type"]
        event.event_data = event_def.get("event_data", {})
        event.created_at = event_def["created_at"]
        blockchain_models.append(event)
    contract.blockchain_events = blockchain_models

    return contract


class ConsumerReadApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.factor_contract = build_contract(
            "contract-factor-001",
            consumer_id="consumer-factor@test.com",
            pilot_type="FACTOR",
            milestone_defs=[
                {
                    "ref": "HEAT",
                    "name": "Heat Treatment",
                    "planned_offset_days": 12,
                    "status": "PENDING",
                },
                {
                    "ref": "TURNING",
                    "name": "Turning",
                    "planned_offset_days": 3,
                    "status": "COMPLETED",
                    "actual_date": date.today() - timedelta(days=1),
                    "evidence": [{"type": "REPORT", "url": "https://example.com/report"}],
                },
                {
                    "ref": "GRIND",
                    "name": "Grinding",
                    "planned_offset_days": -1,
                    "status": "PENDING",
                },
            ],
            alerts=[
                {
                    "severity": "HIGH",
                    "condition_description": "No production update received for 12 hours",
                    "triggered_at": datetime.now(UTC) - timedelta(hours=2),
                }
            ],
            blockchain_events=[
                {
                    "event_type": "MILESTONE_APPROVED",
                    "event_data": {"milestoneRef": "TURNING"},
                    "created_at": datetime.now(UTC) - timedelta(hours=1),
                }
            ],
        )
        self.e4m_contract = build_contract(
            "contract-e4m-001",
            consumer_id="consumer-e4m@test.com",
            pilot_type="E4M",
            milestone_defs=[
                {"ref": "M1", "name": "M1", "planned_offset_days": 1, "status": "PENDING"},
                {"ref": "M2", "name": "M2", "planned_offset_days": 2, "status": "PENDING", "approval_required": True},
                {"ref": "M3", "name": "M3", "planned_offset_days": 3, "status": "PENDING", "approval_required": True},
                {"ref": "M4", "name": "M4", "planned_offset_days": 4, "status": "PENDING"},
                {"ref": "M5", "name": "M5", "planned_offset_days": 5, "status": "PENDING", "approval_required": True},
                {"ref": "M6", "name": "M6", "planned_offset_days": 6, "status": "PENDING", "approval_required": True},
            ],
        )
        self.session = FakeSession([self.factor_contract, self.e4m_contract])

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-factor@test.com",
                preferred_username="consumer-factor@test.com",
                roles=("consumer",),
                contract_ids=("contract-factor-001", "contract-e4m-001"),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_list_milestones_returns_ordered_contract_milestones(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/milestones")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual([item["milestoneRef"] for item in payload], ["GRIND", "TURNING", "HEAT"])

    def test_e4m_milestones_expose_expected_approval_required_flags(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-e4m-001/milestones")

        self.assertEqual(response.status_code, 200)
        milestones = {item["milestoneRef"]: item["approvalRequired"] for item in response.json()["data"]}
        self.assertEqual(
            milestones,
            {
                "M1": False,
                "M2": True,
                "M3": True,
                "M4": False,
                "M5": True,
                "M6": True,
            },
        )

    def test_milestone_detail_includes_evidence_array(self) -> None:
        client = TestClient(self.app)
        milestone_id = self.factor_contract.milestones[0].id
        response = client.get(
            f"/api/v1/contracts/contract-factor-001/milestones/{milestone_id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertIn("evidence", payload)
        self.assertEqual(payload["evidence"], [])

    def test_overdue_milestones_are_flagged(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/milestones")

        self.assertEqual(response.status_code, 200)
        milestones = {item["milestoneRef"]: item["isOverdue"] for item in response.json()["data"]}
        self.assertTrue(milestones["GRIND"])
        self.assertFalse(milestones["TURNING"])

    def test_timeline_returns_plain_english_events_without_blockchain_jargon(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/timeline")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertGreaterEqual(len(payload), 3)
        descriptions = [item["description"] for item in payload]
        self.assertIn("Milestone 'Turning' marked complete", descriptions)
        self.assertIn("No production update received for 12 hours", descriptions)
        self.assertIn("Milestone 'TURNING' approved and recorded", descriptions)
        self.assertTrue(all("STATE_TRANSITION" not in description for description in descriptions))
        self.assertTrue(all("transaction" not in description.lower() for description in descriptions))
        self.assertTrue(all("blockchain" not in description.lower() for description in descriptions))

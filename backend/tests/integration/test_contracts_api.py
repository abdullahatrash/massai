from __future__ import annotations

import unittest
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.contracts import router as contracts_router
from app.api.v1.milestones import router as milestones_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.notification import Notification


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
            str(contract.public_id or contract.config["public_id"]): contract for contract in contracts
        }
        self.contracts_by_uuid = {contract.id: contract for contract in contracts}
        self.milestones_by_uuid: dict[uuid.UUID, Milestone] = {}
        self.notifications_by_uuid: dict[uuid.UUID, Notification] = {}
        self.added: list[Any] = []
        self.commit_called = False

        for contract in contracts:
            for milestone in contract.milestones or []:
                self.milestones_by_uuid[milestone.id] = milestone
            for notification in contract.notifications or []:
                self.notifications_by_uuid[notification.id] = notification

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        statement_text = str(statement)
        if "id_1" in params:
            milestone = self.milestones_by_uuid.get(params["id_1"])
            contract_uuid = params.get("contract_id_1")
            if milestone is None or (
                contract_uuid is not None and milestone.contract_id != contract_uuid
            ):
                return FakeResult(None)
            return FakeResult(milestone)
        if "milestone_ref_1" in params:
            contract_uuid = params.get("contract_id_1")
            milestone_ref = params.get("milestone_ref_1")
            contract = self.contracts_by_uuid.get(contract_uuid)
            if contract is None:
                return FakeResult(None)
            milestone = next(
                (
                    item
                    for item in contract.milestones or []
                    if item.milestone_ref == milestone_ref
                ),
                None,
            )
            return FakeResult(milestone)

        if "FROM notifications" in statement_text:
            identities: set[str] = set()
            for value in params.values():
                if isinstance(value, str):
                    identities.add(value)
                elif isinstance(value, (list, tuple)):
                    identities.update(str(item) for item in value)
            notifications = [
                notification
                for notification in self.notifications_by_uuid.values()
                if notification.recipient_id in identities and notification.read_at is None
            ]
            notifications.sort(
                key=lambda item: item.created_at or datetime.min.replace(tzinfo=UTC),
                reverse=True,
            )
            return FakeResult(notifications)

        contract_filter = next(
            (value for value in params.values() if isinstance(value, (list, tuple))),
            None,
        )
        if isinstance(contract_filter, (list, tuple)):
            filtered = [
                self.contracts_by_public_id[public_id]
                for public_id in contract_filter
                if public_id in self.contracts_by_public_id
            ]
            limit = statement._limit_clause.value if statement._limit_clause is not None else None
            offset = statement._offset_clause.value if statement._offset_clause is not None else 0
            sliced = filtered[offset : offset + limit] if limit is not None else filtered[offset:]
            return FakeResult(sliced)
        contract_filter = next(
            (value for value in params.values() if isinstance(value, str)),
            None,
        )
        if isinstance(contract_filter, str):
            return FakeResult(self.contracts_by_public_id.get(contract_filter))

        return FakeResult(list(self.contracts_by_public_id.values()))

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if identifier in self.milestones_by_uuid:
            return self.milestones_by_uuid[identifier]
        return self.contracts_by_uuid.get(identifier)

    def add(self, instance: Any) -> None:
        self.added.append(instance)
        if isinstance(instance, Notification):
            self.notifications_by_uuid[instance.id] = instance

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(contracts_router, prefix="/api/v1")
    app.include_router(milestones_router, prefix="/api/v1")
    return app


def build_contract(
    public_id: str,
    *,
    consumer_id: str,
    pilot_type: str,
    product_name: str,
    delivery_offset_days: int,
    milestone_defs: list[dict[str, Any]],
    last_known_state: dict[str, Any],
    status: str = "ACTIVE",
    alert_severities: list[str] | None = None,
    notification_defs: list[dict[str, Any]] | None = None,
    quality_target: float | None = None,
) -> Contract:
    today = date.today()
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.status = status
    contract.consumer_id = consumer_id
    contract.provider_id = f"provider-{public_id}@test.com"
    contract.product_name = product_name
    contract.pilot_type = pilot_type
    contract.delivery_date = today + timedelta(days=delivery_offset_days)
    contract.config = {
        "public_id": public_id,
        "last_known_state": last_known_state,
    }
    if quality_target is not None:
        contract.config["quality_target"] = quality_target

    milestones: list[Milestone] = []
    for milestone_def in milestone_defs:
        milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
        milestone.contract = contract
        milestone.milestone_ref = milestone_def["ref"]
        milestone.name = milestone_def["name"]
        milestone.planned_date = today + timedelta(days=milestone_def["planned_offset_days"])
        milestone.status = milestone_def["status"]
        milestone.approval_required = milestone_def.get("approval_required", False)
        milestone.evidence = []
        milestones.append(milestone)
    contract.milestones = milestones

    alerts: list[Alert] = []
    for severity in alert_severities or []:
        alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
        alert.contract = contract
        alert.severity = severity
        alert.acknowledged_at = None
        alert.resolved_at = None
        alerts.append(alert)
    contract.alerts = alerts
    notifications: list[Notification] = []
    for notification_def in notification_defs or []:
        notification = Notification(id=uuid.uuid4(), contract_id=contract.id)
        notification.contract = contract
        notification.recipient_id = notification_def["recipient_id"]
        notification.event_type = notification_def["event_type"]
        notification.message = notification_def["message"]
        notification.created_at = notification_def["created_at"]
        notification.read_at = notification_def.get("read_at")
        notification.payload = notification_def.get("payload", {})
        notifications.append(notification)
    contract.notifications = notifications

    return contract


class ContractsApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.factor_contract = build_contract(
            "contract-factor-001",
            consumer_id="consumer-factor@test.com",
            pilot_type="FACTOR",
            product_name="Forged Drive Shafts",
            delivery_offset_days=90,
            milestone_defs=[
                {"ref": "TURNING", "name": "Turning", "planned_offset_days": -2, "status": "COMPLETED"},
                {"ref": "HEAT", "name": "Heat Treatment", "planned_offset_days": 10, "status": "PENDING"},
            ],
            last_known_state={"currentStage": "TURNING", "qualityPassRate": 0.991},
            quality_target=0.985,
        )
        self.e4m_contract = build_contract(
            "contract-e4m-001",
            consumer_id="consumer-e4m@test.com",
            pilot_type="E4M",
            product_name="Energy Transition Demonstrator",
            delivery_offset_days=120,
            milestone_defs=[
                {"ref": "M1", "name": "M1", "planned_offset_days": -1, "status": "COMPLETED"},
                {
                    "ref": "M2",
                    "name": "M2",
                    "planned_offset_days": 5,
                    "status": "SUBMITTED",
                    "approval_required": True,
                },
                {"ref": "M3", "name": "M3", "planned_offset_days": 20, "status": "PENDING", "approval_required": True},
            ],
            last_known_state={"currentPhase": "M2", "completionPct": 100},
            notification_defs=[
                {
                    "recipient_id": "consumer-e4m@test.com",
                    "event_type": "MILESTONE_AWAITING_APPROVAL",
                    "message": "Milestone M2 is awaiting approval.",
                    "created_at": datetime(2026, 3, 16, 12, 0, tzinfo=UTC),
                }
            ],
        )
        self.tasowheel_contract = build_contract(
            "contract-tasowheel-001",
            consumer_id="consumer-ops@tasowheel.example",
            pilot_type="TASOWHEEL",
            product_name="Precision Wheel Hub Assemblies",
            delivery_offset_days=75,
            milestone_defs=[
                {"ref": "STEP_10", "name": "Blank Preparation", "planned_offset_days": 3, "status": "PENDING"},
                {"ref": "STEP_20", "name": "CNC Machining", "planned_offset_days": 15, "status": "PENDING"},
            ],
            last_known_state={"stepName": "Blank Preparation", "stepStatus": "IN_PROGRESS"},
            alert_severities=["HIGH"],
        )

        self.session = FakeSession(
            [self.factor_contract, self.e4m_contract, self.tasowheel_contract]
        )

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-e4m@test.com",
                preferred_username="consumer-e4m@test.com",
                roles=("consumer",),
                contract_ids=(
                    "contract-factor-001",
                    "contract-e4m-001",
                    "contract-tasowheel-001",
                ),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_list_contracts_returns_contract_summaries_without_blockchain_fields(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["data"]), 3)
        self.assertEqual(
            {item["id"] for item in payload["data"]},
            {
                "contract-factor-001",
                "contract-e4m-001",
                "contract-tasowheel-001",
            },
        )

        factor_summary = next(
            item for item in payload["data"] if item["id"] == "contract-factor-001"
        )
        self.assertEqual(factor_summary["pilotType"], "FACTOR")
        self.assertEqual(factor_summary["productName"], "Forged Drive Shafts")
        self.assertEqual(factor_summary["milestonesCompleted"], 1)
        self.assertEqual(factor_summary["milestonesTotal"], 2)
        self.assertEqual(factor_summary["statusBadge"], "ON_TRACK")
        self.assertNotIn("blockchain_contract_address", factor_summary)
        self.assertNotIn("transactionHash", factor_summary)

        tasowheel_summary = next(
            item for item in payload["data"] if item["id"] == "contract-tasowheel-001"
        )
        self.assertEqual(tasowheel_summary["statusBadge"], "ACTION_REQUIRED")

        pagination = payload["meta"]["pagination"]
        self.assertEqual(pagination["page"], 1)
        self.assertEqual(pagination["pageSize"], 20)
        self.assertFalse(pagination["hasMore"])
        self.assertEqual(payload["meta"]["unreadNotifications"], 1)

    def test_provider_can_list_and_view_assigned_contracts(self) -> None:
        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="provider-1",
                email="provider-contract-e4m-001@test.com",
                preferred_username="provider-contract-e4m-001@test.com",
                roles=("provider",),
                contract_ids=("contract-e4m-001",),
            )

        self.app.dependency_overrides[get_current_user] = override_current_user
        client = TestClient(self.app)

        list_response = client.get("/api/v1/contracts")
        overview_response = client.get("/api/v1/contracts/contract-e4m-001")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(overview_response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in list_response.json()["data"]],
            ["contract-e4m-001"],
        )
        self.assertEqual(overview_response.json()["data"]["id"], "contract-e4m-001")

    def test_get_contract_overview_includes_next_milestone_and_last_known_state(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-e4m-001")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["id"], "contract-e4m-001")
        self.assertEqual(payload["milestonesCompleted"], 1)
        self.assertEqual(payload["milestonesTotal"], 3)
        self.assertEqual(payload["statusBadge"], "ACTION_REQUIRED")
        self.assertEqual(payload["lastKnownState"]["currentPhase"], "M2")
        self.assertEqual(payload["nextMilestone"]["name"], "M2")
        self.assertEqual(payload["nextMilestone"]["plannedDate"], self.e4m_contract.milestones[1].planned_date.isoformat())
        self.assertIsNone(payload["qualityTarget"])
        self.assertNotIn("blockchain_contract_address", payload)

    def test_get_factor_contract_overview_includes_quality_target(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["qualityTarget"], 0.985)

    def test_get_contract_overview_reflects_updated_milestone_completion_after_approval(self) -> None:
        client = TestClient(self.app)
        approval_response = client.post(
            f"/api/v1/contracts/contract-e4m-001/milestones/{self.e4m_contract.milestones[1].id}/approve",
            json={"notes": "Looks good."},
        )

        self.assertEqual(approval_response.status_code, 200)

        response = client.get("/api/v1/contracts/contract-e4m-001")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["milestonesCompleted"], 2)
        self.assertEqual(payload["statusBadge"], "ON_TRACK")

    def test_get_contract_overview_skips_rejected_milestones_for_next_milestone(self) -> None:
        self.e4m_contract.milestones[1].status = "REJECTED"

        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-e4m-001")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload["statusBadge"], "DISPUTED")
        self.assertEqual(payload["nextMilestone"]["name"], "M3")

    def test_list_contracts_can_report_delayed_completed_and_disputed_states(self) -> None:
        delayed_contract = build_contract(
            "contract-delayed-001",
            consumer_id="consumer-e4m@test.com",
            pilot_type="FACTOR",
            product_name="Delayed Contract",
            delivery_offset_days=30,
            milestone_defs=[
                {"ref": "M1", "name": "Milestone 1", "planned_offset_days": -3, "status": "PENDING"},
            ],
            last_known_state={},
        )
        completed_contract = build_contract(
            "contract-completed-001",
            consumer_id="consumer-e4m@test.com",
            pilot_type="FACTOR",
            product_name="Completed Contract",
            delivery_offset_days=20,
            milestone_defs=[
                {"ref": "M1", "name": "Milestone 1", "planned_offset_days": -5, "status": "COMPLETED"},
            ],
            last_known_state={},
            status="COMPLETED",
        )
        disputed_contract = build_contract(
            "contract-disputed-001",
            consumer_id="consumer-e4m@test.com",
            pilot_type="E4M",
            product_name="Disputed Contract",
            delivery_offset_days=40,
            milestone_defs=[
                {"ref": "M1", "name": "Milestone 1", "planned_offset_days": 2, "status": "REJECTED"},
                {"ref": "M2", "name": "Milestone 2", "planned_offset_days": 6, "status": "PENDING"},
            ],
            last_known_state={},
        )
        session = FakeSession(
            [
                self.factor_contract,
                self.e4m_contract,
                self.tasowheel_contract,
                delayed_contract,
                completed_contract,
                disputed_contract,
            ]
        )

        async def override_session() -> Any:
            yield session

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-e4m@test.com",
                preferred_username="consumer-e4m@test.com",
                roles=("consumer",),
                contract_ids=(
                    "contract-factor-001",
                    "contract-e4m-001",
                    "contract-tasowheel-001",
                    "contract-delayed-001",
                    "contract-completed-001",
                    "contract-disputed-001",
                ),
            )

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

        client = TestClient(self.app)
        response = client.get("/api/v1/contracts")

        self.assertEqual(response.status_code, 200)
        badges = {item["id"]: item["statusBadge"] for item in response.json()["data"]}
        self.assertEqual(badges["contract-delayed-001"], "DELAYED")
        self.assertEqual(badges["contract-completed-001"], "COMPLETED")
        self.assertEqual(badges["contract-disputed-001"], "DISPUTED")

    def test_get_contract_overview_returns_404_for_unknown_contract(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/nonexistent")

        self.assertEqual(response.status_code, 404)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "CONTRACT_NOT_FOUND")

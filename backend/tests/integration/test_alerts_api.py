from __future__ import annotations

import unittest
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.alerts import router as alerts_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract


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
        self.commit_called = False

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        contract_id = params.get("public_id_1") or next(
            (value for value in params.values() if isinstance(value, str)),
            None,
        )
        return FakeResult(self.contracts_by_public_id.get(contract_id))

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(alerts_router, prefix="/api/v1")
    return app


def build_contract(
    public_id: str,
    *,
    consumer_id: str,
    alerts: list[dict[str, Any]],
) -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.consumer_id = consumer_id
    contract.config = {"public_id": public_id}

    alert_models: list[Alert] = []
    for alert_def in alerts:
        alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
        alert.contract = contract
        alert.rule_id = alert_def.get("rule_id")
        alert.condition_description = alert_def["description"]
        alert.severity = alert_def["severity"]
        alert.triggered_at = alert_def["triggered_at"]
        alert.acknowledged_at = alert_def.get("acknowledged_at")
        alert.resolved_at = alert_def.get("resolved_at")
        alert_models.append(alert)
    contract.alerts = alert_models
    contract.blockchain_events = []
    if alert_models:
        blockchain_event = BlockchainEvent(id=uuid.uuid4(), contract_id=contract.id)
        blockchain_event.contract = contract
        blockchain_event.event_type = "ALERT_RAISED"
        blockchain_event.transaction_hash = "0xmockdeadbeef"
        blockchain_event.created_at = datetime(2026, 1, 20, 8, 5, tzinfo=UTC)
        blockchain_event.event_data = {
            "alert_id": str(alert_models[0].id),
            "severity": alert_models[0].severity,
            "description": alert_models[0].condition_description,
        }
        contract.blockchain_events = [blockchain_event]
    return contract


class AlertsApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.factor_contract = build_contract(
            "contract-factor-001",
            consumer_id="consumer-factor@test.com",
            alerts=[
                {
                    "severity": "HIGH",
                    "description": "No production update received for 12 hours (expected: every 4 hours)",
                    "triggered_at": datetime(2026, 1, 20, 8, 0, tzinfo=UTC),
                },
                {
                    "severity": "CRITICAL",
                    "description": "Cooling line offline for 30 minutes",
                    "triggered_at": datetime(2026, 1, 21, 8, 0, tzinfo=UTC),
                },
                {
                    "severity": "LOW",
                    "description": "Minor variance detected in ambient readings",
                    "triggered_at": datetime(2026, 2, 5, 9, 0, tzinfo=UTC),
                    "acknowledged_at": datetime(2026, 2, 5, 10, 0, tzinfo=UTC),
                },
            ],
        )
        self.session = FakeSession([self.factor_contract])

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

    def test_list_active_alerts_returns_unacknowledged_alerts_by_severity(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/alerts")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(len(payload), 2)
        self.assertEqual([item["severity"] for item in payload], ["CRITICAL", "HIGH"])
        self.assertFalse(payload[0]["blockchainVerified"])
        self.assertTrue(payload[1]["blockchainVerified"])
        self.assertEqual(
            payload[1]["description"],
            "No production update received for 12 hours (expected: every 4 hours)",
        )

    def test_acknowledge_moves_alert_out_of_active_list_but_keeps_it_in_history(self) -> None:
        target_alert = self.factor_contract.alerts[0]
        client = TestClient(self.app)

        acknowledge_response = client.post(
            f"/api/v1/contracts/contract-factor-001/alerts/{target_alert.id}/acknowledge"
        )
        self.assertEqual(acknowledge_response.status_code, 200)
        self.assertTrue(self.session.commit_called)
        self.assertIsNotNone(target_alert.acknowledged_at)

        active_response = client.get("/api/v1/contracts/contract-factor-001/alerts")
        history_response = client.get("/api/v1/contracts/contract-factor-001/alerts/history")

        self.assertEqual(active_response.status_code, 200)
        self.assertEqual(history_response.status_code, 200)
        active_ids = {item["id"] for item in active_response.json()["data"]}
        history_ids = {item["id"] for item in history_response.json()["data"]}
        self.assertNotIn(str(target_alert.id), active_ids)
        self.assertIn(str(target_alert.id), history_ids)

    def test_alert_history_can_filter_by_severity(self) -> None:
        client = TestClient(self.app)
        response = client.get(
            "/api/v1/contracts/contract-factor-001/alerts/history",
            params={"severity": "HIGH"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["severity"], "HIGH")

    def test_alert_history_can_filter_by_date_range(self) -> None:
        client = TestClient(self.app)
        response = client.get(
            "/api/v1/contracts/contract-factor-001/alerts/history",
            params={"from": "2026-01-01", "to": "2026-01-31"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(len(payload), 2)
        self.assertTrue(
            all(item["triggeredAt"].startswith("2026-01") for item in payload)
        )

    def test_acknowledge_returns_404_for_unknown_alert(self) -> None:
        client = TestClient(self.app)
        response = client.post(
            f"/api/v1/contracts/contract-factor-001/alerts/{uuid.uuid4()}/acknowledge"
        )

        self.assertEqual(response.status_code, 404)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "ALERT_NOT_FOUND")

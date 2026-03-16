from __future__ import annotations

import unittest
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.analytics import router as analytics_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate


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

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        contract_id = params.get("public_id_1") or next(
            (value for value in params.values() if isinstance(value, str)),
            None,
        )
        return FakeResult(self.contracts_by_public_id.get(contract_id))


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(analytics_router, prefix="/api/v1")
    return app


def build_contract(
    public_id: str,
    *,
    pilot_type: str,
    delivery_offset_days: int,
    activated_days_ago: int,
    milestone_defs: list[dict[str, Any]],
    updates: list[dict[str, Any]],
    last_known_state: dict[str, Any],
    alerts: list[dict[str, Any]] | None = None,
) -> Contract:
    today = date.today()
    now = datetime.now(UTC)
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.consumer_id = "consumer@test.com"
    contract.delivery_date = today + timedelta(days=delivery_offset_days)
    contract.activated_at = now - timedelta(days=activated_days_ago)
    contract.config = {"public_id": public_id, "last_known_state": last_known_state}

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
        milestones.append(milestone)
    contract.milestones = milestones

    status_updates: list[StatusUpdate] = []
    for update_def in updates:
        update = StatusUpdate(id=uuid.uuid4(), contract_id=contract.id)
        update.contract = contract
        update.update_type = update_def.get("update_type", "PRODUCTION_UPDATE")
        update.sensor_id = update_def.get("sensor_id", "sensor-1")
        update.timestamp = update_def["timestamp"]
        update.payload = update_def["payload"]
        update.processed = True
        status_updates.append(update)
    contract.status_updates = status_updates

    alert_models: list[Alert] = []
    for alert_def in alerts or []:
        alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
        alert.contract = contract
        alert.severity = alert_def["severity"]
        alert.triggered_at = alert_def["triggered_at"]
        alert.acknowledged_at = alert_def.get("acknowledged_at")
        alert.resolved_at = alert_def.get("resolved_at")
        alert_models.append(alert)
    contract.alerts = alert_models

    return contract


class AnalyticsApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        now = datetime.now(UTC)
        today = date.today()
        self.factor_contract = build_contract(
            "contract-factor-001",
            pilot_type="FACTOR",
            delivery_offset_days=90,
            activated_days_ago=5,
            milestone_defs=[
                {
                    "ref": "TURNING",
                    "name": "Turning",
                    "planned_offset_days": -3,
                    "actual_date": today - timedelta(days=4),
                    "status": "COMPLETED",
                },
                {
                    "ref": "HEAT",
                    "name": "Heat Treatment",
                    "planned_offset_days": 4,
                    "status": "PENDING",
                },
            ],
            updates=[
                {
                    "timestamp": now - timedelta(days=4),
                    "payload": {
                        "qualityPassRate": 0.92,
                        "quantityProduced": 1000,
                        "quantityPlanned": 12000,
                    },
                },
                {
                    "timestamp": now - timedelta(days=3),
                    "payload": {
                        "qualityPassRate": 0.94,
                        "quantityProduced": 2000,
                        "quantityPlanned": 12000,
                    },
                },
                {
                    "timestamp": now - timedelta(days=2),
                    "payload": {
                        "qualityPassRate": 0.96,
                        "quantityProduced": 3000,
                        "quantityPlanned": 12000,
                    },
                },
                {
                    "timestamp": now - timedelta(days=1),
                    "payload": {
                        "qualityPassRate": 0.98,
                        "quantityProduced": 4000,
                        "quantityPlanned": 12000,
                    },
                },
                {
                    "timestamp": now,
                    "payload": {
                        "qualityPassRate": 1.0,
                        "quantityProduced": 5000,
                        "quantityPlanned": 12000,
                    },
                },
            ],
            last_known_state={"shiftsCompleted": 5},
        )
        self.tasowheel_contract = build_contract(
            "contract-tasowheel-001",
            pilot_type="TASOWHEEL",
            delivery_offset_days=75,
            activated_days_ago=4,
            milestone_defs=[
                {"ref": "STEP_10", "name": "Blank Preparation", "planned_offset_days": 2, "status": "PENDING"},
                {"ref": "STEP_20", "name": "CNC Machining", "planned_offset_days": 12, "status": "PENDING"},
            ],
            updates=[
                {
                    "timestamp": now - timedelta(days=2),
                    "payload": {
                        "routingStep": 10,
                        "stepName": "Blank Preparation",
                        "cycleTimeActualSec": 150,
                        "setupTimeActualMin": 30,
                        "downtimeMinutes": 4,
                        "energyKwh": 20.5,
                        "carbonKgCo2e": 8.4,
                    },
                },
                {
                    "timestamp": now - timedelta(days=1),
                    "payload": {
                        "routingStep": 20,
                        "stepName": "CNC Machining",
                        "cycleTimeActualSec": 140,
                        "setupTimeActualMin": 25,
                        "downtimeMinutes": 6,
                        "energyKwh": 21.0,
                        "carbonKgCo2e": 8.9,
                    },
                },
            ],
            last_known_state={"cycleTimeActualSec": 155},
        )
        self.e4m_contract = build_contract(
            "contract-e4m-001",
            pilot_type="E4M",
            delivery_offset_days=120,
            activated_days_ago=6,
            milestone_defs=[
                {
                    "ref": "M1",
                    "name": "M1",
                    "planned_offset_days": -4,
                    "actual_date": today - timedelta(days=3),
                    "status": "COMPLETED",
                },
                {
                    "ref": "M2",
                    "name": "M2",
                    "planned_offset_days": -1,
                    "actual_date": today - timedelta(days=1),
                    "status": "COMPLETED",
                },
                {
                    "ref": "M3",
                    "name": "M3",
                    "planned_offset_days": 10,
                    "status": "PENDING",
                },
            ],
            updates=[
                {
                    "timestamp": now - timedelta(days=2),
                    "update_type": "PHASE_CHANGE",
                    "payload": {
                        "currentPhase": "M2",
                        "completionPct": 92,
                        "testResults": [
                            {"result": "PASS"},
                            {"result": "FAIL"},
                            {"result": "PASS"},
                        ],
                        "issues": [
                            {"severity": "HIGH", "status": "OPEN", "title": "Thermal issue"},
                        ],
                    },
                }
            ],
            last_known_state={
                "issues": [
                    {"severity": "HIGH", "status": "OPEN", "title": "Thermal issue"},
                ]
            },
            alerts=[
                {"severity": "HIGH", "triggered_at": now - timedelta(hours=2)},
            ],
        )
        self.session = FakeSession(
            [self.factor_contract, self.tasowheel_contract, self.e4m_contract]
        )

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer@test.com",
                preferred_username="consumer@test.com",
                roles=("consumer",),
                contract_ids=(
                    "contract-factor-001",
                    "contract-tasowheel-001",
                    "contract-e4m-001",
                ),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_factor_analytics_includes_factor_specific_metrics(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/analytics")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertIn("automatedUpdatesPct", payload)
        self.assertIn("qualityPassRateAvg", payload)
        self.assertIn("scheduleAdherence", payload)
        self.assertEqual(payload["qualityPassRateAvg"], 0.96)
        self.assertIn("overallProgress", payload)
        self.assertIn("daysUntilDelivery", payload)
        self.assertEqual(len(payload["milestoneSeries"]), 2)
        self.assertEqual(len(payload["factorQualitySeries"]), 5)
        self.assertEqual(len(payload["factorVelocitySeries"]), 5)
        self.assertEqual(payload["factorQualitySeries"][-1]["qualityPassRatePct"], 100.0)
        self.assertEqual(payload["factorVelocitySeries"][0]["quantityDelta"], 1000)

    def test_tasowheel_analytics_includes_energy_and_carbon_metrics(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-tasowheel-001/analytics")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertIn("totalEnergyKwh", payload)
        self.assertIn("totalCarbonKgCo2e", payload)
        self.assertIn("avgCycleTimeEfficiency", payload)
        self.assertIn("resourceUtilisationPct", payload)
        self.assertEqual(payload["totalEnergyKwh"], 41.5)
        self.assertEqual(payload["totalCarbonKgCo2e"], 17.3)
        self.assertIn("overallProgress", payload)
        self.assertIn("daysUntilDelivery", payload)
        self.assertEqual(len(payload["milestoneSeries"]), 2)
        self.assertEqual(len(payload["tasowheelEnergySeries"]), 2)
        self.assertEqual(len(payload["tasowheelCarbonSeries"]), 2)
        self.assertEqual(payload["tasowheelEnergySeries"][0]["stepLabel"], "Blank Preparation")
        self.assertEqual(payload["tasowheelCarbonSeries"][-1]["cumulativeCarbonKgCo2e"], 17.3)

    def test_e4m_analytics_includes_test_pass_rate_and_open_issue_count(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-e4m-001/analytics")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertIn("testPassRate", payload)
        self.assertIn("openIssueCount", payload)
        self.assertEqual(payload["testPassRate"], 66.67)
        self.assertEqual(payload["openIssueCount"], 1)
        self.assertIn("overallProgress", payload)
        self.assertIn("daysUntilDelivery", payload)
        self.assertFalse(payload["isOnTrack"])
        self.assertEqual(len(payload["milestoneSeries"]), 3)
        self.assertEqual(len(payload["e4mPhaseSeries"]), 3)
        self.assertEqual(
            payload["e4mTestBreakdown"],
            [
                {"count": 1, "result": "FAIL"},
                {"count": 2, "result": "PASS"},
            ],
        )

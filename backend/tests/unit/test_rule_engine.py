from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.services.rule_engine import RuleEngine


class FakeRuleSession:
    def __init__(self) -> None:
        self.added: list[Any] = []

    def add(self, instance: Any) -> None:
        self.added.append(instance)


def build_contract(
    *,
    public_id: str = "contract-factor-001",
    pilot_type: str = "FACTOR",
    quality_target: float | None = None,
    today: date | None = None,
) -> Contract:
    current_day = today or date(2026, 3, 16)
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.activated_at = datetime.combine(
        current_day - timedelta(days=10),
        datetime.min.time(),
        tzinfo=UTC,
    )
    contract.delivery_date = current_day + timedelta(days=10)
    contract.config = {
        "public_id": public_id,
        "last_known_state": {},
    }
    if quality_target is not None:
        contract.config["quality_target"] = quality_target
    contract.alerts = []
    contract.milestones = []
    return contract


def build_update(
    contract: Contract,
    *,
    update_type: str,
    payload: dict[str, Any],
) -> StatusUpdate:
    update = StatusUpdate(
        id=uuid.uuid4(),
        contract_id=contract.id,
        update_type=update_type,
        sensor_id="sensor-1",
        timestamp=datetime(2026, 3, 16, 12, 0, tzinfo=UTC),
        payload=payload,
        evidence=[],
        processed=False,
    )
    update.contract = contract
    return update


class RuleEngineTestCase(unittest.TestCase):
    def _run(self, coroutine: Any) -> Any:
        return asyncio.run(coroutine)

    def test_factor_quality_threshold_alert_fires_below_threshold(self) -> None:
        contract = build_contract(quality_target=0.95)
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"qualityPassRate": 0.80},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime(2026, 3, 16, 14, 0, tzinfo=UTC),
            )
        )

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_id, "QUALITY_THRESHOLD")
        self.assertEqual(alerts[0].severity, "HIGH")

    def test_factor_quality_threshold_does_not_fire_above_threshold(self) -> None:
        contract = build_contract(quality_target=0.95)
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"qualityPassRate": 0.97},
        )
        session = FakeRuleSession()

        alerts = self._run(RuleEngine.evaluate(contract, update, session))

        self.assertEqual(alerts, [])
        self.assertEqual(session.added, [])

    def test_e4m_test_failure_alert_fires_on_failed_test(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        update = build_update(
            contract,
            update_type="PHASE_CHANGE",
            payload={"testResults": [{"testName": "Thermal cycling", "result": "FAIL"}]},
        )
        session = FakeRuleSession()

        alerts = self._run(RuleEngine.evaluate(contract, update, session))

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_id, "TEST_FAILURE")
        self.assertEqual(alerts[0].severity, "CRITICAL")

    def test_e4m_test_failure_does_not_fire_when_all_tests_pass(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        update = build_update(
            contract,
            update_type="PHASE_CHANGE",
            payload={
                "testResults": [
                    {"testName": "Thermal cycling", "result": "PASS"},
                    {"testName": "Load case", "result": "PASS"},
                ]
            },
        )
        session = FakeRuleSession()

        alerts = self._run(RuleEngine.evaluate(contract, update, session))

        self.assertEqual(alerts, [])

    def test_milestone_overdue_alert_fires_for_in_progress_overdue_milestone(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(public_id="contract-tasowheel-001", pilot_type="TASOWHEEL", today=current_day)
        contract.activated_at = datetime(2026, 3, 16, 0, 0, tzinfo=UTC)
        milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
        milestone.milestone_ref = "STEP_20"
        milestone.name = "CNC Machining"
        milestone.planned_date = current_day - timedelta(days=1)
        milestone.status = "IN_PROGRESS"
        contract.milestones = [milestone]
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"routingStep": 20, "stepStatus": "IN_PROGRESS"},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime(2026, 3, 16, 9, 0, tzinfo=UTC),
            )
        )

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_id, "MILESTONE_OVERDUE")
        self.assertEqual(alerts[0].severity, "MEDIUM")
        self.assertIn("STEP_20", alerts[0].condition_description or "")

    def test_delay_rule_fires_when_quantity_ratio_lags_timeline(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(pilot_type="TASOWHEEL", today=current_day)
        # 10 days elapsed out of 20 total (50% time), only 10% quantity done
        contract.activated_at = datetime.combine(current_day - timedelta(days=10), datetime.min.time(), tzinfo=UTC)
        contract.delivery_date = current_day + timedelta(days=10)
        contract.config = {
            "public_id": contract.public_id,
            "last_known_state": {},
            "alert_conditions": [
                {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 2},
            ],
        }
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"quantityProduced": 24, "quantityPlanned": 240},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime.combine(current_day, datetime.min.time(), tzinfo=UTC),
            )
        )

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_id, "DELAY")
        self.assertEqual(alerts[0].severity, "MEDIUM")

    def test_delay_rule_does_not_fire_when_progress_is_on_track(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(pilot_type="TASOWHEEL", today=current_day)
        contract.activated_at = datetime.combine(current_day - timedelta(days=10), datetime.min.time(), tzinfo=UTC)
        contract.delivery_date = current_day + timedelta(days=10)
        contract.config = {
            "public_id": contract.public_id,
            "last_known_state": {},
            "alert_conditions": [
                {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 2},
            ],
        }
        # 50% time elapsed, 60% complete — ahead of schedule
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"quantityProduced": 144, "quantityPlanned": 240},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime.combine(current_day, datetime.min.time(), tzinfo=UTC),
            )
        )

        self.assertEqual(alerts, [])

    def test_delay_rule_uses_completion_pct_when_no_quantity_in_payload(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(pilot_type="FACTOR", today=current_day)
        contract.activated_at = datetime.combine(current_day - timedelta(days=10), datetime.min.time(), tzinfo=UTC)
        contract.delivery_date = current_day + timedelta(days=10)
        contract.config = {
            "public_id": contract.public_id,
            "last_known_state": {},
            "alert_conditions": [
                {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 2},
            ],
        }
        # 50% time elapsed, only 5% completion → behind schedule
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"completionPct": 5.0},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime.combine(current_day, datetime.min.time(), tzinfo=UTC),
            )
        )

        delay_alerts = [a for a in alerts if a.rule_id == "DELAY"]
        self.assertEqual(len(delay_alerts), 1)

    def test_delay_rule_does_not_fire_when_delivery_date_is_missing(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(pilot_type="TASOWHEEL", today=current_day)
        contract.delivery_date = None
        contract.config = {
            "public_id": contract.public_id,
            "last_known_state": {},
            "alert_conditions": [
                {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 2},
            ],
        }
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"quantityProduced": 1, "quantityPlanned": 240},
        )
        session = FakeRuleSession()

        alerts = self._run(RuleEngine.evaluate(contract, update, session))

        self.assertNotIn("DELAY", [a.rule_id for a in alerts])

    def test_delay_rule_respects_custom_threshold_days(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(pilot_type="TASOWHEEL", today=current_day)
        contract.activated_at = datetime.combine(current_day - timedelta(days=10), datetime.min.time(), tzinfo=UTC)
        contract.delivery_date = current_day + timedelta(days=10)
        contract.config = {
            "public_id": contract.public_id,
            "last_known_state": {},
            "alert_conditions": [
                # Very high threshold — should not fire even when behind schedule
                {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 999},
            ],
        }
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"quantityProduced": 1, "quantityPlanned": 240},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime.combine(current_day, datetime.min.time(), tzinfo=UTC),
            )
        )

        self.assertNotIn("DELAY", [a.rule_id for a in alerts])

    def test_delay_rule_falls_back_to_milestone_count_when_no_quantity_or_pct(self) -> None:
        current_day = date(2026, 3, 16)
        contract = build_contract(pilot_type="TASOWHEEL", today=current_day)
        contract.activated_at = datetime.combine(current_day - timedelta(days=10), datetime.min.time(), tzinfo=UTC)
        contract.delivery_date = current_day + timedelta(days=10)
        contract.config = {
            "public_id": contract.public_id,
            "last_known_state": {},
            "alert_conditions": [
                {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 1},
            ],
        }
        # 4 milestones, 0 complete → progress ratio 0/4 = 0%; 50% time elapsed → behind
        contract.milestones = []
        for ref in ("STEP_10", "STEP_20", "STEP_30", "STEP_40"):
            m = Milestone(id=uuid.uuid4(), contract_id=contract.id)
            m.milestone_ref = ref
            m.status = "PENDING"
            m.planned_date = current_day + timedelta(days=5)
            contract.milestones.append(m)

        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"routingStep": 10},
        )
        session = FakeRuleSession()

        alerts = self._run(
            RuleEngine.evaluate(
                contract,
                update,
                session,
                now=datetime.combine(current_day, datetime.min.time(), tzinfo=UTC),
            )
        )

        delay_alerts = [a for a in alerts if a.rule_id == "DELAY"]
        self.assertEqual(len(delay_alerts), 1)

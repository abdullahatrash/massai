from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import UTC, date, datetime
from typing import Any

from app.core.response import ApiException
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.status_update import StatusUpdate
from app.services.monitoring import MonitoringService


class FakeScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeMonitoringSession:
    def __init__(
        self,
        *,
        contract: Contract | None = None,
        execute_results: list[Any] | None = None,
    ) -> None:
        self.contract = contract
        self.execute_results = list(execute_results or [])
        self.loaded_milestones: dict[Any, Milestone] = {}
        self.added: list[Any] = []

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if identifier in self.loaded_milestones:
            return self.loaded_milestones[identifier]
        if self.contract is not None and identifier == self.contract.id:
            return self.contract
        return None

    async def execute(self, statement: Any) -> FakeScalarResult:
        if self.execute_results:
            value = self.execute_results.pop(0)
            if isinstance(value, Milestone):
                self.loaded_milestones[value.id] = value
            return FakeScalarResult(value)
        return FakeScalarResult(None)

    def add(self, instance: Any) -> None:
        self.added.append(instance)


def build_contract(*, public_id: str = "contract-factor-001", pilot_type: str = "FACTOR") -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.consumer_id = "consumer@test.com"
    contract.provider_id = "provider@test.com"
    contract.config = {
        "public_id": public_id,
        "quality_target": 0.95,
        "last_known_state": {
            "existingField": True,
        },
    }
    contract.alerts = []
    contract.milestones = []
    contract.notifications = []
    return contract


def build_update(
    contract: Contract,
    *,
    update_type: str,
    payload: dict[str, Any],
    evidence: list[str] | None = None,
) -> StatusUpdate:
    update = StatusUpdate(
        id=uuid.uuid4(),
        contract_id=contract.id,
        update_type=update_type,
        sensor_id="sensor-1",
        timestamp=datetime.now(UTC),
        payload=payload,
        evidence=evidence or [],
        processed=False,
    )
    return update


class MonitoringServiceTestCase(unittest.TestCase):
    def _run(self, coroutine: Any) -> Any:
        return asyncio.run(coroutine)

    def test_milestone_complete_submits_matching_milestone(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
        milestone.milestone_ref = "M2"
        milestone.status = "PENDING"
        milestone.approval_required = True
        milestone.completion_criteria = {"currentPhase": "M2", "completionPct": 100}
        milestone.evidence = []
        update = build_update(
            contract,
            update_type="MILESTONE_COMPLETE",
            payload={"milestoneRef": "M2", "currentPhase": "M2", "completionPct": 100},
            evidence=["https://example.com/evidence/m2"],
        )
        session = FakeMonitoringSession(contract=contract, execute_results=[milestone])
        processed_at = datetime(2026, 3, 16, 15, 30, tzinfo=UTC)

        self._run(MonitoringService.process_update(update, session, now=processed_at))

        self.assertEqual(milestone.status, "SUBMITTED")
        self.assertEqual(milestone.actual_date, date(2026, 3, 16))
        self.assertEqual(milestone.evidence, ["https://example.com/evidence/m2"])
        notification = self._single_added(session, Notification)
        self.assertEqual(notification.event_type, "MILESTONE_AWAITING_APPROVAL")
        self.assertEqual(notification.payload["milestoneRef"], "M2")
        self.assertTrue(update.processed)

    def test_production_update_merges_last_known_state(self) -> None:
        contract = build_contract()
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={
                "quantityProduced": 2200,
                "qualityPassRate": 0.98,
            },
        )
        session = FakeMonitoringSession(contract=contract)

        self._run(MonitoringService.process_update(update, session))

        self.assertEqual(contract.config["last_known_state"]["quantityProduced"], 2200)
        self.assertEqual(contract.config["last_known_state"]["qualityPassRate"], 0.98)
        self.assertTrue(contract.config["last_known_state"]["existingField"])
        self.assertTrue(update.processed)

    def test_phase_change_updates_current_phase(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        update = build_update(
            contract,
            update_type="PHASE_CHANGE",
            payload={
                "currentPhase": "M2_CONCEPT",
                "completionPct": 45,
            },
        )
        session = FakeMonitoringSession(contract=contract)

        self._run(MonitoringService.process_update(update, session))

        self.assertEqual(contract.config["current_phase"], "M2_CONCEPT")
        self.assertEqual(contract.config["last_known_state"]["currentPhase"], "M2_CONCEPT")
        self.assertEqual(contract.config["last_known_state"]["completionPct"], 45)
        self.assertTrue(update.processed)

    def test_quality_event_triggers_quality_threshold_alert(self) -> None:
        contract = build_contract()
        update = build_update(
            contract,
            update_type="QUALITY_EVENT",
            payload={"qualityPassRate": 0.81},
        )
        session = FakeMonitoringSession(contract=contract)
        processed_at = datetime(2026, 3, 16, 18, 0, tzinfo=UTC)

        self._run(MonitoringService.process_update(update, session, now=processed_at))

        alert = self._single_added(session, Alert)
        self.assertEqual(alert.rule_id, "QUALITY_THRESHOLD")
        self.assertEqual(alert.severity, "HIGH")
        self.assertEqual(alert.triggered_at, processed_at)
        self.assertEqual(contract.config["last_known_state"]["qualityPassRate"], 0.81)
        self.assertTrue(update.processed)

    def test_new_update_resolves_unresolved_no_data_alert(self) -> None:
        contract = build_contract()
        existing_alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing_alert.rule_id = "NO_DATA_RECEIVED"
        existing_alert.severity = "MEDIUM"
        existing_alert.triggered_at = datetime(2026, 3, 16, 17, 0, tzinfo=UTC)
        existing_alert.resolved_at = None
        contract.alerts = [existing_alert]
        update = build_update(
            contract,
            update_type="PRODUCTION_UPDATE",
            payload={"quantityProduced": 2200, "qualityPassRate": 0.98},
        )
        session = FakeMonitoringSession(contract=contract)
        processed_at = datetime(2026, 3, 16, 18, 0, tzinfo=UTC)

        self._run(MonitoringService.process_update(update, session, now=processed_at))

        self.assertEqual(existing_alert.resolved_at, processed_at)

    def test_milestone_complete_raises_when_milestone_ref_is_missing(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        update = build_update(
            contract,
            update_type="MILESTONE_COMPLETE",
            payload={"currentPhase": "M2", "completionPct": 100},  # no milestoneRef
        )
        session = FakeMonitoringSession(contract=contract)

        with self.assertRaises(ApiException) as ctx:
            self._run(MonitoringService.process_update(update, session))

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.code, "MISSING_MILESTONE_REF")

    def test_milestone_complete_raises_when_milestone_ref_is_unknown(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        update = build_update(
            contract,
            update_type="MILESTONE_COMPLETE",
            payload={"milestoneRef": "NONEXISTENT", "currentPhase": "M2", "completionPct": 100},
        )
        # session returns None for the milestone lookup
        session = FakeMonitoringSession(contract=contract, execute_results=[None])

        with self.assertRaises(ApiException) as ctx:
            self._run(MonitoringService.process_update(update, session))

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.code, "MILESTONE_NOT_FOUND")

    @staticmethod
    def _single_added(session: FakeMonitoringSession, model: type[Any]) -> Any:
        matches = [item for item in session.added if isinstance(item, model)]
        if len(matches) != 1:
            raise AssertionError(f"Expected exactly one {model.__name__}, found {len(matches)}")
        return matches[0]

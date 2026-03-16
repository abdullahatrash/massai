from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, patch

from app.models.alert import Alert
from app.models.contract import Contract
from app.workers.no_data_checker import NoDataChecker


class FakeScalarListResult:
    def __init__(self, values: list[Contract]) -> None:
        self._values = values

    def scalars(self) -> "FakeScalarListResult":
        return self

    def all(self) -> list[Contract]:
        return self._values


class FakeWorkerSession:
    def __init__(self, contracts: list[Contract]) -> None:
        self.contracts = contracts
        self.added: list[Any] = []
        self.commit_called = False

    async def __aenter__(self) -> "FakeWorkerSession":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def execute(self, statement: Any) -> FakeScalarListResult:
        return FakeScalarListResult(self.contracts)

    def add(self, instance: Any) -> None:
        self.added.append(instance)

    async def commit(self) -> None:
        self.commit_called = True


def build_contract(*, public_id: str = "contract-factor-001") -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.status = "ACTIVE"
    contract.activated_at = datetime(2026, 3, 16, 9, 0, tzinfo=UTC)
    contract.config = {
        "public_id": public_id,
        "dataUpdateFrequency": 1,
        "last_known_state": {},
    }
    contract.status_updates = []
    contract.alerts = []
    return contract


class NoDataCheckerTestCase(unittest.TestCase):
    def _run(self, coroutine: Any) -> Any:
        return asyncio.run(coroutine)

    def test_evaluate_contract_creates_medium_alert_after_two_intervals(self) -> None:
        contract = build_contract()
        session = FakeWorkerSession([contract])
        now = datetime(2026, 3, 16, 9, 3, tzinfo=UTC)

        alert = NoDataChecker.evaluate_contract(contract, now=now, session=session)

        self.assertIsNotNone(alert)
        self.assertEqual(alert.rule_id, "NO_DATA_RECEIVED")
        self.assertEqual(alert.severity, "MEDIUM")
        self.assertEqual(len(contract.alerts), 1)
        self.assertIn("3 minutes", alert.condition_description or "")

    def test_evaluate_contract_upgrades_existing_alert_to_high_without_duplicate(self) -> None:
        contract = build_contract()
        existing = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing.rule_id = "NO_DATA_RECEIVED"
        existing.severity = "MEDIUM"
        existing.triggered_at = datetime(2026, 3, 16, 9, 3, tzinfo=UTC)
        existing.blockchain_logged = False
        contract.alerts = [existing]
        session = FakeWorkerSession([contract])

        alert = NoDataChecker.evaluate_contract(
            contract,
            now=datetime(2026, 3, 16, 9, 7, tzinfo=UTC),
            session=session,
        )

        self.assertIs(alert, existing)
        self.assertEqual(existing.severity, "HIGH")
        self.assertEqual(len(contract.alerts), 1)
        self.assertEqual(session.added, [])

    def test_evaluate_contract_is_idempotent_when_alert_already_exists(self) -> None:
        contract = build_contract()
        existing = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing.rule_id = "NO_DATA_RECEIVED"
        existing.severity = "MEDIUM"
        existing.triggered_at = datetime(2026, 3, 16, 9, 3, tzinfo=UTC)
        contract.alerts = [existing]
        session = FakeWorkerSession([contract])

        NoDataChecker.evaluate_contract(
            contract,
            now=datetime(2026, 3, 16, 9, 4, tzinfo=UTC),
            session=session,
        )

        self.assertEqual(len(contract.alerts), 1)
        self.assertEqual(session.added, [])

    def test_evaluate_contract_resolves_alert_when_contract_is_back_within_threshold(self) -> None:
        contract = build_contract()
        existing = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing.rule_id = "NO_DATA_RECEIVED"
        existing.severity = "MEDIUM"
        existing.triggered_at = datetime(2026, 3, 16, 9, 3, tzinfo=UTC)
        existing.resolved_at = None
        contract.alerts = [existing]
        contract.status_updates = []
        session = FakeWorkerSession([contract])

        recent_update_time = datetime(2026, 3, 16, 9, 2, 30, tzinfo=UTC)
        from app.models.status_update import StatusUpdate

        status_update = StatusUpdate(id=uuid.uuid4(), contract_id=contract.id)
        status_update.timestamp = recent_update_time
        contract.status_updates = [status_update]

        result = NoDataChecker.evaluate_contract(
            contract,
            now=datetime(2026, 3, 16, 9, 3, tzinfo=UTC),
            session=session,
        )

        self.assertIsNone(result)
        self.assertIsNotNone(existing.resolved_at)

    def test_resolve_for_new_update_sets_resolved_at_on_active_no_data_alert(self) -> None:
        contract = build_contract()
        existing = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing.rule_id = "NO_DATA_RECEIVED"
        existing.severity = "HIGH"
        existing.triggered_at = datetime(2026, 3, 16, 9, 3, tzinfo=UTC)
        existing.resolved_at = None
        contract.alerts = [existing]
        now = datetime(2026, 3, 16, 9, 10, tzinfo=UTC)

        NoDataChecker.resolve_for_new_update(contract, now=now)

        self.assertEqual(existing.resolved_at, now)

    def test_resolve_for_new_update_is_noop_when_no_active_no_data_alert(self) -> None:
        contract = build_contract()
        contract.alerts = []

        NoDataChecker.resolve_for_new_update(contract, now=datetime(2026, 3, 16, 9, 10, tzinfo=UTC))

    def test_resolve_for_new_update_does_not_resolve_already_resolved_alert(self) -> None:
        contract = build_contract()
        existing = Alert(id=uuid.uuid4(), contract_id=contract.id)
        existing.rule_id = "NO_DATA_RECEIVED"
        existing.severity = "MEDIUM"
        existing.triggered_at = datetime(2026, 3, 16, 9, 3, tzinfo=UTC)
        existing.resolved_at = datetime(2026, 3, 16, 9, 5, tzinfo=UTC)
        contract.alerts = [existing]
        new_now = datetime(2026, 3, 16, 9, 10, tzinfo=UTC)

        NoDataChecker.resolve_for_new_update(contract, now=new_now)

        self.assertEqual(existing.resolved_at, datetime(2026, 3, 16, 9, 5, tzinfo=UTC))

    def test_run_once_logs_high_priority_alerts_after_commit(self) -> None:
        contract = build_contract()
        contract.activated_at = datetime(2026, 3, 16, 9, 0, tzinfo=UTC)
        session = FakeWorkerSession([contract])

        with patch("app.workers.no_data_checker.SessionLocal", return_value=session):
            with patch(
                "app.workers.no_data_checker.AlertBlockchainService.log_alerts",
                new=AsyncMock(),
            ) as log_alerts:
                with patch(
                    "app.workers.no_data_checker.datetime"
                ) as mock_datetime:
                    mock_datetime.now.return_value = datetime(2026, 3, 16, 9, 7, tzinfo=UTC)
                    mock_datetime.side_effect = datetime
                    self._run(NoDataChecker.run_once())

        self.assertTrue(session.commit_called)
        log_alerts.assert_awaited_once()

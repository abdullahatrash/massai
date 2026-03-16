from __future__ import annotations

import asyncio
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.core.blockchain import BlockchainWriteResult
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.blockchain_event import BlockchainEvent
from app.services.alert_blockchain import AlertBlockchainService
from app.services.blockchain_mock import MockBlockchainService


class FakeBlockchainSession:
    def __init__(self, *, alert: Alert, contract: Contract) -> None:
        self.alert = alert
        self.contract = contract
        self.added: list[object] = []
        self.commit_called = False

    async def __aenter__(self) -> "FakeBlockchainSession":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get(self, model, identifier):
        if model is Alert and identifier == self.alert.id:
            return self.alert
        if model is Contract and identifier == self.contract.id:
            return self.contract
        return None

    def add(self, instance: object) -> None:
        self.added.append(instance)

    async def commit(self) -> None:
        self.commit_called = True


def build_contract() -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = "contract-factor-001"
    contract.config = {"public_id": "contract-factor-001"}
    return contract


def build_alert(contract: Contract, *, severity: str) -> Alert:
    alert = Alert(id=uuid.uuid4(), contract_id=contract.id)
    alert.contract = contract
    alert.rule_id = "QUALITY_THRESHOLD"
    alert.severity = severity
    alert.condition_description = "Quality threshold breached"
    return alert


class BlockchainServiceTestCase(unittest.TestCase):
    def _run(self, coroutine):
        return asyncio.run(coroutine)

    def test_mock_blockchain_service_writes_sqlite_event_with_deterministic_hash(self) -> None:
        contract = build_contract()
        alert = build_alert(contract, severity="HIGH")
        service = MockBlockchainService()

        with tempfile.TemporaryDirectory() as tempdir:
            service._events_db_path = Path(tempdir) / "events.db"
            result = self._run(service.log_alert_event(contract, alert))

            self.assertTrue(result.transaction_hash.startswith("0xmock"))
            self.assertEqual(
                result.transaction_hash,
                f"0xmock{str(alert.id).replace('-', '')[:8]}",
            )
            self.assertIsNotNone(result.block_number)
            self.assertTrue(service._events_db_path.exists())

    def test_low_severity_alert_is_not_logged_to_blockchain(self) -> None:
        contract = build_contract()
        alert = build_alert(contract, severity="LOW")
        session = FakeBlockchainSession(alert=alert, contract=contract)

        with patch("app.services.alert_blockchain.SessionLocal", return_value=session):
            result = self._run(AlertBlockchainService._log_single_alert(alert.id))

        self.assertFalse(result)
        self.assertFalse(session.commit_called)
        self.assertEqual(session.added, [])

    def test_high_severity_alert_creates_blockchain_event_and_marks_alert_logged(self) -> None:
        contract = build_contract()
        alert = build_alert(contract, severity="HIGH")
        session = FakeBlockchainSession(alert=alert, contract=contract)
        fake_blockchain_service = AsyncMock()
        fake_blockchain_service.log_alert_event.return_value = BlockchainWriteResult(
            transaction_hash="0xmockabcd1234",
            block_number=7,
        )

        with patch("app.services.alert_blockchain.SessionLocal", return_value=session):
            with patch(
                "app.services.alert_blockchain.get_blockchain_service",
                return_value=fake_blockchain_service,
            ):
                logged = self._run(AlertBlockchainService._log_single_alert(alert.id))

        self.assertTrue(logged)
        self.assertTrue(alert.blockchain_logged)
        self.assertTrue(session.commit_called)
        self.assertEqual(len(session.added), 1)
        self.assertIsInstance(session.added[0], BlockchainEvent)
        self.assertEqual(session.added[0].event_type, "ALERT_RAISED")
        self.assertEqual(session.added[0].transaction_hash, "0xmockabcd1234")

    def test_blockchain_failures_retry_three_times_without_raising(self) -> None:
        alert_id = uuid.uuid4()
        with patch(
            "app.services.alert_blockchain.AlertBlockchainService._log_single_alert",
            new=AsyncMock(side_effect=RuntimeError("boom")),
        ) as log_single_alert:
            self._run(AlertBlockchainService._log_single_alert_with_retry(alert_id))

        self.assertEqual(log_single_alert.await_count, 3)

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from app.core.blockchain import get_blockchain_service
from app.core.database import SessionLocal
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract

logger = logging.getLogger("massai.api")
_BLOCKCHAIN_SEVERITIES = {"HIGH", "CRITICAL"}


class AlertBlockchainService:
    @staticmethod
    def high_priority_alert_ids(alerts: Sequence[Alert]) -> list[uuid.UUID]:
        return [
            alert.id
            for alert in alerts
            if alert.id is not None
            and (alert.severity or "").upper() in _BLOCKCHAIN_SEVERITIES
        ]

    @staticmethod
    async def log_alerts(alert_ids: Sequence[uuid.UUID]) -> None:
        for alert_id in alert_ids:
            await AlertBlockchainService._log_single_alert_with_retry(alert_id)

    @staticmethod
    async def _log_single_alert_with_retry(alert_id: uuid.UUID) -> None:
        delay_seconds = 0.1
        for attempt in range(1, 4):
            try:
                logged = await AlertBlockchainService._log_single_alert(alert_id)
            except Exception:
                if attempt == 3:
                    logger.exception(
                        "alert_blockchain_logging_failed",
                        extra={"alert_id": str(alert_id), "attempts": attempt},
                    )
                    return
                await asyncio.sleep(delay_seconds)
                delay_seconds *= 2
                continue

            return

    @staticmethod
    async def _log_single_alert(alert_id: uuid.UUID) -> bool:
        async with SessionLocal() as session:
            alert = await session.get(Alert, alert_id)
            if alert is None:
                return False
            if bool(alert.blockchain_logged):
                return False
            severity = (alert.severity or "").upper()
            if severity not in _BLOCKCHAIN_SEVERITIES:
                return False

            contract = alert.contract
            if contract is None:
                contract = await session.get(Contract, alert.contract_id)
            if contract is None:
                raise ValueError("Alert is missing its contract.")

            blockchain_service = get_blockchain_service()
            receipt = await blockchain_service.log_alert_event(contract, alert)
            session.add(
                BlockchainEvent(
                    contract_id=contract.id,
                    event_type="ALERT_RAISED",
                    transaction_hash=receipt.transaction_hash,
                    block_number=receipt.block_number,
                    event_data={
                        "alert_id": str(alert.id),
                        "rule_id": alert.rule_id,
                        "severity": alert.severity,
                        "description": alert.condition_description,
                    },
                    created_at=datetime.now(UTC),
                )
            )
            alert.blockchain_logged = True
            await session.commit()
            return True

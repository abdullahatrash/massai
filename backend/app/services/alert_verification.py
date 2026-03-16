from __future__ import annotations

from datetime import UTC, datetime

from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent


class AlertVerificationService:
    @staticmethod
    def build_index(
        blockchain_events: list[BlockchainEvent],
    ) -> dict[str, BlockchainEvent]:
        index: dict[str, BlockchainEvent] = {}
        for event in blockchain_events:
            event_data = dict(event.event_data or {})
            alert_id = event_data.get("alert_id") or event_data.get("alertId")
            if not isinstance(alert_id, str) or not alert_id:
                continue
            current = index.get(alert_id)
            if current is None or (
                current.created_at or datetime.min.replace(tzinfo=UTC)
            ) < (event.created_at or datetime.min.replace(tzinfo=UTC)):
                index[alert_id] = event
        return index

    @staticmethod
    def is_verified(
        alert: Alert,
        verification_index: dict[str, BlockchainEvent],
    ) -> bool:
        event = verification_index.get(str(alert.id))
        return bool(event and event.transaction_hash)

    @staticmethod
    def verified_at(
        alert: Alert,
        verification_index: dict[str, BlockchainEvent],
    ) -> datetime | None:
        event = verification_index.get(str(alert.id))
        if event is None or not event.transaction_hash:
            return None
        return event.created_at

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.status_update import StatusUpdate
from app.services.alert_blockchain import AlertBlockchainService
from app.services.notification import NotificationService


class NoDataChecker:
    _RULE_ID = "NO_DATA_RECEIVED"
    _MONITORED_CONTRACT_STATUSES = {"ACTIVE", "IN_PROGRESS"}

    @staticmethod
    async def run_forever(*, interval_seconds: int) -> None:
        while True:
            await NoDataChecker.run_once()
            await asyncio.sleep(max(interval_seconds, 1))

    @staticmethod
    async def run_once() -> None:
        async with SessionLocal() as session:
            contracts = await NoDataChecker._load_candidate_contracts(session)
            alert_ids_to_log: list[uuid.UUID] = []
            now = datetime.now(UTC)

            for contract in contracts:
                previous_alert = NoDataChecker._unresolved_no_data_alert(contract)
                previous_severity = (previous_alert.severity or "").upper() if previous_alert else None
                alert = NoDataChecker.evaluate_contract(contract, now=now, session=session)
                if alert is None or alert.id is None:
                    continue
                NoDataChecker._queue_notification_if_needed(
                    session,
                    contract,
                    alert,
                    previous_severity=previous_severity,
                    now=now,
                )
                if (
                    (alert.severity or "").upper() in {"HIGH", "CRITICAL"}
                    and not bool(alert.blockchain_logged)
                ):
                    alert_ids_to_log.append(alert.id)

            await session.commit()

        if alert_ids_to_log:
            await AlertBlockchainService.log_alerts(alert_ids_to_log)

    @staticmethod
    async def _load_candidate_contracts(session) -> list[Contract]:
        result = await session.execute(
            select(Contract)
            .options(
                selectinload(Contract.alerts),
                selectinload(Contract.status_updates),
            )
            .where(Contract.status.in_(list(NoDataChecker._MONITORED_CONTRACT_STATUSES)))
        )
        return list(result.scalars().all())

    @staticmethod
    def evaluate_contract(
        contract: Contract,
        *,
        now: datetime,
        session,
    ) -> Alert | None:
        frequency = NoDataChecker._parse_frequency(contract.config)
        if frequency is None:
            return None

        reference_time = NoDataChecker._reference_time(contract)
        if reference_time is None:
            return None

        unresolved_alert = NoDataChecker._unresolved_no_data_alert(contract)
        elapsed = now - reference_time
        if elapsed <= frequency * 2:
            if unresolved_alert is not None:
                unresolved_alert.resolved_at = now
            return None

        severity = "HIGH" if elapsed > frequency * 3 else "MEDIUM"
        description = NoDataChecker._build_description(elapsed, frequency)

        if unresolved_alert is not None:
            unresolved_alert.severity = severity
            unresolved_alert.condition_description = description
            return unresolved_alert

        alert = Alert(
            id=uuid.uuid4(),
            contract_id=contract.id,
            rule_id=NoDataChecker._RULE_ID,
            severity=severity,
            condition_description=description,
            triggered_at=now,
            blockchain_logged=False,
        )
        alert.contract = contract
        session.add(alert)
        if contract.alerts is None:
            contract.alerts = [alert]
        elif alert not in contract.alerts:
            contract.alerts.append(alert)
        return alert

    @staticmethod
    def resolve_for_new_update(contract: Contract, *, now: datetime) -> None:
        alert = NoDataChecker._unresolved_no_data_alert(contract)
        if alert is not None:
            alert.resolved_at = now

    @staticmethod
    def _queue_notification_if_needed(
        session,
        contract: Contract,
        alert: Alert,
        *,
        previous_severity: str | None,
        now: datetime,
    ) -> None:
        current_severity = (alert.severity or "").upper()
        should_send = previous_severity is None or previous_severity != current_severity
        if not should_send:
            return
        NotificationService.send(
            session,
            recipient_id=contract.consumer_id,
            event_type="NO_DATA_RECEIVED",
            message=NotificationService.alert_message(
                contract,
                alert.condition_description or "No production update received.",
            ),
            contract_id=contract.id,
            payload={
                "contractId": contract.public_id or str((contract.config or {}).get("public_id") or ""),
                "alertId": str(alert.id),
                "severity": alert.severity,
                "ruleId": alert.rule_id,
            },
            now=now,
        )

    @staticmethod
    def _unresolved_no_data_alert(contract: Contract) -> Alert | None:
        for alert in contract.alerts or []:
            if (alert.rule_id or "").upper() != NoDataChecker._RULE_ID:
                continue
            if alert.resolved_at is None:
                return alert
        return None

    @staticmethod
    def _reference_time(contract: Contract) -> datetime | None:
        update_timestamps = [
            NoDataChecker._ensure_aware(update.timestamp)
            for update in contract.status_updates or []
            if update.timestamp is not None
        ]
        update_timestamps = [item for item in update_timestamps if item is not None]
        if update_timestamps:
            return max(update_timestamps)
        activated_at = NoDataChecker._ensure_aware(contract.activated_at)
        if activated_at is not None:
            return activated_at
        return NoDataChecker._ensure_aware(contract.created_at)

    @staticmethod
    def _parse_frequency(config: dict[str, Any] | None) -> timedelta | None:
        raw_value = dict(config or {}).get("dataUpdateFrequency")
        if raw_value is None:
            return None
        if isinstance(raw_value, (int, float)):
            return timedelta(minutes=float(raw_value)) if raw_value > 0 else None
        if isinstance(raw_value, str):
            try:
                minutes = float(raw_value)
            except ValueError:
                return None
            return timedelta(minutes=minutes) if minutes > 0 else None
        if isinstance(raw_value, dict):
            if raw_value.get("minutes") is not None:
                try:
                    minutes = float(raw_value["minutes"])
                except (TypeError, ValueError):
                    return None
                return timedelta(minutes=minutes) if minutes > 0 else None
            if raw_value.get("seconds") is not None:
                try:
                    seconds = float(raw_value["seconds"])
                except (TypeError, ValueError):
                    return None
                return timedelta(seconds=seconds) if seconds > 0 else None
        return None

    @staticmethod
    def _build_description(elapsed: timedelta, frequency: timedelta) -> str:
        elapsed_text = NoDataChecker._format_duration(elapsed)
        frequency_text = NoDataChecker._format_duration(frequency)
        return (
            f"No production update received for {elapsed_text} "
            f"(expected: every {frequency_text})."
        )

    @staticmethod
    def _format_duration(duration: timedelta) -> str:
        total_seconds = max(int(duration.total_seconds()), 0)
        total_minutes = max(total_seconds // 60, 1)
        if total_minutes < 60:
            return f"{total_minutes} minute{'s' if total_minutes != 1 else ''}"
        total_hours = total_minutes // 60
        return f"{total_hours} hour{'s' if total_hours != 1 else ''}"

    @staticmethod
    def _ensure_aware(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is not None and value.utcoffset() is not None:
            return value
        return value.replace(tzinfo=UTC)

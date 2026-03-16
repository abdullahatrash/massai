from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import CurrentUser
from app.core.contracts import contract_public_id, get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_roles
from app.core.formatting import describe_alert
from app.core.response import ApiException, success
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.schemas.alert import AlertResponse
from app.services.alert_verification import AlertVerificationService

router = APIRouter(prefix="/contracts/{contract_id}/alerts", tags=["alerts"])


class AlertSeverity(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    PENDING = "PENDING"


_SEVERITY_ORDER = {
    AlertSeverity.CRITICAL.value: 0,
    AlertSeverity.HIGH.value: 1,
    AlertSeverity.MEDIUM.value: 2,
    AlertSeverity.LOW.value: 3,
    AlertSeverity.PENDING.value: 4,
}


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract_public_id(contract)):
        return
    raise ApiException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


def _serialize_alert(
    alert: Alert,
    *,
    verification_index: dict[str, BlockchainEvent],
) -> dict[str, object]:
    payload = AlertResponse(
        id=str(alert.id),
        severity=alert.severity,
        description=describe_alert(alert),
        triggeredAt=alert.triggered_at,
        acknowledgedAt=alert.acknowledged_at,
        resolvedAt=alert.resolved_at,
        blockchainVerified=AlertVerificationService.is_verified(alert, verification_index),
        verifiedAt=AlertVerificationService.verified_at(alert, verification_index),
    )
    return payload.model_dump(by_alias=True)


def _sort_key(alert: Alert) -> tuple[int, float]:
    triggered_at = alert.triggered_at
    timestamp = triggered_at.timestamp() if triggered_at is not None else 0.0
    severity = (alert.severity or "").upper()
    return (_SEVERITY_ORDER.get(severity, 99), -timestamp)


def _filter_history(
    alerts: list[Alert],
    *,
    severity: AlertSeverity | None,
    from_date: date | None,
    to_date: date | None,
) -> list[Alert]:
    filtered = list(alerts)
    if severity is not None:
        filtered = [
            alert for alert in filtered if (alert.severity or "").upper() == severity.value
        ]
    if from_date is not None:
        filtered = [
            alert
            for alert in filtered
            if alert.triggered_at is not None and alert.triggered_at.date() >= from_date
        ]
    if to_date is not None:
        filtered = [
            alert
            for alert in filtered
            if alert.triggered_at is not None and alert.triggered_at.date() <= to_date
        ]
    return filtered


def _get_alert_or_404(contract: Contract, alert_id: str) -> Alert:
    try:
        alert_uuid = uuid.UUID(alert_id)
    except ValueError as exc:
        raise ApiException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ALERT_NOT_FOUND",
            message="Alert not found.",
        ) from exc

    for alert in contract.alerts or []:
        if alert.id == alert_uuid:
            return alert

    raise ApiException(
        status_code=status.HTTP_404_NOT_FOUND,
        code="ALERT_NOT_FOUND",
        message="Alert not found.",
    )


@router.get("")
async def list_active_alerts(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    _assert_contract_access(contract, current_user)
    verification_index = AlertVerificationService.build_index(
        list(contract.blockchain_events or [])
    )
    active_alerts = [
        alert
        for alert in contract.alerts or []
        if alert.acknowledged_at is None and alert.resolved_at is None
    ]
    active_alerts.sort(key=_sort_key)
    return success(
        [
            _serialize_alert(alert, verification_index=verification_index)
            for alert in active_alerts
        ]
    )


@router.get("/history")
async def list_alert_history(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    severity: AlertSeverity | None = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    _assert_contract_access(contract, current_user)
    verification_index = AlertVerificationService.build_index(
        list(contract.blockchain_events or [])
    )
    alerts = _filter_history(
        list(contract.alerts or []),
        severity=severity,
        from_date=from_date,
        to_date=to_date,
    )
    alerts.sort(key=_sort_key)
    return success(
        [
            _serialize_alert(alert, verification_index=verification_index)
            for alert in alerts
        ]
    )


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    contract_id: str,
    alert_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    _assert_contract_access(contract, current_user)
    alert = _get_alert_or_404(contract, alert_id)
    if alert.acknowledged_at is None:
        alert.acknowledged_at = datetime.now(UTC)
    await session.commit()
    verification_index = AlertVerificationService.build_index(
        list(contract.blockchain_events or [])
    )
    return success(_serialize_alert(alert, verification_index=verification_index))

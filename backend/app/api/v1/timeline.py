from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends
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
from app.models.milestone import Milestone
from app.schemas.timeline import TimelineEventResponse

router = APIRouter(prefix="/contracts/{contract_id}/timeline", tags=["timeline"])


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract_public_id(contract)):
        return
    raise ApiException(
        status_code=403,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


def _event_timestamp_from_date(value: date | None) -> datetime | None:
    if value is None:
        return None
    return datetime.combine(value, time.min, tzinfo=UTC)


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None and value.utcoffset() is not None:
        return value
    return value.replace(tzinfo=UTC)


def _milestone_description(milestone: Milestone) -> str | None:
    name = milestone.name or milestone.milestone_ref or "Milestone"
    status = (milestone.status or "").upper()
    if status == "COMPLETED":
        return f"Milestone '{name}' marked complete"
    if status == "SUBMITTED":
        return f"Milestone '{name}' submitted for approval"
    if status == "REJECTED":
        for item in reversed(list(milestone.evidence or [])):
            if isinstance(item, dict) and item.get("type") == "REJECTION_REASON":
                reason = item.get("reason")
                if reason:
                    return f"Milestone '{name}' was rejected: {reason}"
        return f"Milestone '{name}' was rejected"
    return None


def _milestone_icon(milestone: Milestone) -> str:
    status = (milestone.status or "").upper()
    if status == "COMPLETED":
        return "check-circle"
    if status == "SUBMITTED":
        return "hourglass"
    if status == "REJECTED":
        return "x-circle"
    return "flag"


def _timeline_from_milestone(milestone: Milestone) -> TimelineEventResponse | None:
    timestamp = _event_timestamp_from_date(milestone.actual_date)
    description = _milestone_description(milestone)
    if timestamp is None or description is None:
        return None
    return TimelineEventResponse(
        id=f"milestone:{milestone.id}:{milestone.status}",
        timestamp=timestamp,
        type="milestone",
        description=description,
        icon=_milestone_icon(milestone),
    )


def _timeline_from_alert(alert: Alert) -> TimelineEventResponse | None:
    timestamp = _ensure_aware(alert.triggered_at)
    if timestamp is None:
        return None
    description = describe_alert(alert)
    return TimelineEventResponse(
        id=f"alert:{alert.id}",
        timestamp=timestamp,
        type="alert",
        description=description,
        icon="alert-triangle",
    )


def _blockchain_description(event: BlockchainEvent) -> str:
    event_data = dict(event.event_data or {})
    milestone_name = event_data.get("milestone_name") or event_data.get("milestoneRef") or "milestone"
    alert_description = event_data.get("description")
    event_type = (event.event_type or "").upper()
    if event_type == "MILESTONE_APPROVED":
        return f"Milestone '{milestone_name}' approved and recorded"
    if event_type == "MILESTONE_COMPLETED":
        return f"Milestone '{milestone_name}' completion recorded"
    if event_type == "ALERT_RAISED" and isinstance(alert_description, str) and alert_description:
        return f"Alert recorded on blockchain: {alert_description}"
    return "Contract record updated"


def _timeline_from_blockchain_event(event: BlockchainEvent) -> TimelineEventResponse | None:
    timestamp = _ensure_aware(event.created_at)
    if timestamp is None:
        return None
    return TimelineEventResponse(
        id=f"record:{event.id}",
        timestamp=timestamp,
        type="record",
        description=_blockchain_description(event),
        icon="file-check",
    )


def build_timeline(contract: Contract) -> list[dict[str, object]]:
    items: list[TimelineEventResponse] = []

    for milestone in contract.milestones or []:
        event = _timeline_from_milestone(milestone)
        if event is not None:
            items.append(event)

    for alert in contract.alerts or []:
        event = _timeline_from_alert(alert)
        if event is not None:
            items.append(event)

    for blockchain_event in contract.blockchain_events or []:
        event = _timeline_from_blockchain_event(blockchain_event)
        if event is not None:
            items.append(event)

    items.sort(key=lambda item: (item.timestamp, item.id))
    return [item.model_dump() for item in items]


@router.get("")
async def get_timeline(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.milestones),
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    _assert_contract_access(contract, current_user)
    return success(build_timeline(contract))

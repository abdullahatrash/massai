from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import CurrentUser
from app.core.contracts import contract_public_id, get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_roles
from app.core.response import ApiException, success
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.schemas.contract import (
    ContractListItemResponse,
    ContractOverviewResponse,
    NextMilestoneResponse,
)
from app.services.notification import NotificationService

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _today() -> date:
    return datetime.now(UTC).date()


def _public_id(contract: Contract) -> str:
    return contract_public_id(contract)


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(_public_id(contract)):
        return
    raise ApiException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


def _completed_milestones(milestones: list[Milestone]) -> int:
    return sum(1 for milestone in milestones if milestone.status == "COMPLETED")


def _has_overdue_milestone(milestones: list[Milestone], *, today: date) -> bool:
    return any(
        milestone.planned_date is not None
        and milestone.planned_date < today
        and milestone.status != "COMPLETED"
        for milestone in milestones
    )


def _has_awaiting_consumer_approval(milestones: list[Milestone]) -> bool:
    return any(
        bool(milestone.approval_required) and milestone.status == "SUBMITTED"
        for milestone in milestones
    )


def _has_active_high_alert(alerts: list[Alert]) -> bool:
    return any(
        alert.acknowledged_at is None
        and alert.resolved_at is None
        and (alert.severity or "").upper() in {"HIGH", "CRITICAL"}
        for alert in alerts
    )


def _derive_status_badge(contract: Contract, *, today: date) -> str:
    milestones = list(contract.milestones or [])
    alerts = list(contract.alerts or [])
    contract_status = (contract.status or "").upper()

    if contract_status == "DISPUTED" or any(
        (milestone.status or "").upper() == "REJECTED" for milestone in milestones
    ):
        return "DISPUTED"

    if milestones and all((milestone.status or "").upper() == "COMPLETED" for milestone in milestones):
        return "COMPLETED"
    if contract_status == "COMPLETED":
        return "COMPLETED"

    if _has_awaiting_consumer_approval(milestones) or _has_active_high_alert(alerts):
        return "ACTION_REQUIRED"

    if _has_overdue_milestone(milestones, today=today):
        return "DELAYED"

    return "ON_TRACK"


def _next_milestone(milestones: list[Milestone], *, today: date) -> NextMilestoneResponse | None:
    terminal_statuses = {"COMPLETED", "REJECTED"}
    pending_milestones = [
        milestone
        for milestone in milestones
        if (milestone.status or "").upper() not in terminal_statuses
        and milestone.planned_date is not None
    ]
    if not pending_milestones:
        return None

    milestone = min(pending_milestones, key=lambda item: item.planned_date)
    return NextMilestoneResponse(
        name=milestone.name or milestone.milestone_ref or "Upcoming milestone",
        plannedDate=milestone.planned_date,
        daysRemaining=(milestone.planned_date - today).days,
    )


def _serialize_contract_list_item(contract: Contract, *, today: date) -> dict[str, Any]:
    milestones = list(contract.milestones or [])
    payload = ContractListItemResponse(
        id=_public_id(contract),
        pilotType=contract.pilot_type,
        status=contract.status,
        statusBadge=_derive_status_badge(contract, today=today),
        productName=contract.product_name,
        providerId=contract.provider_id,
        deliveryDate=contract.delivery_date,
        milestonesCompleted=_completed_milestones(milestones),
        milestonesTotal=len(milestones),
    )
    return payload.model_dump(by_alias=True)


def _serialize_contract_overview(contract: Contract, *, today: date) -> dict[str, Any]:
    config = dict(contract.config or {})
    milestones = list(contract.milestones or [])
    payload = ContractOverviewResponse(
        id=_public_id(contract),
        pilotType=contract.pilot_type,
        status=contract.status,
        statusBadge=_derive_status_badge(contract, today=today),
        productName=contract.product_name,
        providerId=contract.provider_id,
        deliveryDate=contract.delivery_date,
        milestonesCompleted=_completed_milestones(milestones),
        milestonesTotal=len(milestones),
        lastKnownState=dict(config.get("last_known_state") or {}),
        nextMilestone=_next_milestone(milestones, today=today),
    )
    return payload.model_dump(by_alias=True)


async def _get_contract(session: AsyncSession, contract_id: str) -> Contract:
    return await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.milestones),
            selectinload(Contract.alerts),
        ),
    )


@router.get("")
async def list_contracts(
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> dict[str, object]:
    statement = (
        select(Contract)
        .options(
            selectinload(Contract.milestones),
            selectinload(Contract.alerts),
        )
        .order_by(Contract.delivery_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size + 1)
    )
    if not current_user.is_admin:
        statement = statement.where(Contract.public_id.in_(list(current_user.contract_ids)))

    result = await session.execute(statement)
    contracts = result.scalars().all()
    has_more = len(contracts) > page_size
    visible_contracts = contracts[:page_size]
    today = _today()
    unread_notifications = await NotificationService.unread_count_for_user(
        session,
        current_user,
    )

    return success(
        [_serialize_contract_list_item(contract, today=today) for contract in visible_contracts],
        meta={
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "hasMore": has_more,
            },
            "unreadNotifications": unread_notifications,
        },
    )


@router.get("/{contract_id}")
async def get_contract_overview(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await _get_contract(session, contract_id)
    _assert_contract_access(contract, current_user)
    return success(_serialize_contract_overview(contract, today=_today()))

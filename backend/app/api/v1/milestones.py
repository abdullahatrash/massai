from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import CurrentUser
from app.core.contracts import contract_public_id, get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_consumer, require_contract_access, require_roles
from app.core.response import ApiException, success
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.schemas.milestone import (
    ApproveMilestoneRequest,
    MilestoneDetailResponse,
    MilestoneDecisionResponse,
    MilestoneSummaryResponse,
    RejectMilestoneRequest,
)
from app.services.milestone import MilestoneService

router = APIRouter(prefix="/contracts/{contract_id}/milestones", tags=["milestones"])


def _today() -> date:
    return datetime.now(UTC).date()


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract_public_id(contract)):
        return
    raise ApiException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


async def _get_milestone(
    session: AsyncSession,
    contract: Contract,
    milestone_id: str,
) -> Milestone:
    try:
        milestone_uuid = uuid.UUID(milestone_id)
    except ValueError as exc:
        raise ApiException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="MILESTONE_NOT_FOUND",
            message="Milestone not found.",
        ) from exc

    result = await session.execute(
        select(Milestone).where(
            Milestone.id == milestone_uuid,
            Milestone.contract_id == contract.id,
        )
    )
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise ApiException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="MILESTONE_NOT_FOUND",
            message="Milestone not found.",
        )
    return milestone


def _assert_consumer_owns_contract(contract: Contract, current_user: CurrentUser) -> None:
    consumer_identity = contract.consumer_id
    user_identities = {
        value
        for value in (current_user.email, current_user.preferred_username)
        if value
    }
    if consumer_identity is None or consumer_identity not in user_identities:
        raise ApiException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message="You do not have access to this contract.",
        )


def _is_overdue(milestone: Milestone, *, today: date) -> bool:
    planned_date = milestone.planned_date
    if planned_date is None:
        return False
    return planned_date < today and (milestone.status or "").upper() != "COMPLETED"


def _serialize_milestone_summary(milestone: Milestone, *, today: date) -> dict[str, object]:
    payload = MilestoneSummaryResponse(
        id=str(milestone.id),
        milestoneRef=milestone.milestone_ref,
        name=milestone.name,
        plannedDate=milestone.planned_date,
        actualDate=milestone.actual_date,
        status=milestone.status,
        approvalRequired=bool(milestone.approval_required),
        isOverdue=_is_overdue(milestone, today=today),
    )
    return payload.model_dump(by_alias=True)


def _serialize_milestone_detail(milestone: Milestone, *, today: date) -> dict[str, object]:
    payload = MilestoneDetailResponse(
        id=str(milestone.id),
        milestoneRef=milestone.milestone_ref,
        name=milestone.name,
        plannedDate=milestone.planned_date,
        actualDate=milestone.actual_date,
        status=milestone.status,
        approvalRequired=bool(milestone.approval_required),
        isOverdue=_is_overdue(milestone, today=today),
        evidence=list(milestone.evidence or []),
    )
    return payload.model_dump(by_alias=True)


@router.get("")
async def list_milestones(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(selectinload(Contract.milestones),),
    )
    _assert_contract_access(contract, current_user)
    today = _today()
    milestones = sorted(
        list(contract.milestones or []),
        key=lambda milestone: (
            milestone.planned_date or date.max,
            milestone.name or "",
            str(milestone.id),
        ),
    )
    return success(
        [_serialize_milestone_summary(milestone, today=today) for milestone in milestones]
    )


@router.get("/{milestone_id}")
async def get_milestone(
    contract_id: str,
    milestone_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(selectinload(Contract.milestones),),
    )
    _assert_contract_access(contract, current_user)
    milestone = await _get_milestone(session, contract, milestone_id)
    return success(_serialize_milestone_detail(milestone, today=_today()))


@router.post("/{milestone_id}/approve")
async def approve_milestone(
    contract_id: str,
    milestone_id: str,
    request: ApproveMilestoneRequest,
    current_user: Annotated[CurrentUser, Depends(require_consumer())],
    _: Annotated[CurrentUser, Depends(require_contract_access())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)
    _assert_consumer_owns_contract(contract, current_user)
    milestone = await _get_milestone(session, contract, milestone_id)

    milestone = await MilestoneService.approve_submission(
        milestone.id,
        session,
        notes=request.notes,
    )
    await session.commit()

    payload = MilestoneDecisionResponse(
        milestoneId=str(milestone.id),
        contractId=contract_id,
        status=str(milestone.status),
    )
    return success(payload.model_dump(by_alias=True))


@router.post("/{milestone_id}/reject")
async def reject_milestone(
    contract_id: str,
    milestone_id: str,
    request: RejectMilestoneRequest,
    current_user: Annotated[CurrentUser, Depends(require_consumer())],
    _: Annotated[CurrentUser, Depends(require_contract_access())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)
    _assert_consumer_owns_contract(contract, current_user)
    milestone = await _get_milestone(session, contract, milestone_id)

    milestone = await MilestoneService.reject_submission(
        milestone.id,
        session,
        reason=request.reason,
    )
    await session.commit()

    payload = MilestoneDecisionResponse(
        milestoneId=str(milestone.id),
        contractId=contract_id,
        status=str(milestone.status),
    )
    return success(payload.model_dump(by_alias=True))

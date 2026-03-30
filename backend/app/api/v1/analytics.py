from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import CurrentUser
from app.core.contracts import contract_public_id, get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_contract_reader
from app.core.response import ApiException, success
from app.models.contract import Contract
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/contracts/{contract_id}/analytics", tags=["analytics"])


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract_public_id(contract)):
        return
    raise ApiException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


@router.get("")
async def get_contract_analytics(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_contract_reader())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.milestones),
            selectinload(Contract.status_updates),
            selectinload(Contract.alerts),
        ),
    )
    _assert_contract_access(contract, current_user)
    return success(AnalyticsService.build_contract_analytics(contract))

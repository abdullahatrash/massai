from __future__ import annotations

from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import CurrentUser
from app.core.contracts import contract_public_id, get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_roles
from app.core.response import ApiException, success
from app.models.contract import Contract
from app.services.audit import AuditService

router = APIRouter(prefix="/contracts/{contract_id}/audit-export", tags=["audit"])


class AuditExportFormat(StrEnum):
    JSON = "json"
    PDF = "pdf"


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract_public_id(contract)):
        return
    raise ApiException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


@router.get("")
async def get_audit_export(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    export_format: Annotated[AuditExportFormat, Query(alias="format")] = AuditExportFormat.JSON,
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
    return success(
        AuditService.build_export(
            contract,
            export_format=export_format.value,
        )
    )

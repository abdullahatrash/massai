from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.blockchain import BlockchainService, get_blockchain_service
from app.core.database import get_db_session
from app.core.dependencies import require_admin
from app.core.response import ApiException, success
from app.models.contract import Contract
from app.schemas.admin import CreateAdminContractRequest
from app.services.contract_onboarding import ContractOnboardingService

router = APIRouter(prefix="/admin/contracts", tags=["admin"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contract(
    request: CreateAdminContractRequest,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    blockchain_service: Annotated[BlockchainService, Depends(get_blockchain_service)],
) -> dict[str, object]:
    contract = await ContractOnboardingService.create_contract(
        session,
        blockchain_service,
        blockchain_contract_address=request.blockchain_contract_address,
        pilot_type=request.pilot_type,
    )
    await session.commit()
    return success(ContractOnboardingService.serialize_contract(contract))


@router.get("")
async def list_admin_contracts(
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    result = await session.execute(
        select(Contract)
        .options(selectinload(Contract.milestones))
        .order_by(Contract.delivery_date.asc(), Contract.public_id.asc())
    )
    contracts = result.scalars().all()
    return success(ContractOnboardingService.serialize_contracts(contracts))


@router.get("/{contract_id}/blockchain-sync")
async def sync_contract(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    blockchain_service: Annotated[BlockchainService, Depends(get_blockchain_service)],
) -> dict[str, object]:
    result = await session.execute(
        select(Contract)
        .options(selectinload(Contract.milestones))
        .where(Contract.public_id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise ApiException(
            status_code=404,
            code="CONTRACT_NOT_FOUND",
            message="Contract not found.",
        )
    contract = await ContractOnboardingService.sync_contract(
        session,
        blockchain_service,
        contract,
    )
    await session.commit()
    return success(ContractOnboardingService.serialize_contract(contract))

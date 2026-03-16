from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from fastapi import status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import ApiException
from app.models.contract import Contract


def contract_public_id(contract: Contract) -> str:
    if contract.public_id:
        return str(contract.public_id)

    config = dict(contract.config or {})
    public_id = config.get("public_id")
    if not public_id:
        raise ValueError("Contract is missing public_id.")
    return str(public_id)


def select_contract_by_public_id(
    contract_id: str,
    *,
    options: Sequence[Any] = (),
) -> Select[tuple[Contract]]:
    statement = select(Contract)
    if options:
        statement = statement.options(*options)
    return statement.where(Contract.public_id == contract_id)


async def get_contract_by_public_id(
    session: AsyncSession,
    contract_id: str,
    *,
    options: Sequence[Any] = (),
) -> Contract:
    result = await session.execute(
        select_contract_by_public_id(contract_id, options=options)
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise ApiException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CONTRACT_NOT_FOUND",
            message="Contract not found.",
        )
    return contract

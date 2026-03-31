from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_contract_reader
from app.core.response import ApiException, success
from app.models.contract import Contract
from app.schemas.ingest_v2 import ContractIngestSpecResponse
from app.services.ingest_profiles import IngestProfileService

router = APIRouter(prefix="/contracts", tags=["contracts-v2"])


def _assert_contract_access(contract: Contract, current_user: CurrentUser) -> None:
    if current_user.can_access_contract(contract.public_id or ""):
        return
    raise ApiException(
        status_code=403,
        code="FORBIDDEN",
        message="You do not have access to this contract.",
    )


@router.get("/{contract_id}/ingest-spec")
async def get_contract_ingest_spec(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_contract_reader())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)
    _assert_contract_access(contract, current_user)
    payload = ContractIngestSpecResponse(
        **IngestProfileService.build_contract_spec(contract)
    )
    return success(payload.model_dump(by_alias=True))

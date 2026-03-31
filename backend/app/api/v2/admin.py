from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_admin
from app.core.response import ApiException, success
from app.schemas.ingest_profile import (
    BindContractIngestProfileRequest,
    CreateIngestProfileRequest,
    IngestProfileDetailResponse,
    IngestProfileSummaryResponse,
)
from app.schemas.ingest_v2 import ContractIngestSpecResponse
from app.services.ingest_profiles import IngestProfileService

router = APIRouter(prefix="/admin", tags=["admin-v2"])


@router.get("/ingest-profiles")
async def list_ingest_profiles(
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    profiles = [
        IngestProfileSummaryResponse(**item).model_dump(by_alias=True)
        for item in (
            [
                {
                    key: value
                    for key, value in builtin_profile.items()
                    if key in {"profileKey", "factoryKey", "pilotType", "version", "status", "source", "supportedUpdateTypes"}
                }
                for builtin_profile in IngestProfileService.list_builtin_profiles()
            ]
            + [IngestProfileService.serialize_profile(profile) for profile in await IngestProfileService.list_profiles(session)]
        )
    ]
    return success(profiles)


@router.post("/ingest-profiles", status_code=status.HTTP_201_CREATED)
async def create_ingest_profile(
    request: CreateIngestProfileRequest,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    profile = await IngestProfileService.create_profile(
        session,
        profile_key=request.profile_key,
        factory_key=request.factory_key,
        pilot_type=request.pilot_type,
        version=request.version,
        status=request.status,
        description=request.description,
        definition=request.definition,
    )
    await session.commit()
    payload = IngestProfileDetailResponse(
        **IngestProfileService.serialize_profile(profile)
    )
    return success(payload.model_dump(by_alias=True))


@router.post("/contracts/{contract_id}/ingest-profile-binding")
async def bind_contract_ingest_profile(
    contract_id: str,
    request: BindContractIngestProfileRequest,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)

    try:
        resolved_spec = IngestProfileService.resolve_builtin_profile(
            request.profile_key,
            request.version,
        )
        profile_id = None
    except ApiException:
        profile = await IngestProfileService.get_profile(
            session,
            request.profile_key,
            request.version,
        )
        if profile is None:
            raise
        resolved_spec = dict(profile.resolved_spec or {})
        profile_id = profile.id

    resolved_spec["profileVersion"] = request.version
    IngestProfileService.bind_contract_snapshot(contract, resolved_spec, profile_id=profile_id)
    await session.commit()
    payload = ContractIngestSpecResponse(
        **IngestProfileService.build_contract_spec(contract)
    )
    return success(payload.model_dump(by_alias=True))


@router.get("/contracts/{contract_id}/ingest-spec")
async def get_admin_contract_ingest_spec(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)
    payload = ContractIngestSpecResponse(
        **IngestProfileService.build_contract_spec(contract)
    )
    return success(payload.model_dump(by_alias=True))

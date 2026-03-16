from __future__ import annotations

import uuid
from datetime import UTC, datetime
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
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.schemas.document import DocumentResponse

router = APIRouter(prefix="/contracts/{contract_id}", tags=["documents"])


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


def _parse_uploaded_at(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is not None and value.utcoffset() is not None:
            return value
        return value.replace(tzinfo=UTC)
    if not isinstance(value, str) or not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        return parsed
    return parsed.replace(tzinfo=UTC)


def _document_from_evidence(
    evidence: Any,
    *,
    milestone: Milestone,
    index: int,
) -> dict[str, object] | None:
    if isinstance(evidence, str):
        return None
    if not isinstance(evidence, dict):
        return None

    url = evidence.get("url")
    name = evidence.get("name")
    if not isinstance(url, str) or not url:
        return None
    if not isinstance(name, str) or not name:
        return None

    uploaded_at = _parse_uploaded_at(evidence.get("uploadedAt"))
    payload = DocumentResponse(
        id=str(evidence.get("id") or f"{milestone.id}:{index}"),
        milestoneId=str(milestone.id),
        milestoneName=milestone.name or milestone.milestone_ref or "Milestone",
        name=name,
        url=url,
        format=evidence.get("format"),
        uploadedAt=uploaded_at,
    )
    return payload.model_dump(by_alias=True)


def _collect_documents(milestones: list[Milestone]) -> list[dict[str, object]]:
    documents: list[dict[str, object]] = []
    for milestone in milestones:
        for index, evidence in enumerate(list(milestone.evidence or [])):
            document = _document_from_evidence(
                evidence,
                milestone=milestone,
                index=index,
            )
            if document is not None:
                documents.append(document)

    documents.sort(
        key=lambda item: (
            item["uploadedAt"] is None,
            item["uploadedAt"] or datetime.min.replace(tzinfo=UTC),
        ),
        reverse=True,
    )
    return documents


@router.get("/documents")
async def list_contract_documents(
    contract_id: str,
    current_user: Annotated[CurrentUser, Depends(require_roles("consumer", "admin"))],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    milestone_ref: Annotated[str | None, Query(alias="milestoneId")] = None,
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(selectinload(Contract.milestones),),
    )
    _assert_contract_access(contract, current_user)
    milestones = list(contract.milestones or [])
    if milestone_ref is not None:
        milestones = [
            milestone
            for milestone in milestones
            if milestone.milestone_ref == milestone_ref
        ]
    return success(_collect_documents(milestones))


@router.get("/milestones/{milestone_id}/documents")
async def list_milestone_documents(
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
    return success(_collect_documents([milestone]))

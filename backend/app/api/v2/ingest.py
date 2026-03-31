from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.ingest import (
    _broadcast_update_messages,
    _queue_notification_side_effects,
    _serialize_evidence,
)
from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_contract_access, require_provider
from app.core.response import success
from app.models.contract import Contract
from app.models.status_update import StatusUpdate
from app.schemas.ingest_v2 import V2IngestRequest, V2IngestResponse
from app.services.alert_blockchain import AlertBlockchainService
from app.services.ingest_profiles import IngestProfileService, SCHEMA_VERSION
from app.services.monitoring import MonitoringService

router = APIRouter(prefix="/ingest", tags=["ingest-v2"])


@router.post("/{contract_id}")
async def ingest_contract_update_v2(
    contract_id: str,
    request: V2IngestRequest,
    background_tasks: BackgroundTasks,
    _: Annotated[object, Depends(require_provider())],
    __: Annotated[object, Depends(require_contract_access())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.milestones),
            selectinload(Contract.alerts),
        ),
    )
    snapshot, profile_version = IngestProfileService.validate_payload(
        contract,
        request.update_type.value,
        request.payload,
        provided_profile_version=request.profile_version,
    )

    update = StatusUpdate(
        id=uuid.uuid4(),
        contract_id=contract.id,
        update_type=request.update_type.value,
        sensor_id=request.source_id,
        source_id=request.source_id,
        ingest_schema_version=SCHEMA_VERSION,
        ingest_profile_version=profile_version,
        timestamp=request.timestamp,
        payload=request.payload,
        evidence=_serialize_evidence(request.evidence),
        processed=False,
    )
    update.contract = contract
    session.add(update)
    await session.flush()
    triggered_alerts = await MonitoringService.process_update(update, session)
    notifications = _queue_notification_side_effects(session, contract, update, triggered_alerts)
    await session.commit()
    alert_ids_for_blockchain = AlertBlockchainService.high_priority_alert_ids(triggered_alerts)
    if alert_ids_for_blockchain:
        background_tasks.add_task(AlertBlockchainService.log_alerts, alert_ids_for_blockchain)
    await _broadcast_update_messages(contract_id, update, triggered_alerts, notifications)

    payload = V2IngestResponse(
        updateId=str(update.id),
        contractId=contract_id,
        processed=bool(update.processed),
        schemaVersion=SCHEMA_VERSION,
        profileKey=str(snapshot["profileKey"]),
        profileVersion=profile_version,
    )
    return success(payload.model_dump(by_alias=True))

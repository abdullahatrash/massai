from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.connection_manager import connection_manager
from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_contract_access, require_provider
from app.core.formatting import describe_alert
from app.core.response import ApiException, success
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.notification import Notification
from app.core.schema_validator import SchemaNotFoundError, SchemaValidationError, validate
from app.models.status_update import StatusUpdate
from app.schemas.ingest import IngestRequest, IngestResponse
from app.services.alert_blockchain import AlertBlockchainService
from app.services.monitoring import MonitoringService
from app.services.notification import NotificationService

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _schema_error_details(errors: list[dict[str, str]]) -> list[dict[str, str]]:
    details: list[dict[str, str]] = []
    for item in errors:
        path = "payload" if item["path"] == "$" else f"payload.{item['path']}"
        details.append(
            {
                "field": path,
                "message": item["message"],
                "type": "json_schema",
            }
        )
    return details


def _serialize_evidence(evidence: list[Any] | None) -> list[str]:
    if not evidence:
        return []
    return [str(item) for item in evidence]


async def _broadcast_update_messages(
    contract_id: str,
    update: StatusUpdate,
    triggered_alerts: list[Alert],
    notifications: list[Notification],
) -> None:
    timestamp = (
        update.timestamp.isoformat().replace("+00:00", "Z")
        if update.timestamp is not None
        else None
    )
    payload = dict(update.payload or {})

    await connection_manager.broadcast(
        contract_id,
        message_type="UPDATE_RECEIVED",
        data={
            "contractId": contract_id,
            "updateId": str(update.id),
            "updateType": update.update_type,
            "sensorId": update.sensor_id,
        },
        timestamp=timestamp,
    )

    update_type = (update.update_type or "").upper()
    if update_type == "MILESTONE_COMPLETE":
        await connection_manager.broadcast(
            contract_id,
            message_type="MILESTONE_CHANGED",
            data={
                "contractId": contract_id,
                "milestoneRef": payload.get("milestoneRef"),
                "status": "SUBMITTED",
            },
            timestamp=timestamp,
        )
    else:
        await connection_manager.broadcast(
            contract_id,
            message_type="CONTRACT_STATE_CHANGED",
            data={
                "contractId": contract_id,
                "updateType": update.update_type,
                "state": payload,
            },
            timestamp=timestamp,
        )

    for alert in triggered_alerts:
        await connection_manager.broadcast(
            contract_id,
            message_type="ALERT_TRIGGERED",
            data={
                "alertId": str(alert.id),
                "ruleId": alert.rule_id,
                "severity": alert.severity,
                "description": describe_alert(alert),
            },
            timestamp=timestamp,
        )

    for notification in notifications:
        notification_timestamp = (
            notification.created_at.isoformat().replace("+00:00", "Z")
            if notification.created_at is not None
            else timestamp
        )
        await connection_manager.broadcast(
            contract_id,
            message_type="NOTIFICATION",
            data=NotificationService.serialize(notification),
            timestamp=notification_timestamp,
        )


def _contract_public_id(contract: Contract) -> str:
    return contract.public_id or str((contract.config or {}).get("public_id") or "")


def _queue_notification_side_effects(
    session: AsyncSession,
    contract: Contract,
    update: StatusUpdate,
    triggered_alerts: list[Alert],
) -> list[Notification]:
    notifications: list[Notification] = []
    update_type = (update.update_type or "").upper()
    if update_type != "MILESTONE_COMPLETE":
        notifications.extend(
            NotificationService.send_many(
            session,
            recipient_ids=(contract.consumer_id,),
            event_type="CONTRACT_STATE_CHANGED",
            message=NotificationService.contract_state_changed_message(
                contract,
                update_type or "UPDATE",
            ),
            contract_id=contract.id,
            payload={
                "contractId": _contract_public_id(contract),
                "updateType": update_type,
            },
            )
        )

    for alert in triggered_alerts:
        severity = (alert.severity or "").upper()
        if severity not in {"HIGH", "CRITICAL"}:
            continue
        notification = NotificationService.send(
            session,
            recipient_id=contract.consumer_id,
            event_type="ALERT_TRIGGERED",
            message=NotificationService.alert_message(contract, describe_alert(alert)),
            contract_id=contract.id,
            payload={
                "contractId": _contract_public_id(contract),
                "alertId": str(alert.id),
                "ruleId": alert.rule_id,
                "severity": alert.severity,
            },
        )
        if notification is not None:
            notifications.append(notification)

    return notifications


@router.post("/{contract_id}")
async def ingest_contract_update(
    contract_id: str,
    request: IngestRequest,
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

    pilot_type = contract.pilot_type or ""
    try:
        validate(pilot_type, request.payload)
    except SchemaNotFoundError as exc:
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="SCHEMA_NOT_FOUND",
            message=str(exc),
        ) from exc
    except SchemaValidationError as exc:
        raise ApiException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            code="VALIDATION_ERROR",
            message="Payload schema validation failed.",
            details=_schema_error_details(exc.errors),
        ) from exc

    update = StatusUpdate(
        id=uuid.uuid4(),
        contract_id=contract.id,
        update_type=request.update_type.value,
        sensor_id=request.sensor_id,
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
    alert_ids_for_blockchain = AlertBlockchainService.high_priority_alert_ids(
        triggered_alerts
    )
    if alert_ids_for_blockchain:
        background_tasks.add_task(
            AlertBlockchainService.log_alerts,
            alert_ids_for_blockchain,
        )
    await _broadcast_update_messages(contract_id, update, triggered_alerts, notifications)

    response_payload = IngestResponse(
        updateId=str(update.id),
        contractId=contract_id,
        processed=bool(update.processed),
    )
    return success(response_payload.model_dump(by_alias=True))

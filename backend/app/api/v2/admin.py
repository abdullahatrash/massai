from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_admin
from app.core.formatting import describe_alert
from app.core.health import get_dependency_health
from app.core.response import ApiException, success
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.schemas.alert import AlertResponse
from app.schemas.admin import (
    ContractHealthResponse,
    ContractHealthSummaryItem,
    CreateDemoContractRequest,
    StatusUpdateDetailResponse,
    StatusUpdateListItem,
)
from app.schemas.contract import (
    ContractListItemResponse,
    ContractOverviewResponse,
    NextMilestoneResponse,
)
from app.schemas.ingest_profile import (
    BindContractIngestProfileRequest,
    CreateIngestProfileRequest,
    IngestProfileDetailResponse,
    IngestProfileSummaryResponse,
)
from app.schemas.ingest_v2 import ContractIngestSpecResponse
from app.schemas.milestone import MilestoneDetailResponse, MilestoneSummaryResponse
from app.services.alert_verification import AlertVerificationService
from app.services.contract_onboarding import ContractOnboardingService
from app.services.ingest_profiles import IngestProfileService

router = APIRouter(prefix="/admin", tags=["admin-v2"])


def _today() -> date:
    return datetime.now(UTC).date()


def _completed_milestones(milestones: list[Milestone]) -> int:
    return sum(1 for milestone in milestones if milestone.status == "COMPLETED")


def _has_overdue_milestone(milestones: list[Milestone], *, today: date) -> bool:
    return any(
        milestone.planned_date is not None
        and milestone.planned_date < today
        and milestone.status != "COMPLETED"
        for milestone in milestones
    )


def _has_awaiting_consumer_approval(milestones: list[Milestone]) -> bool:
    return any(
        bool(milestone.approval_required) and milestone.status == "SUBMITTED"
        for milestone in milestones
    )


def _has_active_high_alert(alerts: list[Alert]) -> bool:
    return any(
        alert.acknowledged_at is None
        and alert.resolved_at is None
        and (alert.severity or "").upper() in {"HIGH", "CRITICAL"}
        for alert in alerts
    )


def _derive_status_badge(contract: Contract, *, today: date) -> str:
    milestones = list(contract.milestones or [])
    alerts = list(contract.alerts or [])
    contract_status = (contract.status or "").upper()

    if contract_status == "DISPUTED" or any(
        (milestone.status or "").upper() == "REJECTED" for milestone in milestones
    ):
        return "DISPUTED"

    if milestones and all((milestone.status or "").upper() == "COMPLETED" for milestone in milestones):
        return "COMPLETED"
    if contract_status == "COMPLETED":
        return "COMPLETED"

    if _has_awaiting_consumer_approval(milestones) or _has_active_high_alert(alerts):
        return "ACTION_REQUIRED"

    if _has_overdue_milestone(milestones, today=today):
        return "DELAYED"

    return "ON_TRACK"


def _next_milestone(milestones: list[Milestone], *, today: date) -> NextMilestoneResponse | None:
    terminal_statuses = {"COMPLETED", "REJECTED"}
    pending_milestones = [
        milestone
        for milestone in milestones
        if (milestone.status or "").upper() not in terminal_statuses
        and milestone.planned_date is not None
    ]
    if not pending_milestones:
        return None

    milestone = min(pending_milestones, key=lambda item: item.planned_date)
    return NextMilestoneResponse(
        name=milestone.name or milestone.milestone_ref or "Upcoming milestone",
        plannedDate=milestone.planned_date,
        daysRemaining=(milestone.planned_date - today).days,
    )


def _serialize_contract_list_item(contract: Contract, *, today: date) -> dict[str, Any]:
    milestones = list(contract.milestones or [])
    payload = ContractListItemResponse(
        id=contract.public_id or str(contract.id),
        pilotType=contract.pilot_type,
        status=contract.status,
        statusBadge=_derive_status_badge(contract, today=today),
        productName=contract.product_name,
        providerId=contract.provider_id,
        deliveryDate=contract.delivery_date,
        quantityTotal=contract.quantity_total,
        milestonesCompleted=_completed_milestones(milestones),
        milestonesTotal=len(milestones),
    )
    return payload.model_dump(by_alias=True)


def _serialize_contract_overview(contract: Contract, *, today: date) -> dict[str, Any]:
    config = dict(contract.config or {})
    milestones = list(contract.milestones or [])
    payload = ContractOverviewResponse(
        id=contract.public_id or str(contract.id),
        pilotType=contract.pilot_type,
        status=contract.status,
        statusBadge=_derive_status_badge(contract, today=today),
        productName=contract.product_name,
        providerId=contract.provider_id,
        deliveryDate=contract.delivery_date,
        quantityTotal=contract.quantity_total,
        milestonesCompleted=_completed_milestones(milestones),
        milestonesTotal=len(milestones),
        lastKnownState=dict(config.get("last_known_state") or {}),
        nextMilestone=_next_milestone(milestones, today=today),
        qualityTarget=config.get("quality_target"),
    )
    return payload.model_dump(by_alias=True)


def _serialize_alert(
    alert: Alert,
    *,
    verification_index: dict[str, BlockchainEvent],
) -> dict[str, object]:
    payload = AlertResponse(
        id=str(alert.id),
        severity=alert.severity,
        description=describe_alert(alert),
        triggeredAt=alert.triggered_at,
        acknowledgedAt=alert.acknowledged_at,
        resolvedAt=alert.resolved_at,
        blockchainVerified=AlertVerificationService.is_verified(alert, verification_index),
        verifiedAt=AlertVerificationService.verified_at(alert, verification_index),
    )
    return payload.model_dump(by_alias=True)


def _alert_sort_key(alert: Alert) -> tuple[int, float]:
    severity_order = {
        "CRITICAL": 0,
        "HIGH": 1,
        "MEDIUM": 2,
        "LOW": 3,
        "PENDING": 4,
    }
    triggered_at = alert.triggered_at
    timestamp = triggered_at.timestamp() if triggered_at is not None else 0.0
    severity = (alert.severity or "").upper()
    return (severity_order.get(severity, 99), -timestamp)


def _get_alert_or_404(contract: Contract, alert_id: str) -> Alert:
    try:
        alert_uuid = uuid.UUID(alert_id)
    except ValueError as exc:
        raise ApiException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ALERT_NOT_FOUND",
            message="Alert not found.",
        ) from exc

    for alert in contract.alerts or []:
        if alert.id == alert_uuid:
            return alert

    raise ApiException(
        status_code=status.HTTP_404_NOT_FOUND,
        code="ALERT_NOT_FOUND",
        message="Alert not found.",
    )


def _is_overdue(milestone: Milestone, *, today: date) -> bool:
    planned_date = milestone.planned_date
    if planned_date is None:
        return False
    return planned_date < today and (milestone.status or "").upper() != "COMPLETED"


def _quality_gate(milestone: Milestone) -> float | None:
    criteria = dict(milestone.completion_criteria or {})
    quality_gate = criteria.get("minQualityPassRate")
    if isinstance(quality_gate, (int, float)):
        return float(quality_gate)
    return None


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
        qualityGate=_quality_gate(milestone),
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
        qualityGate=_quality_gate(milestone),
    )
    return payload.model_dump(by_alias=True)


@router.get("/contracts")
async def list_admin_contracts(
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 50,
) -> dict[str, object]:
    statement = (
        select(Contract)
        .options(
            selectinload(Contract.milestones),
            selectinload(Contract.alerts),
        )
        .order_by(Contract.delivery_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size + 1)
    )

    result = await session.execute(statement)
    contracts = result.scalars().all()
    has_more = len(contracts) > page_size
    visible_contracts = contracts[:page_size]
    today = _today()

    return success(
        [_serialize_contract_list_item(contract, today=today) for contract in visible_contracts],
        meta={
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "hasMore": has_more,
            }
        },
    )


@router.get("/contracts/{contract_id}")
async def get_admin_contract_overview(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
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
    return success(_serialize_contract_overview(contract, today=_today()))


@router.get("/contracts/{contract_id}/alerts")
async def list_admin_active_alerts(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    verification_index = AlertVerificationService.build_index(
        list(contract.blockchain_events or [])
    )
    active_alerts = [
        alert
        for alert in contract.alerts or []
        if alert.acknowledged_at is None and alert.resolved_at is None
    ]
    active_alerts.sort(key=_alert_sort_key)
    return success(
        [
            _serialize_alert(alert, verification_index=verification_index)
            for alert in active_alerts
        ]
    )


@router.get("/contracts/{contract_id}/alerts/history")
async def list_admin_alert_history(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    verification_index = AlertVerificationService.build_index(
        list(contract.blockchain_events or [])
    )
    alerts = list(contract.alerts or [])
    alerts.sort(key=_alert_sort_key)
    return success(
        [
            _serialize_alert(alert, verification_index=verification_index)
            for alert in alerts
        ]
    )


@router.post("/contracts/{contract_id}/alerts/{alert_id}/acknowledge")
async def acknowledge_admin_alert(
    contract_id: str,
    alert_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(
            selectinload(Contract.alerts),
            selectinload(Contract.blockchain_events),
        ),
    )
    alert = _get_alert_or_404(contract, alert_id)
    if alert.acknowledged_at is None:
        alert.acknowledged_at = datetime.now(UTC)
    await session.commit()
    verification_index = AlertVerificationService.build_index(
        list(contract.blockchain_events or [])
    )
    return success(_serialize_alert(alert, verification_index=verification_index))


@router.get("/contracts/{contract_id}/milestones")
async def list_admin_milestones(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(selectinload(Contract.milestones),),
    )
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


@router.get("/contracts/{contract_id}/milestones/{milestone_id}")
async def get_admin_milestone(
    contract_id: str,
    milestone_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(selectinload(Contract.milestones),),
    )
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
    return success(_serialize_milestone_detail(milestone, today=_today()))


@router.get("/contracts/health-summary")
async def contracts_health_summary(
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    now = datetime.now(UTC)
    today = now.date()

    # Subquery: per-contract status update aggregates
    update_stats = (
        select(
            StatusUpdate.contract_id,
            func.count().label("total_updates"),
            func.count().filter(StatusUpdate.processed.is_(True)).label("processed_count"),
            func.count().filter(StatusUpdate.processed.is_not(True)).label("unprocessed_count"),
            func.max(StatusUpdate.timestamp).label("last_update_at"),
        )
        .group_by(StatusUpdate.contract_id)
        .subquery()
    )

    # Subquery: per-contract active alert count
    alert_stats = (
        select(
            Alert.contract_id,
            func.count().label("active_alert_count"),
        )
        .where(Alert.resolved_at.is_(None))
        .group_by(Alert.contract_id)
        .subquery()
    )

    result = await session.execute(
        select(Contract)
        .options(selectinload(Contract.milestones))
        .outerjoin(update_stats, Contract.id == update_stats.c.contract_id)
        .outerjoin(alert_stats, Contract.id == alert_stats.c.contract_id)
        .add_columns(
            func.coalesce(update_stats.c.total_updates, 0).label("total_updates"),
            func.coalesce(update_stats.c.processed_count, 0).label("processed_count"),
            func.coalesce(update_stats.c.unprocessed_count, 0).label("unprocessed_count"),
            update_stats.c.last_update_at,
            func.coalesce(alert_stats.c.active_alert_count, 0).label("active_alert_count"),
        )
        .order_by(Contract.delivery_date.asc())
    )

    items: list[dict[str, object]] = []
    for row in result.all():
        contract = row[0]
        total_updates = row[1]
        processed_count = row[2]
        unprocessed_count = row[3]
        last_update_at = row[4]
        active_alert_count = row[5]

        milestones = list(contract.milestones or [])
        completed = sum(1 for m in milestones if m.status == "COMPLETED")
        overdue = sum(
            1
            for m in milestones
            if m.status not in ("COMPLETED", "REJECTED")
            and m.planned_date is not None
            and m.planned_date < today
        )

        stale_since: int | None = None
        if last_update_at is not None:
            delta = now - last_update_at.replace(tzinfo=UTC) if last_update_at.tzinfo is None else now - last_update_at
            stale_since = int(delta.total_seconds() / 60)

        item = ContractHealthSummaryItem(
            contractId=contract.public_id or str(contract.id),
            pilotType=contract.pilot_type,
            productName=contract.product_name,
            status=contract.status,
            lastUpdateAt=last_update_at.isoformat() if last_update_at else None,
            staleSinceMinutes=stale_since,
            totalUpdates=total_updates,
            processedCount=processed_count,
            unprocessedCount=unprocessed_count,
            activeAlertCount=active_alert_count,
            overdueMilestoneCount=overdue,
            milestonesCompleted=completed,
            milestonesTotal=len(milestones),
        )
        items.append(item.model_dump(by_alias=True))

    return success(items)


@router.get("/contracts/{contract_id}/health")
async def contract_health(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    now = datetime.now(UTC)
    today = now.date()
    contract = await get_contract_by_public_id(
        session,
        contract_id,
        options=(selectinload(Contract.milestones),),
    )

    # Status update stats
    stats_result = await session.execute(
        select(
            func.count().label("total_updates"),
            func.count().filter(StatusUpdate.processed.is_(True)).label("processed_count"),
            func.count().filter(StatusUpdate.processed.is_not(True)).label("unprocessed_count"),
            func.max(StatusUpdate.timestamp).label("last_update_at"),
        ).where(StatusUpdate.contract_id == contract.id)
    )
    stats = stats_result.one()

    # Active alerts
    alert_count_result = await session.execute(
        select(func.count()).where(
            Alert.contract_id == contract.id,
            Alert.resolved_at.is_(None),
        )
    )
    active_alert_count = alert_count_result.scalar() or 0

    # Average update frequency (last 24h)
    frequency: float | None = None
    freq_result = await session.execute(
        select(StatusUpdate.timestamp)
        .where(
            StatusUpdate.contract_id == contract.id,
            StatusUpdate.timestamp >= now - timedelta(hours=24),
        )
        .order_by(StatusUpdate.timestamp.asc())
    )
    timestamps = [row[0] for row in freq_result.all()]
    if len(timestamps) >= 2:
        intervals = [
            (timestamps[i + 1] - timestamps[i]).total_seconds()
            for i in range(len(timestamps) - 1)
        ]
        frequency = round(sum(intervals) / len(intervals) / 60, 1)

    last_update_at = stats.last_update_at
    stale_since: int | None = None
    if last_update_at is not None:
        delta = now - last_update_at.replace(tzinfo=UTC) if last_update_at.tzinfo is None else now - last_update_at
        stale_since = int(delta.total_seconds() / 60)

    milestones = list(contract.milestones or [])
    completed = sum(1 for m in milestones if m.status == "COMPLETED")
    overdue = sum(
        1
        for m in milestones
        if m.status not in ("COMPLETED", "REJECTED")
        and m.planned_date is not None
        and m.planned_date < today
    )

    config: dict[str, Any] = dict(contract.config or {})
    payload = ContractHealthResponse(
        contractId=contract.public_id or str(contract.id),
        pilotType=contract.pilot_type,
        productName=contract.product_name,
        status=contract.status,
        lastUpdateAt=last_update_at.isoformat() if last_update_at else None,
        staleSinceMinutes=stale_since,
        totalUpdates=stats.total_updates or 0,
        processedCount=stats.processed_count or 0,
        unprocessedCount=stats.unprocessed_count or 0,
        activeAlertCount=active_alert_count,
        overdueMilestoneCount=overdue,
        milestonesCompleted=completed,
        milestonesTotal=len(milestones),
        lastKnownState=dict(config.get("last_known_state") or {}),
        updateFrequencyMinutes=frequency,
        ingestProfileKey=contract.ingest_profile_key,
        ingestProfileVersion=contract.ingest_profile_version,
    )
    return success(payload.model_dump(by_alias=True))


@router.get("/contracts/{contract_id}/status-updates")
async def list_contract_status_updates(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
    update_type: Annotated[str | None, Query(alias="updateType")] = None,
    processed: Annotated[bool | None, Query()] = None,
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)

    statement = (
        select(StatusUpdate)
        .where(StatusUpdate.contract_id == contract.id)
        .order_by(StatusUpdate.timestamp.desc())
    )
    if update_type is not None:
        statement = statement.where(StatusUpdate.update_type == update_type)
    if processed is not None:
        statement = statement.where(StatusUpdate.processed.is_(processed))

    # Count total
    count_statement = select(func.count()).where(StatusUpdate.contract_id == contract.id)
    if update_type is not None:
        count_statement = count_statement.where(StatusUpdate.update_type == update_type)
    if processed is not None:
        count_statement = count_statement.where(StatusUpdate.processed.is_(processed))
    total_result = await session.execute(count_statement)
    total = total_result.scalar() or 0

    result = await session.execute(
        statement.offset((page - 1) * page_size).limit(page_size + 1)
    )
    updates = result.scalars().all()
    has_more = len(updates) > page_size
    visible = updates[:page_size]

    items = [
        StatusUpdateListItem(
            id=str(u.id),
            updateType=u.update_type,
            sourceId=u.source_id,
            sensorId=u.sensor_id,
            timestamp=u.timestamp.isoformat() if u.timestamp else None,
            processed=u.processed,
            evidenceCount=len(u.evidence or []),
            payload=dict(u.payload) if u.payload else None,
        ).model_dump(by_alias=True)
        for u in visible
    ]

    return success(
        items,
        meta={
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "hasMore": has_more,
            }
        },
    )


@router.get("/contracts/{contract_id}/status-updates/{update_id}")
async def get_contract_status_update(
    contract_id: str,
    update_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)

    result = await session.execute(
        select(StatusUpdate).where(
            StatusUpdate.id == update_id,
            StatusUpdate.contract_id == contract.id,
        )
    )
    update = result.scalar_one_or_none()
    if update is None:
        raise ApiException(
            status_code=404,
            code="STATUS_UPDATE_NOT_FOUND",
            message="Status update not found.",
        )

    payload = StatusUpdateDetailResponse(
        id=str(update.id),
        updateType=update.update_type,
        sourceId=update.source_id,
        sensorId=update.sensor_id,
        timestamp=update.timestamp.isoformat() if update.timestamp else None,
        processed=update.processed,
        evidenceCount=len(update.evidence or []),
        payload=dict(update.payload) if update.payload else None,
        evidence=list(update.evidence or []),
        ingestSchemaVersion=update.ingest_schema_version,
        ingestProfileVersion=update.ingest_profile_version,
    )
    return success(payload.model_dump(by_alias=True))


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


@router.post("/demo/contracts", status_code=status.HTTP_201_CREATED)
async def create_demo_contract(
    request: CreateDemoContractRequest,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await ContractOnboardingService.create_demo_contract(session, request)
    await session.commit()
    return success(ContractOnboardingService.serialize_contract(contract))


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_200_OK)
async def delete_contract(
    contract_id: str,
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    contract = await get_contract_by_public_id(session, contract_id)
    await ContractOnboardingService.delete_contract(session, contract)
    await session.commit()
    return success({"contractId": contract_id, "deleted": True})


@router.get("/system/health")
async def system_health(
    _: Annotated[object, Depends(require_admin())],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    dep_health = await get_dependency_health()

    contract_count_result = await session.execute(select(func.count()).select_from(Contract))
    contract_count = contract_count_result.scalar() or 0

    unprocessed_result = await session.execute(
        select(func.count()).where(StatusUpdate.processed.is_not(True))
    )
    unprocessed_count = unprocessed_result.scalar() or 0

    active_alert_result = await session.execute(
        select(func.count()).where(Alert.resolved_at.is_(None))
    )
    active_alert_count = active_alert_result.scalar() or 0

    return success({
        **dep_health,
        "contractCount": contract_count,
        "unprocessedUpdateCount": unprocessed_count,
        "activeAlertCount": active_alert_count,
    })


_ENDPOINT_ALLOWLIST = [
    "/health",
    "/api/v1/",
    "/api/v2/",
]


@router.post("/system/endpoint-test")
async def endpoint_test(
    request: dict[str, str],
    _: Annotated[object, Depends(require_admin())],
) -> dict[str, object]:
    import time
    import httpx

    endpoint = request.get("endpoint", "")
    if not any(endpoint == allowed or endpoint.startswith(allowed) for allowed in _ENDPOINT_ALLOWLIST):
        raise ApiException(
            status_code=400,
            code="ENDPOINT_NOT_ALLOWED",
            message="Endpoint is not in the allowed test list.",
        )

    base_url = "http://localhost:8000"
    url = f"{base_url}{endpoint}"

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
        latency_ms = round((time.monotonic() - start) * 1000)
        return success({
            "endpoint": endpoint,
            "statusCode": response.status_code,
            "latencyMs": latency_ms,
            "ok": response.is_success,
        })
    except httpx.HTTPError as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        return success({
            "endpoint": endpoint,
            "statusCode": 0,
            "latencyMs": latency_ms,
            "ok": False,
            "error": str(exc),
        })

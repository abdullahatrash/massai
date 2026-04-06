from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.contracts import get_contract_by_public_id
from app.core.database import get_db_session
from app.core.dependencies import require_admin
from app.core.health import get_dependency_health
from app.core.response import ApiException, success
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.status_update import StatusUpdate
from app.schemas.admin import (
    ContractHealthResponse,
    ContractHealthSummaryItem,
    CreateDemoContractRequest,
    StatusUpdateDetailResponse,
    StatusUpdateListItem,
)
from app.schemas.ingest_profile import (
    BindContractIngestProfileRequest,
    CreateIngestProfileRequest,
    IngestProfileDetailResponse,
    IngestProfileSummaryResponse,
)
from app.schemas.ingest_v2 import ContractIngestSpecResponse
from app.services.contract_onboarding import ContractOnboardingService
from app.services.ingest_profiles import IngestProfileService

router = APIRouter(prefix="/admin", tags=["admin-v2"])


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

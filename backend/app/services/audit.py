from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.api.v1.timeline import build_timeline
from app.core.formatting import describe_alert
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.schemas.audit import (
    AuditAlertResponse,
    AuditContractMetadata,
    AuditExportResponse,
    AuditMilestoneResponse,
    AuditTimelineEventResponse,
)
from app.services.alert_verification import AlertVerificationService


class AuditService:
    @staticmethod
    def build_export(
        contract: Contract,
        *,
        export_format: str = "json",
        exported_at: datetime | None = None,
    ) -> dict[str, object]:
        exported_time = exported_at or datetime.now(UTC)
        timeline_events = [
            AuditTimelineEventResponse(**event)
            for event in build_timeline(contract)
        ]
        payload = AuditExportResponse(
            contractId=contract.public_id or "",
            exportedAt=exported_time,
            exportFormat="pdf" if export_format == "pdf" else "json",
            contract=AuditService._serialize_contract(contract),
            milestones=AuditService._serialize_milestones(contract),
            alerts=AuditService._serialize_alerts(contract),
            timelineEvents=timeline_events,
        )
        return payload.model_dump(by_alias=True)

    @staticmethod
    def _serialize_contract(contract: Contract) -> AuditContractMetadata:
        return AuditContractMetadata(
            contractId=contract.public_id or "",
            pilotType=contract.pilot_type,
            status=contract.status,
            providerId=contract.provider_id,
            consumerId=contract.consumer_id,
            productName=contract.product_name,
            quantityTotal=contract.quantity_total,
            deliveryDate=contract.delivery_date,
            agreementType=contract.agreement_type,
        )

    @staticmethod
    def _serialize_milestones(contract: Contract) -> list[AuditMilestoneResponse]:
        verification_index = AuditService._build_blockchain_verification_index(
            contract.blockchain_events or []
        )
        milestones = sorted(
            list(contract.milestones or []),
            key=lambda milestone: (
                milestone.planned_date or datetime.max.date(),
                milestone.name or "",
                str(milestone.id),
            ),
        )
        return [
            AuditMilestoneResponse(
                id=str(milestone.id),
                milestoneRef=milestone.milestone_ref,
                name=milestone.name,
                plannedDate=milestone.planned_date,
                actualDate=milestone.actual_date,
                status=milestone.status,
                approvalRequired=bool(milestone.approval_required),
                evidence=list(milestone.evidence or []),
                blockchainVerified=AuditService._milestone_is_verified(
                    milestone,
                    verification_index,
                ),
                verifiedAt=AuditService._milestone_verified_at(
                    milestone,
                    verification_index,
                ),
                transactionHash=AuditService._milestone_transaction_hash(
                    milestone,
                    verification_index,
                ),
            )
            for milestone in milestones
        ]

    @staticmethod
    def _serialize_alerts(contract: Contract) -> list[AuditAlertResponse]:
        verification_index = AlertVerificationService.build_index(
            list(contract.blockchain_events or [])
        )
        alerts = sorted(
            list(contract.alerts or []),
            key=lambda alert: (
                alert.triggered_at or datetime.min.replace(tzinfo=UTC),
                str(alert.id),
            ),
        )
        return [
            AuditAlertResponse(
                id=str(alert.id),
                severity=alert.severity,
                description=describe_alert(alert),
                triggeredAt=alert.triggered_at,
                acknowledgedAt=alert.acknowledged_at,
                resolvedAt=alert.resolved_at,
                blockchainVerified=AlertVerificationService.is_verified(
                    alert,
                    verification_index,
                ),
                verifiedAt=AlertVerificationService.verified_at(
                    alert,
                    verification_index,
                ),
            )
            for alert in alerts
        ]

    @staticmethod
    def _build_blockchain_verification_index(
        blockchain_events: list[BlockchainEvent],
    ) -> dict[str, BlockchainEvent]:
        index: dict[str, BlockchainEvent] = {}
        for event in blockchain_events:
            event_data = dict(event.event_data or {})
            keys = [
                event_data.get("milestone_id"),
                event_data.get("milestoneId"),
                event_data.get("milestone_ref"),
                event_data.get("milestoneRef"),
            ]
            for key in keys:
                if isinstance(key, str) and key:
                    current = index.get(key)
                    if current is None or (
                        current.created_at or datetime.min.replace(tzinfo=UTC)
                    ) < (event.created_at or datetime.min.replace(tzinfo=UTC)):
                        index[key] = event
        return index

    @staticmethod
    def _match_event(
        milestone: Milestone,
        verification_index: dict[str, BlockchainEvent],
    ) -> BlockchainEvent | None:
        candidates = [
            str(milestone.id),
            milestone.milestone_ref,
        ]
        for candidate in candidates:
            if isinstance(candidate, str) and candidate in verification_index:
                return verification_index[candidate]
        return None

    @staticmethod
    def _milestone_is_verified(
        milestone: Milestone,
        verification_index: dict[str, BlockchainEvent],
    ) -> bool:
        event = AuditService._match_event(milestone, verification_index)
        return bool(event and event.transaction_hash)

    @staticmethod
    def _milestone_verified_at(
        milestone: Milestone,
        verification_index: dict[str, BlockchainEvent],
    ) -> datetime | None:
        event = AuditService._match_event(milestone, verification_index)
        if event is None or not event.transaction_hash:
            return None
        return event.created_at

    @staticmethod
    def _milestone_transaction_hash(
        milestone: Milestone,
        verification_index: dict[str, BlockchainEvent],
    ) -> str | None:
        event = AuditService._match_event(milestone, verification_index)
        if event is None or not event.transaction_hash:
            return None
        return event.transaction_hash

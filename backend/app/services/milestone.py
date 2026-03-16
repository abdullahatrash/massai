from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import contract_public_id
from app.core.response import ApiException
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.services.notification import NotificationService


class MilestoneService:
    @staticmethod
    async def approve_submission(
        milestone_id: uuid.UUID,
        session: AsyncSession,
        *,
        notes: str | None = None,
        now: datetime | None = None,
    ) -> Milestone:
        milestone = await session.get(Milestone, milestone_id)
        if milestone is None:
            raise ValueError("Milestone not found.")
        if milestone.status != "SUBMITTED":
            raise ApiException(
                status_code=400,
                code="INVALID_MILESTONE_STATE",
                message="Milestone not awaiting approval.",
            )

        contract = milestone.contract
        if contract is None:
            contract = await session.get(Contract, milestone.contract_id)
        if contract is None:
            raise ValueError("Milestone contract not found.")

        decision_time = now or datetime.now(UTC)
        milestone.status = "APPROVED"
        MilestoneService._append_approval_note(milestone, notes, decision_time)
        milestone.actual_date = decision_time.date()
        milestone.status = "COMPLETED"
        session.add(
            BlockchainEvent(
                contract_id=contract.id,
                event_type="MILESTONE_APPROVED",
                transaction_hash=None,
                block_number=None,
                event_data={
                    "milestone_id": str(milestone.id),
                    "milestoneRef": milestone.milestone_ref,
                    "notes": notes,
                },
                created_at=decision_time,
            )
        )
        NotificationService.send(
            session,
            recipient_id=contract.provider_id,
            event_type="MILESTONE_APPROVED",
            message=NotificationService.milestone_approved_message(
                contract,
                milestone.milestone_ref,
            ),
            contract_id=contract.id,
            milestone_id=milestone.id,
            payload={
                "contractId": contract_public_id(contract),
                "milestoneId": str(milestone.id),
                "milestoneRef": milestone.milestone_ref,
                "notes": notes,
            },
            now=decision_time,
        )
        return milestone

    @staticmethod
    async def reject_submission(
        milestone_id: uuid.UUID,
        session: AsyncSession,
        *,
        reason: str,
        now: datetime | None = None,
    ) -> Milestone:
        milestone = await session.get(Milestone, milestone_id)
        if milestone is None:
            raise ValueError("Milestone not found.")
        if milestone.status != "SUBMITTED":
            raise ApiException(
                status_code=400,
                code="INVALID_MILESTONE_STATE",
                message="Milestone not awaiting approval.",
            )

        contract = milestone.contract
        if contract is None:
            contract = await session.get(Contract, milestone.contract_id)
        if contract is None:
            raise ValueError("Milestone contract not found.")

        decision_time = now or datetime.now(UTC)
        milestone.status = "REJECTED"
        MilestoneService._append_rejection_reason(milestone, reason, decision_time)
        MilestoneService._queue_provider_rejection_notification(
            session,
            contract,
            milestone,
            reason,
            decision_time,
        )
        return milestone

    @staticmethod
    async def evaluate_submission(
        milestone_id: uuid.UUID,
        session: AsyncSession,
        *,
        latest_update: StatusUpdate | None = None,
        now: datetime | None = None,
    ) -> Milestone:
        milestone = await session.get(Milestone, milestone_id)
        if milestone is None:
            raise ValueError("Milestone not found.")

        contract = milestone.contract
        if contract is None:
            contract = await session.get(Contract, milestone.contract_id)
        if contract is None:
            raise ValueError("Milestone contract not found.")

        evaluation_time = now or datetime.now(UTC)
        if latest_update is None:
            latest_update = await MilestoneService._get_latest_update(milestone, session)

        if bool(milestone.approval_required):
            milestone.status = "SUBMITTED"
            MilestoneService._queue_approval_notification(
                session,
                contract,
                milestone,
                evaluation_time,
            )
            return milestone

        verification_passed = MilestoneService._passes_auto_verification(
            contract,
            milestone,
            latest_update,
        )
        milestone.status = "COMPLETED" if verification_passed else "REJECTED"
        if verification_passed:
            MilestoneService._queue_blockchain_completion(
                session,
                contract,
                milestone,
                evaluation_time,
            )
        return milestone

    @staticmethod
    async def _get_latest_update(
        milestone: Milestone,
        session: AsyncSession,
    ) -> StatusUpdate | None:
        result = await session.execute(
            select(StatusUpdate)
            .where(StatusUpdate.contract_id == milestone.contract_id)
            .order_by(StatusUpdate.timestamp.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _passes_auto_verification(
        contract: Contract,
        milestone: Milestone,
        latest_update: StatusUpdate | None,
    ) -> bool:
        payload = dict(latest_update.payload or {}) if latest_update is not None else {}
        criteria = dict(milestone.completion_criteria or {})
        pilot_type = (contract.pilot_type or "").upper()

        if pilot_type == "FACTOR":
            return MilestoneService._passes_factor_criteria(criteria, payload)
        if pilot_type == "TASOWHEEL":
            return MilestoneService._passes_tasowheel_criteria(criteria, payload)
        if pilot_type == "E4M":
            return MilestoneService._passes_e4m_criteria(criteria, payload)

        return all(payload.get(key) == value for key, value in criteria.items())

    @staticmethod
    def _passes_factor_criteria(criteria: dict[str, Any], payload: dict[str, Any]) -> bool:
        quality_pass_rate = payload.get("qualityPassRate")
        quantity_produced = payload.get("quantityProduced")
        quantity_planned = payload.get("quantityPlanned")
        min_quality = criteria.get("minQualityPassRate", 0)
        expected_stage = criteria.get("currentStage")
        current_stage = payload.get("currentStage")

        if quality_pass_rate is None or quantity_produced is None or quantity_planned is None:
            return False
        if expected_stage is not None and current_stage != expected_stage:
            return False
        return quality_pass_rate >= min_quality and quantity_produced >= quantity_planned

    @staticmethod
    def _passes_tasowheel_criteria(criteria: dict[str, Any], payload: dict[str, Any]) -> bool:
        if payload.get("stepStatus") != "COMPLETE":
            return False
        expected_step = criteria.get("routingStep")
        if expected_step is not None and payload.get("routingStep") != expected_step:
            return False
        return True

    @staticmethod
    def _passes_e4m_criteria(criteria: dict[str, Any], payload: dict[str, Any]) -> bool:
        current_phase = payload.get("currentPhase")
        expected_phase = criteria.get("currentPhase")
        completion_pct = payload.get("completionPct")
        issues = payload.get("issues") or []

        if expected_phase is not None and current_phase != expected_phase:
            return False
        if completion_pct != 100:
            return False
        return not MilestoneService._has_open_high_or_critical_issue(issues)

    @staticmethod
    def _has_open_high_or_critical_issue(issues: list[Any]) -> bool:
        for issue in issues:
            if not isinstance(issue, dict):
                continue
            severity = str(issue.get("severity", "")).upper()
            status = str(issue.get("status", "OPEN")).upper()
            if severity not in {"HIGH", "CRITICAL"}:
                continue
            if status in {"CLOSED", "RESOLVED", "DONE"}:
                continue
            return True
        return False

    @staticmethod
    def _queue_approval_notification(
        session: AsyncSession,
        contract: Contract,
        milestone: Milestone,
        now: datetime,
    ) -> None:
        NotificationService.send(
            session,
            recipient_id=contract.consumer_id,
            event_type="MILESTONE_AWAITING_APPROVAL",
            message=NotificationService.milestone_awaiting_approval_message(
                contract,
                milestone.milestone_ref,
            ),
            contract_id=contract.id,
            milestone_id=milestone.id,
            payload={
                "contractId": contract_public_id(contract),
                "milestoneId": str(milestone.id),
                "milestoneRef": milestone.milestone_ref,
            },
            now=now,
        )

    @staticmethod
    def _queue_blockchain_completion(
        session: AsyncSession,
        contract: Contract,
        milestone: Milestone,
        now: datetime,
    ) -> None:
        session.add(
            BlockchainEvent(
                contract_id=contract.id,
                event_type="MILESTONE_COMPLETED",
                transaction_hash=None,
                block_number=None,
                event_data={
                    "milestoneId": str(milestone.id),
                    "milestoneRef": milestone.milestone_ref,
                },
                created_at=now,
            )
        )

    @staticmethod
    def _append_approval_note(
        milestone: Milestone,
        notes: str | None,
        now: datetime,
    ) -> None:
        if not notes:
            return
        evidence = list(milestone.evidence or [])
        evidence.append(
            {
                "type": "APPROVAL_NOTE",
                "notes": notes,
                "recorded_at": now.isoformat(),
            }
        )
        milestone.evidence = evidence

    @staticmethod
    def _append_rejection_reason(
        milestone: Milestone,
        reason: str,
        now: datetime,
    ) -> None:
        evidence = list(milestone.evidence or [])
        evidence.append(
            {
                "type": "REJECTION_REASON",
                "reason": reason,
                "recorded_at": now.isoformat(),
            }
        )
        milestone.evidence = evidence

    @staticmethod
    def _queue_provider_rejection_notification(
        session: AsyncSession,
        contract: Contract,
        milestone: Milestone,
        reason: str,
        now: datetime,
    ) -> None:
        NotificationService.send(
            session,
            recipient_id=contract.provider_id,
            event_type="MILESTONE_REJECTED",
            message=NotificationService.milestone_rejected_message(
                contract,
                milestone.milestone_ref,
                reason,
            ),
            contract_id=contract.id,
            milestone_id=milestone.id,
            payload={
                "contractId": contract_public_id(contract),
                "milestoneId": str(milestone.id),
                "milestoneRef": milestone.milestone_ref,
                "reason": reason,
            },
            now=now,
        )

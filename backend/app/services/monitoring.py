from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import ApiException
from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.services.milestone import MilestoneService
from app.services.rule_engine import RuleEngine
from app.workers.no_data_checker import NoDataChecker


class MonitoringService:
    @staticmethod
    async def process_update(
        update: StatusUpdate,
        session: AsyncSession,
        *,
        now: datetime | None = None,
    ) -> list[Alert]:
        processed_at = now or datetime.now(UTC)
        contract = await MonitoringService._get_contract(update, session)
        payload = update.payload or {}
        update_type = (update.update_type or "").upper()

        if update_type == "MILESTONE_COMPLETE":
            await MonitoringService._process_milestone_complete(
                update,
                contract,
                session,
                now=processed_at,
            )
        elif update_type == "PRODUCTION_UPDATE":
            MonitoringService._update_last_known_state(contract, payload)
        elif update_type == "PHASE_CHANGE":
            MonitoringService._process_phase_change(contract, payload)
        elif update_type == "QUALITY_EVENT":
            MonitoringService._update_last_known_state(contract, payload)

        NoDataChecker.resolve_for_new_update(contract, now=processed_at)
        triggered_alerts = await RuleEngine.evaluate(
            contract,
            update,
            session,
            now=processed_at,
        )
        update.processed = True
        return triggered_alerts

    @staticmethod
    async def _get_contract(update: StatusUpdate, session: AsyncSession) -> Contract:
        contract = update.contract
        if contract is not None:
            return contract

        contract = await session.get(Contract, update.contract_id)
        if contract is None:
            raise ValueError("Status update is not linked to a known contract.")
        return contract

    @staticmethod
    async def _process_milestone_complete(
        update: StatusUpdate,
        contract: Contract,
        session: AsyncSession,
        *,
        now: datetime,
    ) -> None:
        payload = update.payload or {}
        milestone_ref = payload.get("milestoneRef")
        if not milestone_ref:
            raise ApiException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="MISSING_MILESTONE_REF",
                message="MILESTONE_COMPLETE update must include a milestoneRef.",
            )

        result = await session.execute(
            select(Milestone).where(
                Milestone.contract_id == contract.id,
                Milestone.milestone_ref == str(milestone_ref),
            )
        )
        milestone = result.scalar_one_or_none()
        if milestone is None:
            raise ApiException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="MILESTONE_NOT_FOUND",
                message=f"No milestone with ref '{milestone_ref}' found in this contract.",
            )

        milestone.status = "SUBMITTED"
        milestone.actual_date = now.date()
        existing_evidence = list(milestone.evidence or [])
        milestone.evidence = existing_evidence + list(update.evidence or [])
        await MilestoneService.evaluate_submission(
            milestone.id,
            session,
            latest_update=update,
            now=now,
        )

    @staticmethod
    def _update_last_known_state(contract: Contract, payload: dict[str, Any]) -> None:
        config = dict(contract.config or {})
        last_known_state = dict(config.get("last_known_state") or {})
        last_known_state.update(payload)
        config["last_known_state"] = last_known_state
        contract.config = config

    @staticmethod
    def _process_phase_change(contract: Contract, payload: dict[str, Any]) -> None:
        config = dict(contract.config or {})
        current_phase = payload.get("currentPhase")
        if current_phase is not None:
            config["current_phase"] = current_phase
        last_known_state = dict(config.get("last_known_state") or {})
        last_known_state.update(payload)
        config["last_known_state"] = last_known_state
        contract.config = config

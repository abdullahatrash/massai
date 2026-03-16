from __future__ import annotations

from datetime import date
from typing import Any

from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.services.rules.base import AlertResult


class MilestoneOverdueRule:
    rule_type = "MILESTONE_OVERDUE"

    def evaluate(
        self,
        contract: Contract,
        update: StatusUpdate,
        rule_config: dict[str, Any],
        *,
        today: date,
    ) -> AlertResult | None:
        del update

        overdue = [
            milestone
            for milestone in list(contract.milestones or [])
            if self._is_overdue(milestone, today=today)
        ]
        if not overdue:
            return None

        overdue.sort(key=lambda item: item.planned_date or date.max)
        milestone = overdue[0]
        days_overdue = (today - milestone.planned_date).days if milestone.planned_date else 0
        severity = str(rule_config.get("severity", "MEDIUM")).upper()
        description = (
            f"Milestone '{milestone.milestone_ref or milestone.name or 'unknown'}' "
            f"is overdue by {days_overdue} day{'s' if days_overdue != 1 else ''}."
        )
        return AlertResult(
            rule_id=self.rule_type,
            severity=severity,
            description=description,
        )

    @staticmethod
    def _is_overdue(milestone: Milestone, *, today: date) -> bool:
        return (
            milestone.planned_date is not None
            and milestone.planned_date < today
            and (milestone.status or "").upper() != "COMPLETED"
        )

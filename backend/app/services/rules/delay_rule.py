from __future__ import annotations

import math
from datetime import date
from typing import Any

from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.services.rules.base import AlertResult


class DelayRule:
    rule_type = "DELAY"

    def evaluate(
        self,
        contract: Contract,
        update: StatusUpdate,
        rule_config: dict[str, Any],
        *,
        today: date,
    ) -> AlertResult | None:
        if contract.delivery_date is None or contract.activated_at is None:
            return None

        total_days = (contract.delivery_date - contract.activated_at.date()).days
        if total_days <= 0:
            return None

        elapsed_days = max((today - contract.activated_at.date()).days, 0)
        if elapsed_days <= 0:
            return None

        progress_ratio = self._progress_ratio(contract, update)
        if progress_ratio is None:
            return None

        expected_ratio = min(elapsed_days / total_days, 1.0)
        if progress_ratio >= expected_ratio:
            return None

        days_behind = math.ceil((expected_ratio - progress_ratio) * total_days)
        threshold_days = self._threshold_days(rule_config)
        if days_behind <= threshold_days:
            return None

        severity = str(rule_config.get("severity", "MEDIUM")).upper()
        return AlertResult(
            rule_id=self.rule_type,
            severity=severity,
            description=f"Production progress is {days_behind} days behind schedule.",
        )

    def _progress_ratio(self, contract: Contract, update: StatusUpdate) -> float | None:
        payload = dict(update.payload or {})
        quantity_produced = payload.get("quantityProduced")
        quantity_planned = payload.get("quantityPlanned")
        if quantity_produced is not None and quantity_planned not in (None, 0):
            try:
                return min(max(float(quantity_produced) / float(quantity_planned), 0.0), 1.0)
            except (TypeError, ValueError, ZeroDivisionError):
                return None

        completion_pct = payload.get("completionPct")
        if completion_pct is not None:
            try:
                return min(max(float(completion_pct) / 100.0, 0.0), 1.0)
            except (TypeError, ValueError):
                return None

        milestones = list(contract.milestones or [])
        if not milestones:
            return None
        completed = len([item for item in milestones if self._is_completed(item)])
        return completed / len(milestones)

    @staticmethod
    def _is_completed(milestone: Milestone) -> bool:
        return (milestone.status or "").upper() == "COMPLETED"

    @staticmethod
    def _threshold_days(rule_config: dict[str, Any]) -> int:
        for key in ("thresholdDays", "threshold_days", "days", "maxDelayDays"):
            value = rule_config.get(key)
            if value is None:
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
        return 2

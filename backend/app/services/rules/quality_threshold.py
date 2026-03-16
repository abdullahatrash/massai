from __future__ import annotations

from typing import Any

from app.models.contract import Contract
from app.models.status_update import StatusUpdate
from app.services.rules.base import AlertResult


class QualityThresholdRule:
    rule_type = "QUALITY_THRESHOLD"

    def evaluate(
        self,
        contract: Contract,
        update: StatusUpdate,
        rule_config: dict[str, Any],
        *,
        today: object,
    ) -> AlertResult | None:
        del contract, today

        payload = dict(update.payload or {})
        quality_pass_rate = payload.get("qualityPassRate")
        if quality_pass_rate is None:
            return None

        try:
            actual = float(quality_pass_rate)
            threshold = float(rule_config.get("threshold", 0.95))
        except (TypeError, ValueError):
            return None

        if actual >= threshold:
            return None

        severity = str(rule_config.get("severity", "HIGH")).upper()
        return AlertResult(
            rule_id=self.rule_type,
            severity=severity,
            description=(
                f"Quality pass rate {actual:.2f} fell below threshold {threshold:.2f}."
            ),
        )

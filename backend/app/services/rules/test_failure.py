from __future__ import annotations

from typing import Any

from app.models.contract import Contract
from app.models.status_update import StatusUpdate
from app.services.rules.base import AlertResult


class TestFailureRule:
    rule_type = "TEST_FAILURE"

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
        test_results = payload.get("testResults")
        if not isinstance(test_results, list):
            return None

        for result in test_results:
            if not isinstance(result, dict):
                continue
            if str(result.get("result", "")).upper() != "FAIL":
                continue
            test_name = result.get("testName") or result.get("name") or "Unnamed test"
            severity = str(rule_config.get("severity", "CRITICAL")).upper()
            return AlertResult(
                rule_id=self.rule_type,
                severity=severity,
                description=f"Test failure detected in '{test_name}'.",
            )

        return None

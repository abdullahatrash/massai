from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.contract import Contract
from app.models.status_update import StatusUpdate
from app.services.rules.base import AlertResult
from app.services.rules.delay_rule import DelayRule
from app.services.rules.milestone_overdue import MilestoneOverdueRule
from app.services.rules.quality_threshold import QualityThresholdRule
from app.services.rules.test_failure import TestFailureRule


class RuleStrategy(Protocol):
    rule_type: str

    def evaluate(
        self,
        contract: Contract,
        update: StatusUpdate,
        rule_config: dict[str, Any],
        *,
        today: date,
    ) -> AlertResult | None: ...


class RuleEngine:
    _RULES: dict[str, RuleStrategy] = {
        QualityThresholdRule.rule_type: QualityThresholdRule(),
        DelayRule.rule_type: DelayRule(),
        TestFailureRule.rule_type: TestFailureRule(),
        MilestoneOverdueRule.rule_type: MilestoneOverdueRule(),
    }

    @staticmethod
    async def evaluate(
        contract: Contract,
        update: StatusUpdate,
        session: AsyncSession,
        *,
        now: datetime | None = None,
    ) -> list[Alert]:
        evaluation_time = now or datetime.now(UTC)
        today = evaluation_time.date()
        triggered_alerts: list[Alert] = []

        active_alerts = {
            (alert.rule_id or "").upper(): alert
            for alert in list(contract.alerts or [])
            if alert.resolved_at is None
        }

        for rule_config in RuleEngine._rule_configs(contract, update):
            rule_type = str(rule_config.get("type", "")).upper()
            strategy = RuleEngine._RULES.get(rule_type)
            if strategy is None:
                continue

            result = strategy.evaluate(contract, update, rule_config, today=today)
            existing_alert = active_alerts.get(rule_type)
            if result is None:
                if existing_alert is not None:
                    existing_alert.resolved_at = evaluation_time
                continue

            if existing_alert is not None:
                existing_alert.severity = result.severity
                existing_alert.condition_description = result.description
                continue

            alert = Alert(
                id=uuid.uuid4(),
                contract_id=contract.id,
                rule_id=result.rule_id,
                condition_description=result.description,
                severity=result.severity,
                triggered_at=evaluation_time,
                blockchain_logged=False,
            )
            alert.contract = contract
            session.add(alert)
            if contract.alerts is None:
                contract.alerts = [alert]
            elif alert not in contract.alerts:
                contract.alerts.append(alert)
            active_alerts[rule_type] = alert
            triggered_alerts.append(alert)

        return triggered_alerts

    @staticmethod
    def _rule_configs(contract: Contract, update: StatusUpdate) -> list[dict[str, Any]]:
        configured_rules = []
        configured_types: set[str] = set()

        for item in list((contract.config or {}).get("alert_conditions") or []):
            if not isinstance(item, dict):
                continue
            rule_type = str(item.get("type", "")).upper()
            if not rule_type or rule_type == "NO_DATA_RECEIVED":
                continue
            configured_rules.append(dict(item))
            configured_types.add(rule_type)

        for default_rule in RuleEngine._default_rule_configs(contract, update):
            rule_type = str(default_rule.get("type", "")).upper()
            if not rule_type or rule_type in configured_types:
                continue
            configured_rules.append(default_rule)
            configured_types.add(rule_type)

        return configured_rules

    @staticmethod
    def _default_rule_configs(contract: Contract, update: StatusUpdate) -> list[dict[str, Any]]:
        defaults: list[dict[str, Any]] = [
            {"type": "MILESTONE_OVERDUE", "severity": "MEDIUM"},
            {"type": "DELAY", "severity": "MEDIUM", "thresholdDays": 2},
        ]

        payload = dict(update.payload or {})
        contract_config = dict(contract.config or {})
        pilot_type = (contract.pilot_type or "").upper()

        if (
            pilot_type == "FACTOR"
            or payload.get("qualityPassRate") is not None
            or contract_config.get("quality_target") is not None
        ):
            defaults.append(
                {
                    "type": "QUALITY_THRESHOLD",
                    "severity": "HIGH",
                    "threshold": contract_config.get("quality_target", 0.95),
                }
            )

        if pilot_type == "E4M" or isinstance(payload.get("testResults"), list):
            defaults.append({"type": "TEST_FAILURE", "severity": "CRITICAL"})

        return defaults

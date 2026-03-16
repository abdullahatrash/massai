from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from app.models.alert import Alert
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.status_update import StatusUpdate
from app.schemas.analytics import ContractAnalyticsResponse


class AnalyticsService:
    @staticmethod
    def build_contract_analytics(
        contract: Contract,
        *,
        today: date | None = None,
    ) -> dict[str, object]:
        current_day = today or datetime.now(UTC).date()
        milestones = list(contract.milestones or [])
        updates = sorted(
            list(contract.status_updates or []),
            key=lambda update: update.timestamp or datetime.min.replace(tzinfo=UTC),
        )
        alerts = list(contract.alerts or [])
        pilot_type = (contract.pilot_type or "").upper()

        payload: dict[str, Any] = {
            "overallProgress": AnalyticsService._overall_progress(milestones),
            "daysUntilDelivery": AnalyticsService._days_until_delivery(contract, today=current_day),
            "isOnTrack": AnalyticsService._is_on_track(contract, milestones, alerts, today=current_day),
            "milestoneSeries": AnalyticsService._milestone_series(contract, milestones, today=current_day),
        }

        if pilot_type == "FACTOR":
            payload.update(AnalyticsService._factor_metrics(contract, milestones, updates, today=current_day))
        elif pilot_type == "TASOWHEEL":
            payload.update(AnalyticsService._tasowheel_metrics(contract, updates))
        elif pilot_type == "E4M":
            payload.update(AnalyticsService._e4m_metrics(contract, milestones, updates))

        response = ContractAnalyticsResponse(**payload)
        return response.model_dump(by_alias=True, exclude_none=True)

    @staticmethod
    def _round(value: float | None) -> float | None:
        if value is None:
            return None
        return round(value, 2)

    @staticmethod
    def _percentage(numerator: int | float, denominator: int | float) -> float:
        if not denominator:
            return 0.0
        return round((float(numerator) / float(denominator)) * 100, 2)

    @staticmethod
    def _completed_milestones(milestones: list[Milestone]) -> list[Milestone]:
        return [milestone for milestone in milestones if (milestone.status or "").upper() == "COMPLETED"]

    @staticmethod
    def _overall_progress(milestones: list[Milestone]) -> float:
        completed = len(AnalyticsService._completed_milestones(milestones))
        return AnalyticsService._percentage(completed, len(milestones))

    @staticmethod
    def _contract_start_day(
        contract: Contract,
        milestones: list[Milestone],
        updates: list[StatusUpdate],
        *,
        today: date,
    ) -> date:
        if contract.activated_at is not None:
            return contract.activated_at.date()

        candidate_dates: list[date] = []
        for milestone in milestones:
            if milestone.planned_date is not None:
                candidate_dates.append(milestone.planned_date)
            if milestone.actual_date is not None:
                candidate_dates.append(milestone.actual_date)
        for update in updates:
            if update.timestamp is not None:
                candidate_dates.append(update.timestamp.date())

        return min(candidate_dates) if candidate_dates else today

    @staticmethod
    def _days_from_start(start_day: date, target_day: date | None) -> int | None:
        if target_day is None:
            return None
        return (target_day - start_day).days

    @staticmethod
    def _milestone_series(
        contract: Contract,
        milestones: list[Milestone],
        *,
        today: date,
    ) -> list[dict[str, object]]:
        start_day = AnalyticsService._contract_start_day(contract, milestones, [], today=today)
        ordered_milestones = sorted(
            milestones,
            key=lambda milestone: (
                milestone.planned_date or date.max,
                milestone.name or "",
                str(milestone.id),
            ),
        )
        return [
            {
                "actualDate": milestone.actual_date,
                "actualDaysFromStart": AnalyticsService._days_from_start(
                    start_day,
                    milestone.actual_date,
                ),
                "label": milestone.name or milestone.milestone_ref or "Milestone",
                "milestoneRef": milestone.milestone_ref,
                "plannedDate": milestone.planned_date,
                "plannedDaysFromStart": AnalyticsService._days_from_start(
                    start_day,
                    milestone.planned_date,
                ),
            }
            for milestone in ordered_milestones
        ]

    @staticmethod
    def _days_until_delivery(contract: Contract, *, today: date) -> int | None:
        if contract.delivery_date is None:
            return None
        return (contract.delivery_date - today).days

    @staticmethod
    def _has_active_high_alert(alerts: list[Alert]) -> bool:
        return any(
            alert.acknowledged_at is None
            and alert.resolved_at is None
            and (alert.severity or "").upper() in {"HIGH", "CRITICAL"}
            for alert in alerts
        )

    @staticmethod
    def _has_awaiting_consumer_approval(milestones: list[Milestone]) -> bool:
        return any(
            bool(milestone.approval_required) and (milestone.status or "").upper() == "SUBMITTED"
            for milestone in milestones
        )

    @staticmethod
    def _has_overdue_milestone(milestones: list[Milestone], *, today: date) -> bool:
        return any(
            milestone.planned_date is not None
            and milestone.planned_date < today
            and (milestone.status or "").upper() != "COMPLETED"
            for milestone in milestones
        )

    @staticmethod
    def _is_on_track(
        contract: Contract,
        milestones: list[Milestone],
        alerts: list[Alert],
        *,
        today: date,
    ) -> bool:
        if (contract.status or "").upper() == "DISPUTED":
            return False
        if AnalyticsService._has_awaiting_consumer_approval(milestones):
            return False
        if AnalyticsService._has_active_high_alert(alerts):
            return False
        if AnalyticsService._has_overdue_milestone(milestones, today=today):
            return False
        return True

    @staticmethod
    def _factor_metrics(
        contract: Contract,
        milestones: list[Milestone],
        updates: list[StatusUpdate],
        *,
        today: date,
    ) -> dict[str, object]:
        factor_updates = [update for update in updates if isinstance(update.payload, dict)]
        quality_values = [
            float(update.payload["qualityPassRate"])
            for update in factor_updates
            if update.payload is not None and update.payload.get("qualityPassRate") is not None
        ]
        last_known_state = dict((contract.config or {}).get("last_known_state") or {})
        shifts_completed = last_known_state.get("shiftsCompleted")
        if isinstance(shifts_completed, int) and shifts_completed > 0:
            expected_updates = shifts_completed
        elif contract.activated_at is not None:
            expected_updates = max((today - contract.activated_at.date()).days, 1)
        else:
            expected_updates = max(len(factor_updates), 1)

        due_milestones = [
            milestone
            for milestone in milestones
            if milestone.planned_date is not None and milestone.planned_date <= today
            or (milestone.status or "").upper() == "COMPLETED"
        ]
        on_time_milestones = [
            milestone
            for milestone in due_milestones
            if (milestone.status or "").upper() == "COMPLETED"
            and milestone.actual_date is not None
            and milestone.planned_date is not None
            and milestone.actual_date <= milestone.planned_date
        ]

        previous_quantity: float | None = None
        quality_series: list[dict[str, object]] = []
        velocity_series: list[dict[str, object]] = []
        for update in factor_updates:
            payload = dict(update.payload or {})
            timestamp = update.timestamp
            if timestamp is None:
                continue

            quality = payload.get("qualityPassRate")
            quantity = payload.get("quantityProduced")
            if isinstance(quality, (int, float)):
                quality_series.append(
                    {
                        "qualityPassRatePct": AnalyticsService._round(float(quality) * 100.0),
                        "quantityProduced": quantity,
                        "timestamp": timestamp,
                    }
                )
            if isinstance(quantity, (int, float)):
                quantity_value = float(quantity)
                delta = quantity_value if previous_quantity is None else max(quantity_value - previous_quantity, 0.0)
                velocity_series.append(
                    {
                        "quantityDelta": int(delta) if float(delta).is_integer() else round(delta, 2),
                        "timestamp": timestamp,
                    }
                )
                previous_quantity = quantity_value

        return {
            "automatedUpdatesPct": min(
                AnalyticsService._percentage(len(factor_updates), expected_updates),
                100.0,
            ),
            "factorQualitySeries": quality_series,
            "factorVelocitySeries": velocity_series,
            "qualityPassRateAvg": AnalyticsService._round(
                sum(quality_values) / len(quality_values) if quality_values else None
            ),
            "scheduleAdherence": AnalyticsService._percentage(
                len(on_time_milestones),
                len(due_milestones),
            ),
        }

    @staticmethod
    def _tasowheel_metrics(contract: Contract, updates: list[StatusUpdate]) -> dict[str, object]:
        payloads = [dict(update.payload or {}) for update in updates]
        total_downtime = sum(float(payload.get("downtimeMinutes", 0) or 0) for payload in payloads)
        total_energy = sum(float(payload.get("energyKwh", 0) or 0) for payload in payloads)
        total_carbon = sum(float(payload.get("carbonKgCo2e", 0) or 0) for payload in payloads)

        baseline_cycle = (
            dict((contract.config or {}).get("last_known_state") or {}).get("cycleTimeActualSec")
        )
        if baseline_cycle is None:
            baseline_cycle = next(
                (
                    payload.get("cycleTimeActualSec")
                    for payload in payloads
                    if payload.get("cycleTimeActualSec") is not None
                ),
                None,
            )
        cycle_efficiencies = [
            float(baseline_cycle) / float(payload["cycleTimeActualSec"])
            for payload in payloads
            if baseline_cycle not in (None, 0)
            and payload.get("cycleTimeActualSec") not in (None, 0)
        ]

        productive_minutes = sum(
            (float(payload.get("cycleTimeActualSec", 0) or 0) / 60.0)
            + float(payload.get("setupTimeActualMin", 0) or 0)
            for payload in payloads
        )
        total_minutes = productive_minutes + total_downtime
        resource_utilisation = (
            AnalyticsService._percentage(productive_minutes, total_minutes)
            if total_minutes
            else 0.0
        )

        energy_by_step: dict[int, float] = {}
        carbon_series: list[dict[str, object]] = []
        cumulative_carbon = 0.0
        for update in updates:
            payload = dict(update.payload or {})
            routing_step = payload.get("routingStep")
            energy = payload.get("energyKwh")
            carbon = payload.get("carbonKgCo2e")

            if isinstance(routing_step, int) and isinstance(energy, (int, float)):
                energy_by_step[routing_step] = energy_by_step.get(routing_step, 0.0) + float(energy)

            if isinstance(carbon, (int, float)) and update.timestamp is not None:
                cumulative_carbon += float(carbon)
                carbon_series.append(
                    {
                        "cumulativeCarbonKgCo2e": AnalyticsService._round(cumulative_carbon) or 0.0,
                        "timestamp": update.timestamp,
                    }
                )

        energy_series = [
            {
                "energyKwh": AnalyticsService._round(total_energy) or 0.0,
                "routingStep": routing_step,
                "stepLabel": (
                    next(
                        (
                            str((update.payload or {}).get("stepName"))
                            for update in updates
                            if (update.payload or {}).get("routingStep") == routing_step
                            and (update.payload or {}).get("stepName") is not None
                        ),
                        None,
                    )
                    or f"Step {routing_step}"
                ),
            }
            for routing_step, total_energy in sorted(energy_by_step.items())
        ]

        return {
            "totalDowntimeMinutes": AnalyticsService._round(total_downtime),
            "avgCycleTimeEfficiency": AnalyticsService._round(
                sum(cycle_efficiencies) / len(cycle_efficiencies) if cycle_efficiencies else None
            ),
            "tasowheelEnergySeries": energy_series,
            "tasowheelCarbonSeries": carbon_series,
            "totalEnergyKwh": AnalyticsService._round(total_energy),
            "totalCarbonKgCo2e": AnalyticsService._round(total_carbon),
            "resourceUtilisationPct": AnalyticsService._round(resource_utilisation),
        }

    @staticmethod
    def _e4m_metrics(
        contract: Contract,
        milestones: list[Milestone],
        updates: list[StatusUpdate],
    ) -> dict[str, object]:
        start_day = AnalyticsService._contract_start_day(contract, milestones, updates, today=datetime.now(UTC).date())
        completed = AnalyticsService._completed_milestones(milestones)
        completion_days = [
            float((milestone.actual_date - contract.activated_at.date()).days)
            for milestone in completed
            if milestone.actual_date is not None and contract.activated_at is not None
        ]

        test_results = [
            result
            for update in updates
            for result in (update.payload or {}).get("testResults", [])
            if isinstance(result, dict) and result.get("result") is not None
        ]
        passing_results = [
            result for result in test_results if str(result.get("result", "")).upper() == "PASS"
        ]

        latest_issue_source = dict((contract.config or {}).get("last_known_state") or {})
        issues = latest_issue_source.get("issues")
        if not isinstance(issues, list):
            issues = []
            for update in reversed(updates):
                update_issues = (update.payload or {}).get("issues")
                if isinstance(update_issues, list):
                    issues = update_issues
                    break
        open_issue_count = sum(
            1
            for issue in issues
            if isinstance(issue, dict)
            and str(issue.get("status", "OPEN")).upper() not in {"CLOSED", "RESOLVED", "DONE"}
        )

        phase_series = [
            {
                "actualDaysFromStart": AnalyticsService._days_from_start(
                    start_day,
                    milestone.actual_date,
                ),
                "phase": milestone.milestone_ref or milestone.name or "Phase",
                "plannedDaysFromStart": AnalyticsService._days_from_start(
                    start_day,
                    milestone.planned_date,
                ),
            }
            for milestone in sorted(
                milestones,
                key=lambda item: (
                    item.planned_date or date.max,
                    item.name or "",
                    str(item.id),
                ),
            )
        ]

        test_breakdown_counts: dict[str, int] = {}
        for result in test_results:
            bucket = str(result.get("result", "UNKNOWN")).upper()
            test_breakdown_counts[bucket] = test_breakdown_counts.get(bucket, 0) + 1

        return {
            "phasesCompleted": len(completed),
            "avgPhaseCompletionDays": AnalyticsService._round(
                sum(completion_days) / len(completion_days) if completion_days else None
            ),
            "e4mPhaseSeries": phase_series,
            "e4mTestBreakdown": [
                {
                    "count": count,
                    "result": result,
                }
                for result, count in sorted(test_breakdown_counts.items())
            ],
            "testPassRate": AnalyticsService._percentage(
                len(passing_results),
                len(test_results),
            ),
            "openIssueCount": open_issue_count,
        }

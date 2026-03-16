from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class MilestoneAnalyticsPoint(BaseModel):
    actual_date: date | None = Field(default=None, alias="actualDate")
    actual_days_from_start: int | None = Field(default=None, alias="actualDaysFromStart")
    label: str
    milestone_ref: str | None = Field(default=None, alias="milestoneRef")
    planned_date: date | None = Field(default=None, alias="plannedDate")
    planned_days_from_start: int | None = Field(default=None, alias="plannedDaysFromStart")

    model_config = {
        "populate_by_name": True,
    }


class FactorQualityPoint(BaseModel):
    quantity_produced: int | float | None = Field(default=None, alias="quantityProduced")
    quality_pass_rate_pct: float | None = Field(default=None, alias="qualityPassRatePct")
    timestamp: datetime

    model_config = {
        "populate_by_name": True,
    }


class FactorVelocityPoint(BaseModel):
    quantity_delta: int | float = Field(alias="quantityDelta")
    timestamp: datetime

    model_config = {
        "populate_by_name": True,
    }


class TasowheelEnergyPoint(BaseModel):
    energy_kwh: float = Field(alias="energyKwh")
    routing_step: int = Field(alias="routingStep")
    step_label: str = Field(alias="stepLabel")

    model_config = {
        "populate_by_name": True,
    }


class TasowheelCarbonPoint(BaseModel):
    cumulative_carbon_kg_co2e: float = Field(alias="cumulativeCarbonKgCo2e")
    timestamp: datetime

    model_config = {
        "populate_by_name": True,
    }


class E4mPhasePoint(BaseModel):
    actual_days_from_start: int | None = Field(default=None, alias="actualDaysFromStart")
    phase: str
    planned_days_from_start: int | None = Field(default=None, alias="plannedDaysFromStart")

    model_config = {
        "populate_by_name": True,
    }


class TestBreakdownPoint(BaseModel):
    count: int
    result: str


class ContractAnalyticsResponse(BaseModel):
    overall_progress: float = Field(alias="overallProgress")
    days_until_delivery: int | None = Field(alias="daysUntilDelivery")
    is_on_track: bool = Field(alias="isOnTrack")

    automated_updates_pct: float | None = Field(default=None, alias="automatedUpdatesPct")
    quality_pass_rate_avg: float | None = Field(default=None, alias="qualityPassRateAvg")
    schedule_adherence: float | None = Field(default=None, alias="scheduleAdherence")

    total_downtime_minutes: float | None = Field(default=None, alias="totalDowntimeMinutes")
    avg_cycle_time_efficiency: float | None = Field(default=None, alias="avgCycleTimeEfficiency")
    total_energy_kwh: float | None = Field(default=None, alias="totalEnergyKwh")
    total_carbon_kg_co2e: float | None = Field(default=None, alias="totalCarbonKgCo2e")
    resource_utilisation_pct: float | None = Field(default=None, alias="resourceUtilisationPct")

    phases_completed: int | None = Field(default=None, alias="phasesCompleted")
    avg_phase_completion_days: float | None = Field(default=None, alias="avgPhaseCompletionDays")
    test_pass_rate: float | None = Field(default=None, alias="testPassRate")
    open_issue_count: int | None = Field(default=None, alias="openIssueCount")

    milestone_series: list[MilestoneAnalyticsPoint] = Field(default_factory=list, alias="milestoneSeries")
    factor_quality_series: list[FactorQualityPoint] = Field(default_factory=list, alias="factorQualitySeries")
    factor_velocity_series: list[FactorVelocityPoint] = Field(default_factory=list, alias="factorVelocitySeries")
    tasowheel_energy_series: list[TasowheelEnergyPoint] = Field(default_factory=list, alias="tasowheelEnergySeries")
    tasowheel_carbon_series: list[TasowheelCarbonPoint] = Field(default_factory=list, alias="tasowheelCarbonSeries")
    e4m_phase_series: list[E4mPhasePoint] = Field(default_factory=list, alias="e4mPhaseSeries")
    e4m_test_breakdown: list[TestBreakdownPoint] = Field(default_factory=list, alias="e4mTestBreakdown")

    model_config = {
        "populate_by_name": True,
    }

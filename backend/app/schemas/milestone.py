from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class ApproveMilestoneRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)


class RejectMilestoneRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class MilestoneDecisionResponse(BaseModel):
    milestone_id: str = Field(alias="milestoneId")
    contract_id: str = Field(alias="contractId")
    status: str

    model_config = {
        "populate_by_name": True,
    }


class MilestoneSummaryResponse(BaseModel):
    id: str
    milestone_ref: str | None = Field(alias="milestoneRef")
    name: str | None
    planned_date: date | None = Field(alias="plannedDate")
    actual_date: date | None = Field(alias="actualDate")
    status: str | None
    approval_required: bool = Field(alias="approvalRequired")
    is_overdue: bool = Field(alias="isOverdue")
    quality_gate: float | None = Field(default=None, alias="qualityGate")

    model_config = {
        "populate_by_name": True,
    }


class MilestoneDetailResponse(MilestoneSummaryResponse):
    evidence: list[Any] = Field(default_factory=list)

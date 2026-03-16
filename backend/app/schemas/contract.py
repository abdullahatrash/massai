from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class NextMilestoneResponse(BaseModel):
    name: str
    planned_date: date = Field(alias="plannedDate")
    days_remaining: int = Field(alias="daysRemaining")

    model_config = {
        "populate_by_name": True,
    }


class ContractListItemResponse(BaseModel):
    id: str
    pilot_type: str | None = Field(alias="pilotType")
    status: str | None
    status_badge: str = Field(alias="statusBadge")
    product_name: str | None = Field(alias="productName")
    provider_id: str | None = Field(alias="providerId")
    delivery_date: date | None = Field(alias="deliveryDate")
    milestones_completed: int = Field(alias="milestonesCompleted")
    milestones_total: int = Field(alias="milestonesTotal")

    model_config = {
        "populate_by_name": True,
    }


class ContractOverviewResponse(ContractListItemResponse):
    last_known_state: dict[str, Any] = Field(alias="lastKnownState")
    next_milestone: NextMilestoneResponse | None = Field(alias="nextMilestone")


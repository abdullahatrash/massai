from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: str
    event_type: str | None = Field(alias="eventType")
    message: str
    contract_id: str | None = Field(alias="contractId")
    milestone_id: str | None = Field(alias="milestoneId")
    created_at: datetime | None = Field(alias="createdAt")
    read_at: datetime | None = Field(alias="readAt")
    payload: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
    }

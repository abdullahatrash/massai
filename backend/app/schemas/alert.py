from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AlertResponse(BaseModel):
    id: str
    severity: str | None
    description: str = Field(alias="description")
    triggered_at: datetime | None = Field(alias="triggeredAt")
    acknowledged_at: datetime | None = Field(alias="acknowledgedAt")
    resolved_at: datetime | None = Field(alias="resolvedAt")
    blockchain_verified: bool = Field(alias="blockchainVerified")
    verified_at: datetime | None = Field(alias="verifiedAt")

    model_config = {
        "populate_by_name": True,
    }

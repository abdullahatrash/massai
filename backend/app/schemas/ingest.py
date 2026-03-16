from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import AnyUrl, BaseModel, Field, field_validator


class UpdateType(str, Enum):
    PRODUCTION_UPDATE = "PRODUCTION_UPDATE"
    MILESTONE_COMPLETE = "MILESTONE_COMPLETE"
    PHASE_CHANGE = "PHASE_CHANGE"
    QUALITY_EVENT = "QUALITY_EVENT"


class IngestRequest(BaseModel):
    update_type: UpdateType = Field(alias="updateType")
    timestamp: datetime
    sensor_id: str = Field(alias="sensorId", min_length=1)
    payload: dict[str, Any]
    evidence: list[AnyUrl] | None = None

    model_config = {
        "populate_by_name": True,
    }

    @field_validator("timestamp")
    @classmethod
    def timestamp_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Timestamp must include a timezone offset.")
        return value


class IngestResponse(BaseModel):
    update_id: str = Field(alias="updateId")
    contract_id: str = Field(alias="contractId")
    processed: bool

    model_config = {
        "populate_by_name": True,
    }

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


class DocumentEvidenceReference(BaseModel):
    name: str = Field(min_length=1)
    url: AnyUrl
    format: str | None = None
    uploaded_at: datetime | None = Field(default=None, alias="uploadedAt")

    model_config = {
        "populate_by_name": True,
    }

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Document name must not be blank.")
        return stripped

    @field_validator("format")
    @classmethod
    def format_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Document format must not be blank.")
        return stripped

    @field_validator("uploaded_at")
    @classmethod
    def uploaded_at_must_be_timezone_aware(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("uploadedAt must include a timezone offset.")
        return value


EvidenceItem = AnyUrl | DocumentEvidenceReference


class IngestRequest(BaseModel):
    update_type: UpdateType = Field(alias="updateType")
    timestamp: datetime
    sensor_id: str = Field(alias="sensorId", min_length=1)
    payload: dict[str, Any]
    evidence: list[EvidenceItem] | None = None

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

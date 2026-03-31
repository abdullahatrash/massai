from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CreateIngestProfileRequest(BaseModel):
    profile_key: str = Field(alias="profileKey", min_length=1)
    factory_key: str = Field(alias="factoryKey", min_length=1)
    pilot_type: str = Field(alias="pilotType", min_length=1)
    version: int = Field(ge=1)
    status: str = Field(default="ACTIVE", min_length=1)
    description: str | None = None
    definition: dict[str, Any]

    model_config = {
        "populate_by_name": True,
    }


class BindContractIngestProfileRequest(BaseModel):
    profile_key: str = Field(alias="profileKey", min_length=1)
    version: int = Field(ge=1)

    model_config = {
        "populate_by_name": True,
    }


class IngestProfileSummaryResponse(BaseModel):
    profile_key: str = Field(alias="profileKey")
    factory_key: str = Field(alias="factoryKey")
    pilot_type: str | None = Field(alias="pilotType")
    version: int
    status: str
    source: str
    supported_update_types: list[str] = Field(alias="supportedUpdateTypes")

    model_config = {
        "populate_by_name": True,
    }


class IngestProfileDetailResponse(IngestProfileSummaryResponse):
    description: str | None = None
    resolved_spec: dict[str, Any] = Field(alias="resolvedSpec")


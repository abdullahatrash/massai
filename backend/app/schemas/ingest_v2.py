from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.ingest import EvidenceItem, UpdateType


class V2IngestRequest(BaseModel):
    update_type: UpdateType = Field(alias="updateType")
    timestamp: datetime
    source_id: str = Field(alias="sourceId", min_length=1)
    payload: dict[str, Any]
    evidence: list[EvidenceItem] | None = None
    profile_version: int | None = Field(default=None, alias="profileVersion")

    model_config = {
        "populate_by_name": True,
    }


class V2IngestResponse(BaseModel):
    update_id: str = Field(alias="updateId")
    contract_id: str = Field(alias="contractId")
    processed: bool
    schema_version: str = Field(alias="schemaVersion")
    profile_key: str = Field(alias="profileKey")
    profile_version: int = Field(alias="profileVersion")

    model_config = {
        "populate_by_name": True,
    }


class ContractIngestSpecResponse(BaseModel):
    contract_id: str = Field(alias="contractId")
    pilot_type: str | None = Field(alias="pilotType")
    profile_key: str = Field(alias="profileKey")
    profile_version: int = Field(alias="profileVersion")
    schema_version: str = Field(alias="schemaVersion")
    allowed_update_types: list[str] = Field(alias="allowedUpdateTypes")
    update_types: dict[str, Any] = Field(alias="updateTypes")
    contract_context: dict[str, Any] = Field(alias="contractContext")

    model_config = {
        "populate_by_name": True,
    }


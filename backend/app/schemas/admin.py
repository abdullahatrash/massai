from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class CreateAdminContractRequest(BaseModel):
    blockchain_contract_address: str = Field(alias="blockchainContractAddress")
    pilot_type: str = Field(alias="pilotType")

    model_config = {
        "populate_by_name": True,
    }


class AdminContractResponse(BaseModel):
    id: str
    contract_id: str = Field(alias="contractId")
    blockchain_contract_address: str = Field(alias="blockchainContractAddress")
    pilot_type: str | None = Field(alias="pilotType")
    status: str | None
    provider_id: str | None = Field(alias="providerId")
    consumer_id: str | None = Field(alias="consumerId")
    product_name: str | None = Field(alias="productName")
    delivery_date: date | None = Field(alias="deliveryDate")
    milestone_count: int = Field(alias="milestoneCount")
    ingest_profile_key: str | None = Field(default=None, alias="ingestProfileKey")
    ingest_profile_version: int | None = Field(default=None, alias="ingestProfileVersion")

    model_config = {
        "populate_by_name": True,
    }


class DemoMilestoneRequest(BaseModel):
    milestone_ref: str = Field(alias="milestoneRef", min_length=1)
    name: str = Field(min_length=1)
    planned_date: date = Field(alias="plannedDate")
    approval_required: bool = Field(default=False, alias="approvalRequired")
    completion_criteria: dict[str, Any] = Field(
        default_factory=dict,
        alias="completionCriteria",
    )

    model_config = {
        "populate_by_name": True,
    }


class ContractHealthSummaryItem(BaseModel):
    contract_id: str = Field(alias="contractId")
    pilot_type: str | None = Field(alias="pilotType")
    product_name: str | None = Field(alias="productName")
    status: str | None
    last_update_at: str | None = Field(alias="lastUpdateAt")
    stale_since_minutes: int | None = Field(alias="staleSinceMinutes")
    total_updates: int = Field(alias="totalUpdates")
    processed_count: int = Field(alias="processedCount")
    unprocessed_count: int = Field(alias="unprocessedCount")
    active_alert_count: int = Field(alias="activeAlertCount")
    overdue_milestone_count: int = Field(alias="overdueMilestoneCount")
    milestones_completed: int = Field(alias="milestonesCompleted")
    milestones_total: int = Field(alias="milestonesTotal")

    model_config = {
        "populate_by_name": True,
    }


class ContractHealthResponse(ContractHealthSummaryItem):
    last_known_state: dict[str, Any] = Field(alias="lastKnownState")
    update_frequency_minutes: float | None = Field(alias="updateFrequencyMinutes")
    ingest_profile_key: str | None = Field(default=None, alias="ingestProfileKey")
    ingest_profile_version: int | None = Field(default=None, alias="ingestProfileVersion")

    model_config = {
        "populate_by_name": True,
    }


class StatusUpdateListItem(BaseModel):
    id: str
    update_type: str | None = Field(alias="updateType")
    source_id: str | None = Field(alias="sourceId")
    sensor_id: str | None = Field(alias="sensorId")
    timestamp: str | None
    processed: bool | None
    evidence_count: int = Field(alias="evidenceCount")
    payload: dict[str, Any] | None = None

    model_config = {
        "populate_by_name": True,
    }


class StatusUpdateDetailResponse(StatusUpdateListItem):
    evidence: list[Any] = Field(default_factory=list)
    ingest_schema_version: str | None = Field(alias="ingestSchemaVersion")
    ingest_profile_version: int | None = Field(alias="ingestProfileVersion")

    model_config = {
        "populate_by_name": True,
    }


class CreateDemoContractRequest(BaseModel):
    contract_id: str = Field(alias="contractId", min_length=1)
    pilot_type: str = Field(alias="pilotType", min_length=1)
    factory_name: str = Field(alias="factoryName", min_length=1)
    provider_id: str = Field(alias="providerId", min_length=1)
    consumer_id: str = Field(alias="consumerId", min_length=1)
    product_name: str = Field(alias="productName", min_length=1)
    quantity_total: int = Field(alias="quantityTotal", ge=1)
    delivery_date: date = Field(alias="deliveryDate")
    agreement_type: str = Field(alias="agreementType", min_length=1)
    status: str = Field(default="ACTIVE", min_length=1)
    milestones: list[DemoMilestoneRequest] = Field(min_length=1)
    alert_conditions: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="alertConditions",
    )
    profile_key: str | None = Field(default=None, alias="profileKey")
    profile_version: int | None = Field(default=None, alias="profileVersion", ge=1)
    quality_target: float | None = Field(default=None, alias="qualityTarget")
    data_update_frequency: dict[str, Any] | int | float | str | None = Field(
        default=None,
        alias="dataUpdateFrequency",
    )

    model_config = {
        "populate_by_name": True,
    }

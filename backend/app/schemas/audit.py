from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AuditContractMetadata(BaseModel):
    contract_id: str = Field(alias="contractId")
    pilot_type: str | None = Field(alias="pilotType")
    status: str | None
    provider_id: str | None = Field(alias="providerId")
    consumer_id: str | None = Field(alias="consumerId")
    product_name: str | None = Field(alias="productName")
    quantity_total: int | None = Field(alias="quantityTotal")
    delivery_date: date | None = Field(alias="deliveryDate")
    agreement_type: str | None = Field(alias="agreementType")

    model_config = {
        "populate_by_name": True,
    }


class AuditMilestoneResponse(BaseModel):
    id: str
    milestone_ref: str | None = Field(alias="milestoneRef")
    name: str | None
    planned_date: date | None = Field(alias="plannedDate")
    actual_date: date | None = Field(alias="actualDate")
    status: str | None
    approval_required: bool = Field(alias="approvalRequired")
    evidence: list[Any] = Field(default_factory=list)
    blockchain_verified: bool = Field(alias="blockchainVerified")
    verified_at: datetime | None = Field(alias="verifiedAt")
    transaction_hash: str | None = Field(alias="transactionHash")

    model_config = {
        "populate_by_name": True,
    }


class AuditAlertResponse(BaseModel):
    id: str
    severity: str | None
    description: str
    triggered_at: datetime | None = Field(alias="triggeredAt")
    acknowledged_at: datetime | None = Field(alias="acknowledgedAt")
    resolved_at: datetime | None = Field(alias="resolvedAt")
    blockchain_verified: bool = Field(alias="blockchainVerified")
    verified_at: datetime | None = Field(alias="verifiedAt")

    model_config = {
        "populate_by_name": True,
    }


class AuditTimelineEventResponse(BaseModel):
    id: str
    timestamp: datetime
    type: str
    description: str
    icon: str


class AuditExportResponse(BaseModel):
    contract_id: str = Field(alias="contractId")
    exported_at: datetime = Field(alias="exportedAt")
    export_format: Literal["json", "pdf"] = Field(alias="exportFormat")
    contract: AuditContractMetadata
    milestones: list[AuditMilestoneResponse]
    alerts: list[AuditAlertResponse]
    timeline_events: list[AuditTimelineEventResponse] = Field(alias="timelineEvents")

    model_config = {
        "populate_by_name": True,
    }

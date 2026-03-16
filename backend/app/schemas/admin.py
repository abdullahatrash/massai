from __future__ import annotations

from datetime import date

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

    model_config = {
        "populate_by_name": True,
    }

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.contract import Contract

from app.core.config import get_settings


@dataclass(frozen=True, slots=True)
class BlockchainMilestoneMetadata:
    milestone_ref: str
    name: str
    planned_date: date
    approval_required: bool = False


@dataclass(frozen=True, slots=True)
class BlockchainContractMetadata:
    agreement_id: str
    blockchain_contract_address: str
    pilot_type: str
    provider_id: str
    consumer_id: str
    product_name: str
    quantity_total: int
    delivery_date: date
    contract_status: str
    agreement_type: str
    milestones: tuple[BlockchainMilestoneMetadata, ...]
    alert_conditions: tuple[dict[str, object], ...] = ()


@dataclass(frozen=True, slots=True)
class BlockchainWriteResult:
    transaction_hash: str
    block_number: int | None = None


class BlockchainService(Protocol):
    async def get_contract_metadata(
        self,
        address: str,
    ) -> BlockchainContractMetadata: ...

    async def log_alert_event(
        self,
        contract: "Contract",
        alert: "Alert",
    ) -> BlockchainWriteResult: ...


@lru_cache
def get_blockchain_service() -> BlockchainService:
    settings = get_settings()
    adapter = settings.blockchain_adapter.lower()
    if adapter == "mock":
        from app.services.blockchain_mock import MockBlockchainService

        return MockBlockchainService()
    if adapter == "real":
        from app.services.blockchain_real import RealBlockchainService

        return RealBlockchainService()
    raise RuntimeError(f"Unsupported blockchain adapter '{settings.blockchain_adapter}'.")

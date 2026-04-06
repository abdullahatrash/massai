from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any, Iterable

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.blockchain import BlockchainContractMetadata, BlockchainService
from app.core.response import ApiException
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.status_update import StatusUpdate
from app.schemas.admin import AdminContractResponse, CreateDemoContractRequest
from app.services.ingest_profiles import IngestProfileService

_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


class ContractOnboardingService:
    @staticmethod
    def validate_blockchain_address(address: str) -> str:
        if not _ADDRESS_RE.fullmatch(address):
            raise ApiException(
                status_code=400,
                code="INVALID_BLOCKCHAIN_ADDRESS",
                message="Invalid blockchain contract address.",
            )
        return address

    @staticmethod
    async def create_contract(
        session: AsyncSession,
        blockchain_service: BlockchainService,
        *,
        blockchain_contract_address: str,
        pilot_type: str,
        now: datetime | None = None,
    ) -> Contract:
        normalized_address = ContractOnboardingService.validate_blockchain_address(
            blockchain_contract_address
        )
        existing = await ContractOnboardingService._get_contract_by_address(
            session,
            normalized_address,
        )
        if existing is not None:
            raise ApiException(
                status_code=409,
                code="CONTRACT_ALREADY_EXISTS",
                message="Contract already registered.",
            )

        metadata = await blockchain_service.get_contract_metadata(normalized_address)
        if metadata.pilot_type.upper() != pilot_type.upper():
            raise ApiException(
                status_code=400,
                code="PILOT_TYPE_MISMATCH",
                message="Blockchain metadata pilot type does not match request.",
            )

        contract = Contract(id=uuid.uuid4())
        session.add(contract)
        await ContractOnboardingService._apply_metadata(
            contract,
            metadata,
            session=session,
            now=now,
        )
        await session.flush()
        return contract

    @staticmethod
    async def sync_contract(
        session: AsyncSession,
        blockchain_service: BlockchainService,
        contract: Contract,
        *,
        now: datetime | None = None,
    ) -> Contract:
        if not contract.blockchain_contract_address:
            raise ApiException(
                status_code=400,
                code="MISSING_BLOCKCHAIN_ADDRESS",
                message="Contract is missing a blockchain address.",
            )
        metadata = await blockchain_service.get_contract_metadata(
            contract.blockchain_contract_address
        )
        await ContractOnboardingService._apply_metadata(
            contract,
            metadata,
            session=session,
            now=now,
        )
        await session.flush()
        return contract

    @staticmethod
    async def _apply_metadata(
        contract: Contract,
        metadata: BlockchainContractMetadata,
        *,
        session: AsyncSession,
        now: datetime | None = None,
    ) -> None:
        contract.public_id = metadata.agreement_id
        contract.blockchain_contract_address = metadata.blockchain_contract_address
        contract.pilot_type = metadata.pilot_type
        contract.provider_id = metadata.provider_id
        contract.consumer_id = metadata.consumer_id
        contract.product_name = metadata.product_name
        contract.quantity_total = metadata.quantity_total
        contract.delivery_date = metadata.delivery_date
        contract.status = metadata.contract_status
        contract.agreement_type = metadata.agreement_type
        contract.activated_at = now or datetime.now(UTC)
        config = dict(contract.config or {})
        config.update(
            {
                "public_id": metadata.agreement_id,
                "alert_conditions": list(metadata.alert_conditions),
                "last_known_state": dict(config.get("last_known_state") or {}),
            }
        )
        contract.config = config
        IngestProfileService.bind_default_profile(contract)

        existing_milestones = {
            milestone.milestone_ref: milestone
            for milestone in list(contract.milestones or [])
            if milestone.milestone_ref
        }
        updated_milestones: list[Milestone] = []
        for item in metadata.milestones:
            milestone = existing_milestones.get(item.milestone_ref)
            if milestone is None:
                milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
                milestone.contract = contract
                session.add(milestone)
            milestone.contract_id = contract.id
            milestone.milestone_ref = item.milestone_ref
            milestone.name = item.name
            milestone.planned_date = item.planned_date
            milestone.approval_required = item.approval_required
            if milestone.status is None:
                milestone.status = "PENDING"
            if milestone.evidence is None:
                milestone.evidence = []
            updated_milestones.append(milestone)
        contract.milestones = updated_milestones

    @staticmethod
    async def _get_contract_by_address(
        session: AsyncSession,
        blockchain_contract_address: str,
    ) -> Contract | None:
        result = await session.execute(
            select(Contract).where(
                Contract.blockchain_contract_address == blockchain_contract_address
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_contract_by_public_id(
        session: AsyncSession,
        public_id: str,
    ) -> Contract | None:
        result = await session.execute(
            select(Contract).where(Contract.public_id == public_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_demo_contract(
        session: AsyncSession,
        request: CreateDemoContractRequest,
    ) -> Contract:
        existing_contract = await ContractOnboardingService._get_contract_by_public_id(
            session,
            request.contract_id,
        )
        if existing_contract is not None:
            raise ApiException(
                status_code=409,
                code="CONTRACT_ALREADY_EXISTS",
                message="Contract already registered.",
            )

        contract = Contract(id=uuid.uuid4())
        session.add(contract)
        contract.public_id = request.contract_id
        contract.blockchain_contract_address = None
        contract.pilot_type = request.pilot_type.upper()
        contract.agreement_type = request.agreement_type
        contract.status = request.status.upper()
        contract.provider_id = request.provider_id
        contract.consumer_id = request.consumer_id
        contract.product_name = request.product_name
        contract.quantity_total = request.quantity_total
        contract.delivery_date = request.delivery_date
        contract.activated_at = datetime.now(UTC)
        contract.config = ContractOnboardingService._build_demo_contract_config(request)

        milestones: list[Milestone] = []
        for milestone_request in request.milestones:
            milestone = Milestone(
                id=uuid.uuid4(),
                contract_id=contract.id,
            )
            milestone.contract = contract
            milestone.milestone_ref = milestone_request.milestone_ref
            milestone.name = milestone_request.name
            milestone.planned_date = milestone_request.planned_date
            milestone.approval_required = milestone_request.approval_required
            milestone.status = "PENDING"
            milestone.evidence = []
            milestone.completion_criteria = dict(milestone_request.completion_criteria or {})
            session.add(milestone)
            milestones.append(milestone)
        contract.milestones = milestones

        if request.profile_key and request.profile_version:
            await ContractOnboardingService._bind_requested_profile(
                session,
                contract,
                request.profile_key,
                request.profile_version,
            )
        else:
            IngestProfileService.bind_default_profile(contract)

        await session.flush()
        return contract

    @staticmethod
    async def _bind_requested_profile(
        session: AsyncSession,
        contract: Contract,
        profile_key: str,
        profile_version: int,
    ) -> None:
        try:
            resolved_spec = IngestProfileService.resolve_builtin_profile(
                profile_key,
                profile_version,
            )
            profile_id = None
        except ApiException:
            profile = await IngestProfileService.get_profile(
                session,
                profile_key,
                profile_version,
            )
            if profile is None:
                raise ApiException(
                    status_code=404,
                    code="INGEST_PROFILE_NOT_FOUND",
                    message="Ingest profile not found.",
                )
            resolved_spec = dict(profile.resolved_spec or {})
            profile_id = profile.id

        resolved_spec["profileVersion"] = profile_version
        IngestProfileService.bind_contract_snapshot(
            contract,
            resolved_spec,
            profile_id=profile_id,
        )

    @staticmethod
    def _build_demo_contract_config(
        request: CreateDemoContractRequest,
    ) -> dict[str, Any]:
        config: dict[str, Any] = {
            "public_id": request.contract_id,
            "factory_name": request.factory_name,
            "alert_conditions": list(request.alert_conditions or []),
            "last_known_state": {
                "quantityPlanned": request.quantity_total,
                "quantityProduced": 0,
            },
        }
        if request.quality_target is not None:
            config["quality_target"] = request.quality_target
        if request.data_update_frequency is not None:
            config["dataUpdateFrequency"] = request.data_update_frequency
        return config

    @staticmethod
    def serialize_contract(contract: Contract) -> dict[str, object]:
        payload = AdminContractResponse(
            id=str(contract.id),
            contractId=contract.public_id or "",
            blockchainContractAddress=contract.blockchain_contract_address or "",
            pilotType=contract.pilot_type,
            status=contract.status,
            providerId=contract.provider_id,
            consumerId=contract.consumer_id,
            productName=contract.product_name,
            deliveryDate=contract.delivery_date,
            milestoneCount=len(contract.milestones or []),
            ingestProfileKey=contract.ingest_profile_key,
            ingestProfileVersion=contract.ingest_profile_version,
        )
        return payload.model_dump(by_alias=True)

    @staticmethod
    def serialize_contracts(contracts: Iterable[Contract]) -> list[dict[str, object]]:
        return [ContractOnboardingService.serialize_contract(contract) for contract in contracts]

    @staticmethod
    async def delete_contract(
        session: AsyncSession,
        contract: Contract,
    ) -> None:
        contract_id = contract.id
        await session.execute(delete(Notification).where(Notification.contract_id == contract_id))
        await session.execute(delete(BlockchainEvent).where(BlockchainEvent.contract_id == contract_id))
        await session.execute(delete(Alert).where(Alert.contract_id == contract_id))
        await session.execute(delete(StatusUpdate).where(StatusUpdate.contract_id == contract_id))
        await session.execute(delete(Milestone).where(Milestone.contract_id == contract_id))
        await session.delete(contract)

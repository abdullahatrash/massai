from __future__ import annotations

import unittest
import uuid
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.admin import router as admin_router
from app.api.v1.contracts import router as contracts_router
from app.api.v1.milestones import router as milestones_router
from app.core.auth import CurrentUser, get_current_user
from app.core.blockchain import (
    BlockchainContractMetadata,
    BlockchainMilestoneMetadata,
)
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.contract import Contract
from app.models.milestone import Milestone


class FakeScalarCollection:
    def __init__(self, values: list[Any]) -> None:
        self._values = values

    def all(self) -> list[Any]:
        return list(self._values)


class FakeResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value

    def scalars(self) -> FakeScalarCollection:
        if isinstance(self._value, list):
            return FakeScalarCollection(self._value)
        if self._value is None:
            return FakeScalarCollection([])
        return FakeScalarCollection([self._value])


class FakeBlockchainService:
    def __init__(self) -> None:
        self.metadata = {
            "0x1111111111111111111111111111111111111111": BlockchainContractMetadata(
                agreement_id="contract-admin-factor-001",
                blockchain_contract_address="0x1111111111111111111111111111111111111111",
                pilot_type="FACTOR",
                provider_id="provider-admin@test.com",
                consumer_id="consumer-admin@test.com",
                product_name="Helical Gear Type A - Batch 500",
                quantity_total=500,
                delivery_date=date.today() + timedelta(days=60),
                contract_status="ACTIVE",
                agreement_type="PRODUCTION_MONITORING",
                milestones=(
                    BlockchainMilestoneMetadata(
                        milestone_ref="TURNING",
                        name="Turning",
                        planned_date=date.today() + timedelta(days=10),
                    ),
                    BlockchainMilestoneMetadata(
                        milestone_ref="INSPECTION",
                        name="Inspection",
                        planned_date=date.today() + timedelta(days=25),
                        approval_required=True,
                    ),
                ),
            ),
        }

    async def get_contract_metadata(self, address: str) -> BlockchainContractMetadata:
        if address not in self.metadata:
            from app.core.response import ApiException

            raise ApiException(
                status_code=404,
                code="BLOCKCHAIN_CONTRACT_NOT_FOUND",
                message="No contract metadata found for this blockchain address.",
            )
        return self.metadata[address]


class FakeSession:
    def __init__(self, contracts: list[Contract] | None = None) -> None:
        self.contracts = list(contracts or [])
        self.contracts_by_uuid = {contract.id: contract for contract in self.contracts}
        self.contracts_by_public_id = {
            contract.public_id: contract for contract in self.contracts if contract.public_id
        }
        self.contracts_by_address = {
            contract.blockchain_contract_address: contract
            for contract in self.contracts
            if contract.blockchain_contract_address
        }
        self.milestones_by_uuid: dict[uuid.UUID, Milestone] = {}
        for contract in self.contracts:
            for milestone in contract.milestones or []:
                self.milestones_by_uuid[milestone.id] = milestone
        self.commit_called = False
        self.flush_called = False

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        statement_text = str(statement)

        if "milestones.id" in statement_text and "contract_id_1" in params:
            milestone = self.milestones_by_uuid.get(params["id_1"])
            if milestone is None or milestone.contract_id != params["contract_id_1"]:
                return FakeResult(None)
            return FakeResult(milestone)

        if "WHERE contracts.public_id =" in statement_text:
            public_id = next((value for value in params.values() if isinstance(value, str)), None)
            return FakeResult(self.contracts_by_public_id.get(public_id))

        if "WHERE contracts.blockchain_contract_address =" in statement_text:
            address = next((value for value in params.values() if isinstance(value, str)), None)
            return FakeResult(self.contracts_by_address.get(address))

        list_filter = next(
            (value for value in params.values() if isinstance(value, (list, tuple))),
            None,
        )
        if isinstance(list_filter, (list, tuple)):
            filtered = [
                self.contracts_by_public_id[public_id]
                for public_id in list_filter
                if public_id in self.contracts_by_public_id
            ]
            limit = statement._limit_clause.value if statement._limit_clause is not None else None
            offset = statement._offset_clause.value if statement._offset_clause is not None else 0
            sliced = filtered[offset : offset + limit] if limit is not None else filtered[offset:]
            return FakeResult(sliced)

        if "ORDER BY contracts.delivery_date ASC, contracts.public_id ASC" in statement_text:
            ordered = sorted(
                self.contracts,
                key=lambda contract: (
                    contract.delivery_date or date.max,
                    contract.public_id or "",
                ),
            )
            return FakeResult(ordered)

        return FakeResult(None)

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if identifier in self.milestones_by_uuid:
            return self.milestones_by_uuid[identifier]
        return self.contracts_by_uuid.get(identifier)

    def add(self, instance: Any) -> None:
        if isinstance(instance, Contract):
            self.contracts.append(instance)
            self.contracts_by_uuid[instance.id] = instance
            if instance.public_id:
                self.contracts_by_public_id[instance.public_id] = instance
            if instance.blockchain_contract_address:
                self.contracts_by_address[instance.blockchain_contract_address] = instance
            return
        if isinstance(instance, Milestone):
            self.milestones_by_uuid[instance.id] = instance
            contract = self.contracts_by_uuid.get(instance.contract_id)
            if contract is not None:
                milestones = list(contract.milestones or [])
                if instance not in milestones:
                    milestones.append(instance)
                    contract.milestones = milestones

    async def flush(self) -> None:
        self.flush_called = True
        for contract in self.contracts:
            if contract.public_id:
                self.contracts_by_public_id[contract.public_id] = contract
            if contract.blockchain_contract_address:
                self.contracts_by_address[contract.blockchain_contract_address] = contract

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(contracts_router, prefix="/api/v1")
    app.include_router(milestones_router, prefix="/api/v1")
    return app


class AdminOnboardingIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.session = FakeSession()
        self.blockchain_service = FakeBlockchainService()
        self.current_user = CurrentUser(
            id="admin-1",
            email="admin@test.com",
            preferred_username="admin@test.com",
            roles=("admin",),
            contract_ids=(),
        )

        async def override_current_user() -> CurrentUser:
            return self.current_user

        async def override_session() -> Any:
            yield self.session

        async def override_blockchain_service() -> FakeBlockchainService:
            return self.blockchain_service

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session
        from app.core.blockchain import get_blockchain_service

        self.app.dependency_overrides[get_blockchain_service] = override_blockchain_service

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_admin_can_create_contract_from_known_mock_address(self) -> None:
        client = TestClient(self.app)
        response = client.post(
            "/api/v1/admin/contracts",
            json={
                "blockchainContractAddress": "0x1111111111111111111111111111111111111111",
                "pilotType": "FACTOR",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()["data"]
        self.assertEqual(payload["contractId"], "contract-admin-factor-001")
        self.assertEqual(payload["pilotType"], "FACTOR")
        self.assertEqual(payload["milestoneCount"], 2)

    def test_new_contract_appears_for_relevant_consumer_and_milestones_are_seeded(self) -> None:
        client = TestClient(self.app)
        client.post(
            "/api/v1/admin/contracts",
            json={
                "blockchainContractAddress": "0x1111111111111111111111111111111111111111",
                "pilotType": "FACTOR",
            },
        )

        self.current_user = CurrentUser(
            id="consumer-1",
            email="consumer-admin@test.com",
            preferred_username="consumer-admin@test.com",
            roles=("consumer",),
            contract_ids=("contract-admin-factor-001",),
        )

        contracts_response = client.get("/api/v1/contracts")
        milestones_response = client.get("/api/v1/contracts/contract-admin-factor-001/milestones")

        self.assertEqual(contracts_response.status_code, 200)
        self.assertEqual(milestones_response.status_code, 200)
        self.assertEqual(len(contracts_response.json()["data"]), 1)
        self.assertEqual(len(milestones_response.json()["data"]), 2)

    def test_non_admin_user_is_forbidden(self) -> None:
        self.current_user = CurrentUser(
            id="consumer-1",
            email="consumer@test.com",
            preferred_username="consumer@test.com",
            roles=("consumer",),
            contract_ids=(),
        )
        client = TestClient(self.app)
        response = client.post(
            "/api/v1/admin/contracts",
            json={
                "blockchainContractAddress": "0x1111111111111111111111111111111111111111",
                "pilotType": "FACTOR",
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "FORBIDDEN")

    def test_invalid_address_returns_400(self) -> None:
        client = TestClient(self.app)
        response = client.post(
            "/api/v1/admin/contracts",
            json={
                "blockchainContractAddress": "not-an-address",
                "pilotType": "FACTOR",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "INVALID_BLOCKCHAIN_ADDRESS")

    def test_duplicate_address_returns_conflict(self) -> None:
        client = TestClient(self.app)
        body = {
            "blockchainContractAddress": "0x1111111111111111111111111111111111111111",
            "pilotType": "FACTOR",
        }

        first = client.post("/api/v1/admin/contracts", json=body)
        second = client.post("/api/v1/admin/contracts", json=body)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["error"]["code"], "CONTRACT_ALREADY_EXISTS")

    def test_admin_can_list_all_contracts(self) -> None:
        client = TestClient(self.app)
        client.post(
            "/api/v1/admin/contracts",
            json={
                "blockchainContractAddress": "0x1111111111111111111111111111111111111111",
                "pilotType": "FACTOR",
            },
        )
        response = client.get("/api/v1/admin/contracts")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["data"]), 1)

    def test_blockchain_sync_refreshes_contract_status(self) -> None:
        client = TestClient(self.app)
        client.post(
            "/api/v1/admin/contracts",
            json={
                "blockchainContractAddress": "0x1111111111111111111111111111111111111111",
                "pilotType": "FACTOR",
            },
        )
        self.blockchain_service.metadata["0x1111111111111111111111111111111111111111"] = replace(
            self.blockchain_service.metadata["0x1111111111111111111111111111111111111111"],
            contract_status="PAUSED",
        )

        response = client.get(
            "/api/v1/admin/contracts/contract-admin-factor-001/blockchain-sync"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "PAUSED")

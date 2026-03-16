from __future__ import annotations

import unittest
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.documents import router as documents_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.contract import Contract
from app.models.milestone import Milestone


class FakeResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(self, contracts: list[Contract]) -> None:
        self.contracts_by_public_id = {
            contract.public_id or str(contract.config["public_id"]): contract
            for contract in contracts
        }
        self.milestones_by_uuid: dict[uuid.UUID, Milestone] = {}
        for contract in contracts:
            for milestone in contract.milestones or []:
                self.milestones_by_uuid[milestone.id] = milestone

    async def execute(self, statement: Any) -> FakeResult:
        params = statement.compile().params
        if "id_1" in params:
            milestone = self.milestones_by_uuid.get(params["id_1"])
            contract_uuid = params.get("contract_id_1")
            if milestone is None or (
                contract_uuid is not None and milestone.contract_id != contract_uuid
            ):
                return FakeResult(None)
            return FakeResult(milestone)

        contract_id = params.get("public_id_1") or next(
            (value for value in params.values() if isinstance(value, str)),
            None,
        )
        return FakeResult(self.contracts_by_public_id.get(contract_id))


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(documents_router, prefix="/api/v1")
    return app


def build_contract(
    public_id: str,
    *,
    consumer_id: str,
    milestones: list[dict[str, Any]],
) -> Contract:
    today = date.today()
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.consumer_id = consumer_id
    contract.config = {"public_id": public_id}

    milestone_models: list[Milestone] = []
    for item in milestones:
        milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
        milestone.contract = contract
        milestone.milestone_ref = item["ref"]
        milestone.name = item["name"]
        milestone.planned_date = today + timedelta(days=item.get("planned_offset_days", 0))
        milestone.status = item.get("status", "PENDING")
        milestone.evidence = list(item.get("evidence", []))
        milestone_models.append(milestone)
    contract.milestones = milestone_models
    return contract


class DocumentsApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.factor_contract = build_contract(
            "contract-factor-001",
            consumer_id="consumer-factor@test.com",
            milestones=[
                {
                    "ref": "TURNING",
                    "name": "Turning",
                    "evidence": [
                        {
                            "name": "inspection.pdf",
                            "url": "https://example.com/docs/inspection.pdf",
                            "format": "PDF",
                            "uploadedAt": "2026-03-16T10:00:00Z",
                        },
                        {
                            "type": "APPROVAL_NOTE",
                            "notes": "Reviewed.",
                        },
                    ],
                },
                {
                    "ref": "HEAT",
                    "name": "Heat Treatment",
                    "evidence": [],
                },
            ],
        )
        self.e4m_contract = build_contract(
            "contract-e4m-001",
            consumer_id="consumer-factor@test.com",
            milestones=[
                {
                    "ref": "M2",
                    "name": "M2",
                    "evidence": [
                        {
                            "name": "test-results.csv",
                            "url": "https://example.com/docs/test-results.csv",
                            "format": "CSV",
                            "uploadedAt": "2026-03-17T08:30:00Z",
                        }
                    ],
                }
            ],
        )
        self.empty_contract = build_contract(
            "contract-empty-001",
            consumer_id="consumer-factor@test.com",
            milestones=[
                {"ref": "M1", "name": "M1", "evidence": []},
            ],
        )
        self.session = FakeSession(
            [self.factor_contract, self.e4m_contract, self.empty_contract]
        )

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-factor@test.com",
                preferred_username="consumer-factor@test.com",
                roles=("consumer",),
                contract_ids=(
                    "contract-factor-001",
                    "contract-e4m-001",
                    "contract-empty-001",
                ),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_contract_documents_returns_aggregated_document_references(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/documents")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(len(payload), 1)
        document = payload[0]
        self.assertEqual(document["name"], "inspection.pdf")
        self.assertEqual(document["format"], "PDF")
        self.assertEqual(document["milestoneName"], "Turning")
        self.assertEqual(
            document["url"],
            "https://example.com/docs/inspection.pdf",
        )

    def test_contract_documents_can_filter_by_milestone_ref(self) -> None:
        client = TestClient(self.app)
        response = client.get(
            "/api/v1/contracts/contract-e4m-001/documents",
            params={"milestoneId": "M2"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["milestoneName"], "M2")

    def test_contract_documents_returns_empty_array_when_no_documents_exist(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-empty-001/documents")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], [])

    def test_milestone_documents_returns_documents_for_single_milestone(self) -> None:
        client = TestClient(self.app)
        milestone_id = self.factor_contract.milestones[0].id
        response = client.get(
            f"/api/v1/contracts/contract-factor-001/milestones/{milestone_id}/documents"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["milestoneId"], str(milestone_id))

    def test_wrong_contract_access_returns_403(self) -> None:
        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-2",
                email="other@test.com",
                preferred_username="other@test.com",
                roles=("consumer",),
                contract_ids=("contract-other-001",),
            )

        self.app.dependency_overrides[get_current_user] = override_current_user

        client = TestClient(self.app)
        response = client.get("/api/v1/contracts/contract-factor-001/documents")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "FORBIDDEN")

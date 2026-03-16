from __future__ import annotations

import unittest
import uuid
from datetime import date
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.milestones import router as milestones_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.notification import Notification


class FakeScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(self, contract: Contract | None, milestone: Milestone | None) -> None:
        self.contract = contract
        self.milestone = milestone
        self.added: list[Any] = []
        self.commit_called = False

    async def execute(self, statement: Any) -> FakeScalarResult:
        statement_text = str(statement)
        if "FROM contracts" in statement_text:
            return FakeScalarResult(self.contract)
        return FakeScalarResult(self.milestone)

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if self.contract is not None and identifier == self.contract.id:
            return self.contract
        if self.milestone is not None and identifier == self.milestone.id:
            return self.milestone
        return None

    def add(self, instance: Any) -> None:
        self.added.append(instance)

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(milestones_router, prefix="/api/v1")
    return app


def build_contract(public_id: str) -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.consumer_id = "consumer-e4m@test.com"
    contract.provider_id = "provider-e4m@test.com"
    contract.config = {"public_id": public_id}
    return contract


def build_milestone(contract: Contract, *, status: str = "SUBMITTED") -> Milestone:
    milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
    milestone.contract = contract
    milestone.milestone_ref = "M2"
    milestone.status = status
    milestone.evidence = []
    milestone.actual_date = None
    return milestone


class MilestonesApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.contract = build_contract("contract-e4m-001")
        self.milestone = build_milestone(self.contract)
        self.session = FakeSession(self.contract, self.milestone)

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-e4m@test.com",
                preferred_username="consumer-e4m@test.com",
                roles=("consumer",),
                contract_ids=("contract-e4m-001",),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_approve_moves_submitted_milestone_to_completed(self) -> None:
        client = TestClient(self.app)
        response = client.post(
            f"/api/v1/contracts/contract-e4m-001/milestones/{self.milestone.id}/approve",
            json={"notes": "Reviewed and approved."},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["status"], "COMPLETED")
        self.assertEqual(self.milestone.status, "COMPLETED")
        self.assertEqual(self.milestone.actual_date, date.today())
        self.assertTrue(self.session.commit_called)
        self.assertTrue(any(isinstance(item, BlockchainEvent) for item in self.session.added))
        self.assertTrue(any(isinstance(item, Notification) for item in self.session.added))

    def test_approve_rejects_non_submitted_milestone(self) -> None:
        self.milestone.status = "PENDING"

        client = TestClient(self.app)
        response = client.post(
            f"/api/v1/contracts/contract-e4m-001/milestones/{self.milestone.id}/approve",
            json={"notes": "Reviewed and approved."},
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload["error"]["message"], "Milestone not awaiting approval.")

    def test_reject_requires_reason(self) -> None:
        client = TestClient(self.app)
        response = client.post(
            f"/api/v1/contracts/contract-e4m-001/milestones/{self.milestone.id}/reject",
            json={},
        )

        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")

    def test_reject_sets_rejected_status_and_stores_reason(self) -> None:
        client = TestClient(self.app)
        response = client.post(
            f"/api/v1/contracts/contract-e4m-001/milestones/{self.milestone.id}/reject",
            json={"reason": "Missing compliance evidence."},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["status"], "REJECTED")
        self.assertEqual(self.milestone.status, "REJECTED")
        self.assertEqual(
            self.milestone.evidence[0]["reason"],
            "Missing compliance evidence.",
        )
        self.assertIsInstance(self.session.added[0], Notification)
        self.assertEqual(self.session.added[0].event_type, "MILESTONE_REJECTED")

    def test_non_owner_consumer_is_forbidden(self) -> None:
        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-2",
                email="other-consumer@test.com",
                preferred_username="other-consumer@test.com",
                roles=("consumer",),
                contract_ids=("contract-e4m-001",),
            )

        self.app.dependency_overrides[get_current_user] = override_current_user

        client = TestClient(self.app)
        response = client.post(
            f"/api/v1/contracts/contract-e4m-001/milestones/{self.milestone.id}/approve",
            json={"notes": "Reviewed and approved."},
        )

        self.assertEqual(response.status_code, 403)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "FORBIDDEN")

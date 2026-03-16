from __future__ import annotations

import unittest
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api.v1.ingest import router as ingest_router
from app.api.v1.websocket import get_websocket_current_user, router as websocket_router
from app.core.auth import CurrentUser, get_current_user
from app.core.connection_manager import connection_manager
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.contract import Contract
from app.models.milestone import Milestone


class FakeScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(
        self,
        contract: Contract | None,
        *,
        execute_results: list[Any] | None = None,
    ) -> None:
        self.contract = contract
        self.execute_results = list(execute_results or [])
        self.added: list[Any] = []
        self.commit_called = False
        self.flush_called = False
        self.loaded_milestones: dict[Any, Milestone] = {}

    async def execute(self, statement: Any) -> FakeScalarResult:
        if self.execute_results:
            value = self.execute_results.pop(0)
            if isinstance(value, Milestone):
                self.loaded_milestones[value.id] = value
            return FakeScalarResult(value)
        return FakeScalarResult(self.contract)

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if identifier in self.loaded_milestones:
            return self.loaded_milestones[identifier]
        if self.contract is not None and identifier == self.contract.id:
            return self.contract
        return None

    def add(self, instance: Any) -> None:
        self.added.append(instance)

    async def flush(self) -> None:
        self.flush_called = True

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(ingest_router, prefix="/api/v1")
    app.include_router(websocket_router)
    return app


def build_contract(public_id: str, pilot_type: str = "FACTOR") -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.consumer_id = "consumer-factor@test.com"
    contract.provider_id = "provider-factor@test.com"
    contract.config = {"public_id": public_id, "last_known_state": {}}
    return contract


class WebsocketApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.session = FakeSession(build_contract("contract-factor-001"))
        self.valid_body = {
            "updateType": "PRODUCTION_UPDATE",
            "timestamp": datetime.now(UTC).isoformat(),
            "sensorId": "sensor-factor-01",
            "payload": {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 0.991,
            },
            "evidence": ["https://example.com/evidence/turning-report"],
        }

        async def override_provider_user() -> CurrentUser:
            return CurrentUser(
                id="provider-1",
                email="provider-factor@test.com",
                preferred_username="provider-factor@test.com",
                roles=("provider",),
                contract_ids=("contract-factor-001",),
            )

        async def override_socket_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-factor@test.com",
                preferred_username="consumer-factor@test.com",
                roles=("consumer",),
                contract_ids=("contract-factor-001",),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_provider_user
        self.app.dependency_overrides[get_websocket_current_user] = override_socket_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()
        import asyncio

        asyncio.run(connection_manager.clear())

    def test_websocket_receives_ingest_update_message(self) -> None:
        client = TestClient(self.app)
        with client.websocket_connect("/ws/contracts/contract-factor-001?token=test-token") as websocket:
            response = client.post("/api/v1/ingest/contract-factor-001", json=self.valid_body)
            self.assertEqual(response.status_code, 200)
            messages = [websocket.receive_json() for _ in range(3)]
            message_types = {message["type"] for message in messages}
            self.assertIn("UPDATE_RECEIVED", message_types)
            self.assertIn("CONTRACT_STATE_CHANGED", message_types)
            self.assertIn("NOTIFICATION", message_types)
            update_message = next(message for message in messages if message["type"] == "UPDATE_RECEIVED")
            self.assertEqual(update_message["data"]["contractId"], "contract-factor-001")
            self.assertIn("timestamp", update_message)
            websocket.close()

    def test_multiple_clients_receive_update_and_remaining_client_survives_disconnect(self) -> None:
        import asyncio

        class FakeWebSocket:
            async def accept(self) -> None:
                return None

        first = FakeWebSocket()
        second = FakeWebSocket()

        asyncio.run(connection_manager.connect("contract-factor-001", first))
        asyncio.run(connection_manager.connect("contract-factor-001", second))
        self.assertEqual(asyncio.run(connection_manager.count("contract-factor-001")), 2)

        asyncio.run(connection_manager.disconnect("contract-factor-001", second))
        self.assertEqual(asyncio.run(connection_manager.count("contract-factor-001")), 1)

    def test_missing_contract_sends_contract_not_found_then_closes(self) -> None:
        self.session.contract = None
        client = TestClient(self.app)
        with client.websocket_connect("/ws/contracts/contract-missing-001?token=test-token") as websocket:
            message = websocket.receive_json()
            self.assertEqual(message["type"], "CONTRACT_NOT_FOUND")
            with self.assertRaises(WebSocketDisconnect):
                websocket.receive_json()

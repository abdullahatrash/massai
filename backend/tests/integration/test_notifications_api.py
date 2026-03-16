from __future__ import annotations

import unittest
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.notifications import router as notifications_router
from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.exception_handlers import register_exception_handlers
from app.models.notification import Notification


class FakeScalarCollection:
    def __init__(self, values: list[Any]) -> None:
        self._values = values

    def all(self) -> list[Any]:
        return list(self._values)


class FakeResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalars(self) -> FakeScalarCollection:
        if isinstance(self._value, list):
            return FakeScalarCollection(self._value)
        if self._value is None:
            return FakeScalarCollection([])
        return FakeScalarCollection([self._value])


class FakeSession:
    def __init__(self, notifications: list[Notification]) -> None:
        self.notifications = notifications
        self.notifications_by_uuid = {item.id: item for item in notifications}
        self.commit_called = False

    async def execute(self, statement: Any) -> FakeResult:
        statement_text = str(statement)
        params = statement.compile().params
        identities: set[str] = set()
        page_size = None
        offset = 0
        for value in params.values():
            if isinstance(value, str):
                identities.add(value)
            elif isinstance(value, (list, tuple)):
                identities.update(str(item) for item in value)
            elif isinstance(value, int):
                if page_size is None:
                    page_size = value
                else:
                    offset = value
        unread_only = "notifications.read_at IS NULL" in statement_text
        notifications = [
            item
            for item in self.notifications
            if item.recipient_id in identities and (not unread_only or item.read_at is None)
        ]
        notifications.sort(
            key=lambda item: item.created_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        if page_size is not None:
            notifications = notifications[offset : offset + page_size]
        return FakeResult(notifications)

    async def get(self, model: type[Any], identifier: Any) -> Any:
        return self.notifications_by_uuid.get(identifier)

    async def commit(self) -> None:
        self.commit_called = True


def build_test_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(notifications_router, prefix="/api/v1")
    return app


def build_notification(*, recipient_id: str, message: str, read_at: datetime | None = None) -> Notification:
    notification = Notification(id=uuid.uuid4(), contract_id=uuid.uuid4())
    notification.recipient_id = recipient_id
    notification.event_type = "ALERT_TRIGGERED"
    notification.message = message
    notification.payload = {"contractId": "contract-factor-001"}
    notification.created_at = datetime(2026, 3, 16, 12, 0, tzinfo=UTC)
    notification.read_at = read_at
    return notification


class NotificationsApiIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = build_test_app()
        self.notifications = [
            build_notification(recipient_id="consumer-factor@test.com", message="Newest"),
            build_notification(
                recipient_id="consumer-factor@test.com",
                message="Already read",
                read_at=datetime(2026, 3, 16, 13, 0, tzinfo=UTC),
            ),
            build_notification(recipient_id="other@test.com", message="Other user"),
        ]
        self.session = FakeSession(self.notifications)

        async def override_current_user() -> CurrentUser:
            return CurrentUser(
                id="consumer-1",
                email="consumer-factor@test.com",
                preferred_username="consumer-factor@test.com",
                roles=("consumer",),
                contract_ids=("contract-factor-001",),
            )

        async def override_session() -> Any:
            yield self.session

        self.app.dependency_overrides[get_current_user] = override_current_user
        self.app.dependency_overrides[get_db_session] = override_session

    def tearDown(self) -> None:
        self.app.dependency_overrides.clear()

    def test_list_notifications_returns_history_and_meta_for_current_user(self) -> None:
        client = TestClient(self.app)
        response = client.get("/api/v1/notifications")

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        meta = response.json()["meta"]
        self.assertEqual(len(payload), 2)
        self.assertEqual(payload[0]["message"], "Newest")
        self.assertEqual(meta["unreadNotifications"], 1)
        self.assertFalse(meta["pagination"]["hasMore"])

    def test_mark_notification_read_hides_it_from_unread_list(self) -> None:
        target = self.notifications[0]
        client = TestClient(self.app)
        response = client.post(f"/api/v1/notifications/{target.id}/read")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.session.commit_called)
        self.assertIsNotNone(target.read_at)

        list_response = client.get("/api/v1/notifications?unreadOnly=true")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["data"], [])

    def test_mark_all_notifications_as_read_clears_unread_count(self) -> None:
        client = TestClient(self.app)
        response = client.post("/api/v1/notifications/read-all")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.session.commit_called)
        self.assertEqual(response.json()["data"]["markedCount"], 1)

        list_response = client.get("/api/v1/notifications?unreadOnly=true")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["meta"]["unreadNotifications"], 0)

from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import patch

from app.core.auth import CurrentUser
from app.models.notification import Notification
from app.services.notification import NotificationService


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


class FakeNotificationSession:
    def __init__(self, notifications: list[Notification] | None = None) -> None:
        self.notifications = list(notifications or [])
        self.notifications_by_uuid = {item.id: item for item in self.notifications}
        self.added: list[Any] = []

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

    def add(self, instance: Any) -> None:
        self.added.append(instance)
        if isinstance(instance, Notification):
            self.notifications.append(instance)
            self.notifications_by_uuid[instance.id] = instance


def build_notification(*, recipient_id: str, read_at: datetime | None = None) -> Notification:
    notification = Notification(id=uuid.uuid4(), contract_id=uuid.uuid4())
    notification.recipient_id = recipient_id
    notification.event_type = "ALERT_TRIGGERED"
    notification.message = "Important alert"
    notification.payload = {"contractId": "contract-factor-001"}
    notification.created_at = datetime(2026, 3, 16, 12, 0, tzinfo=UTC)
    notification.read_at = read_at
    return notification


class NotificationServiceTestCase(unittest.TestCase):
    def _run(self, coroutine: Any) -> Any:
        return asyncio.run(coroutine)

    def test_send_writes_notification_without_smtp(self) -> None:
        session = FakeNotificationSession()
        with patch("app.services.notification.NotificationService._send_email_if_configured") as send_email:
            notification = NotificationService.send(
                session,
                recipient_id="consumer@test.com",
                event_type="ALERT_TRIGGERED",
                message="Alert triggered",
                contract_id=uuid.uuid4(),
            )

        self.assertIsNotNone(notification)
        self.assertEqual(notification.message, "Alert triggered")
        self.assertEqual(len(session.added), 1)
        send_email.assert_called_once()

    def test_list_unread_for_user_filters_by_identity_and_read_state(self) -> None:
        session = FakeNotificationSession(
            [
                build_notification(recipient_id="consumer@test.com"),
                build_notification(recipient_id="consumer@test.com", read_at=datetime.now(UTC)),
                build_notification(recipient_id="other@test.com"),
            ]
        )
        current_user = CurrentUser(
            id="consumer-1",
            email="consumer@test.com",
            preferred_username="consumer@test.com",
            roles=("consumer",),
            contract_ids=(),
        )

        notifications = self._run(NotificationService.list_unread_for_user(session, current_user))

        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].recipient_id, "consumer@test.com")

    def test_mark_as_read_sets_timestamp_for_matching_user(self) -> None:
        notification = build_notification(recipient_id="consumer@test.com")
        session = FakeNotificationSession([notification])
        current_user = CurrentUser(
            id="consumer-1",
            email="consumer@test.com",
            preferred_username="consumer@test.com",
            roles=("consumer",),
            contract_ids=(),
        )

        updated = self._run(
            NotificationService.mark_as_read(
                session,
                str(notification.id),
                current_user,
                now=datetime(2026, 3, 16, 14, 0, tzinfo=UTC),
            )
        )

        self.assertEqual(updated.read_at, datetime(2026, 3, 16, 14, 0, tzinfo=UTC))

    def test_list_for_user_includes_read_history_when_requested(self) -> None:
        session = FakeNotificationSession(
            [
                build_notification(recipient_id="consumer@test.com"),
                build_notification(
                    recipient_id="consumer@test.com",
                    read_at=datetime(2026, 3, 16, 13, 0, tzinfo=UTC),
                ),
            ]
        )
        current_user = CurrentUser(
            id="consumer-1",
            email="consumer@test.com",
            preferred_username="consumer@test.com",
            roles=("consumer",),
            contract_ids=(),
        )

        notifications, has_more = self._run(
            NotificationService.list_for_user(session, current_user, page=1, page_size=10)
        )

        self.assertEqual(len(notifications), 2)
        self.assertFalse(has_more)

    def test_mark_all_as_read_updates_every_unread_notification(self) -> None:
        unread = build_notification(recipient_id="consumer@test.com")
        already_read = build_notification(
            recipient_id="consumer@test.com",
            read_at=datetime(2026, 3, 16, 13, 0, tzinfo=UTC),
        )
        session = FakeNotificationSession([unread, already_read])
        current_user = CurrentUser(
            id="consumer-1",
            email="consumer@test.com",
            preferred_username="consumer@test.com",
            roles=("consumer",),
            contract_ids=(),
        )

        updated = self._run(
            NotificationService.mark_all_as_read(
                session,
                current_user,
                now=datetime(2026, 3, 16, 14, 0, tzinfo=UTC),
            )
        )

        self.assertEqual(len(updated), 1)
        self.assertEqual(unread.read_at, datetime(2026, 3, 16, 14, 0, tzinfo=UTC))
        self.assertEqual(already_read.read_at, datetime(2026, 3, 16, 13, 0, tzinfo=UTC))

from __future__ import annotations

import logging
import smtplib
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.config import get_settings
from app.core.contracts import contract_public_id
from app.core.response import ApiException
from app.models.contract import Contract
from app.models.notification import Notification

logger = logging.getLogger("massai.api")


class NotificationService:
    @staticmethod
    def send(
        session: AsyncSession,
        *,
        recipient_id: str | None,
        event_type: str,
        message: str,
        contract_id: uuid.UUID | None,
        milestone_id: uuid.UUID | None = None,
        payload: dict[str, Any] | None = None,
        now: datetime | None = None,
    ) -> Notification | None:
        if not recipient_id:
            return None

        notification = Notification(
            id=uuid.uuid4(),
            recipient_id=recipient_id,
            contract_id=contract_id,
            milestone_id=milestone_id,
            event_type=event_type,
            message=message,
            payload=payload or {},
            created_at=now or datetime.now(UTC),
        )
        session.add(notification)
        NotificationService._send_email_if_configured(recipient_id, event_type, message)
        return notification

    @staticmethod
    def send_many(
        session: AsyncSession,
        *,
        recipient_ids: Iterable[str | None],
        event_type: str,
        message: str,
        contract_id: uuid.UUID | None,
        milestone_id: uuid.UUID | None = None,
        payload: dict[str, Any] | None = None,
        now: datetime | None = None,
    ) -> list[Notification]:
        notifications: list[Notification] = []
        seen: set[str] = set()
        for recipient_id in recipient_ids:
            if not recipient_id or recipient_id in seen:
                continue
            seen.add(recipient_id)
            notification = NotificationService.send(
                session,
                recipient_id=recipient_id,
                event_type=event_type,
                message=message,
                contract_id=contract_id,
                milestone_id=milestone_id,
                payload=payload,
                now=now,
            )
            if notification is not None:
                notifications.append(notification)
        return notifications

    @staticmethod
    async def list_unread_for_user(
        session: AsyncSession,
        current_user: CurrentUser,
    ) -> list[Notification]:
        result = await session.execute(
            select(Notification)
            .where(
                Notification.recipient_id.in_(list(NotificationService._recipient_identities(current_user))),
                Notification.read_at.is_(None),
            )
            .order_by(Notification.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        current_user: CurrentUser,
        *,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
    ) -> tuple[list[Notification], bool]:
        statement = select(Notification).where(
            Notification.recipient_id.in_(
                list(NotificationService._recipient_identities(current_user))
            )
        )
        if unread_only:
            statement = statement.where(Notification.read_at.is_(None))

        statement = (
            statement.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size + 1)
        )
        result = await session.execute(statement)
        notifications = list(result.scalars().all())
        has_more = len(notifications) > page_size
        return notifications[:page_size], has_more

    @staticmethod
    async def unread_count_for_user(
        session: AsyncSession,
        current_user: CurrentUser,
    ) -> int:
        notifications = await NotificationService.list_unread_for_user(session, current_user)
        return len(notifications)

    @staticmethod
    async def mark_as_read(
        session: AsyncSession,
        notification_id: str,
        current_user: CurrentUser,
        *,
        now: datetime | None = None,
    ) -> Notification:
        try:
            notification_uuid = uuid.UUID(notification_id)
        except ValueError as exc:
            raise ApiException(
                status_code=404,
                code="NOTIFICATION_NOT_FOUND",
                message="Notification not found.",
            ) from exc

        notification = await session.get(Notification, notification_uuid)
        if notification is None or notification.recipient_id not in NotificationService._recipient_identities(current_user):
            raise ApiException(
                status_code=404,
                code="NOTIFICATION_NOT_FOUND",
                message="Notification not found.",
            )
        if notification.read_at is None:
            notification.read_at = now or datetime.now(UTC)
        return notification

    @staticmethod
    async def mark_all_as_read(
        session: AsyncSession,
        current_user: CurrentUser,
        *,
        now: datetime | None = None,
    ) -> list[Notification]:
        read_at = now or datetime.now(UTC)
        notifications = await NotificationService.list_unread_for_user(session, current_user)
        for notification in notifications:
            notification.read_at = read_at
        return notifications

    @staticmethod
    def serialize(notification: Notification) -> dict[str, object]:
        from app.schemas.notification import NotificationResponse

        payload_data = dict(notification.payload or {})
        payload = NotificationResponse(
            id=str(notification.id),
            eventType=notification.event_type,
            message=NotificationService._message(notification),
            contractId=(
                str(payload_data.get("contractId"))
                if payload_data.get("contractId") is not None
                else (str(notification.contract_id) if notification.contract_id is not None else None)
            ),
            milestoneId=(
                str(payload_data.get("milestoneId"))
                if payload_data.get("milestoneId") is not None
                else (str(notification.milestone_id) if notification.milestone_id is not None else None)
            ),
            createdAt=notification.created_at,
            readAt=notification.read_at,
            payload=payload_data,
        )
        return payload.model_dump(by_alias=True, mode="json")

    @staticmethod
    def milestone_awaiting_approval_message(contract: Contract, milestone_ref: str | None) -> str:
        return (
            f"Milestone {milestone_ref or 'unknown'} is awaiting approval "
            f"for contract {contract_public_id(contract)}."
        )

    @staticmethod
    def milestone_approved_message(contract: Contract, milestone_ref: str | None) -> str:
        return (
            f"Milestone {milestone_ref or 'unknown'} was approved "
            f"for contract {contract_public_id(contract)}."
        )

    @staticmethod
    def milestone_rejected_message(
        contract: Contract,
        milestone_ref: str | None,
        reason: str,
    ) -> str:
        return (
            f"Milestone {milestone_ref or 'unknown'} was rejected "
            f"for contract {contract_public_id(contract)}: {reason}"
        )

    @staticmethod
    def alert_message(contract: Contract, description: str) -> str:
        return f"Alert triggered for contract {contract_public_id(contract)}: {description}"

    @staticmethod
    def contract_state_changed_message(contract: Contract, update_type: str) -> str:
        return (
            f"Contract state changed for {contract_public_id(contract)} "
            f"via {update_type}."
        )

    @staticmethod
    def _recipient_identities(current_user: CurrentUser) -> tuple[str, ...]:
        identities = [
            current_user.id,
            current_user.email,
            current_user.preferred_username,
        ]
        return tuple(item for item in identities if item)

    @staticmethod
    def _message(notification: Notification) -> str:
        if notification.message:
            return notification.message
        payload = dict(notification.payload or {})
        event_type = (notification.event_type or "").upper()
        if event_type == "MILESTONE_AWAITING_APPROVAL":
            return f"Milestone {payload.get('milestoneRef', 'unknown')} is awaiting approval."
        if event_type == "MILESTONE_REJECTED":
            reason = payload.get("reason", "No reason provided.")
            return f"Milestone {payload.get('milestoneRef', 'unknown')} was rejected: {reason}"
        if event_type == "MILESTONE_APPROVED":
            return f"Milestone {payload.get('milestoneRef', 'unknown')} was approved."
        return f"{event_type.title()} notification".strip()

    @staticmethod
    def _send_email_if_configured(recipient_id: str, event_type: str, message: str) -> None:
        settings = get_settings()
        if not settings.smtp_host:
            return

        email = EmailMessage()
        email["Subject"] = f"MaaSAI notification: {event_type}"
        email["From"] = settings.smtp_from_email or "no-reply@massai.local"
        email["To"] = recipient_id
        email.set_content(message)

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=5) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password or "")
                smtp.send_message(email)
        except Exception:
            logger.exception(
                "notification_email_failed",
                extra={"recipient_id": recipient_id, "event_type": event_type},
            )

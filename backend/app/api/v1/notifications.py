from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.response import success
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
    unread_only: Annotated[bool, Query(alias="unreadOnly")] = False,
) -> dict[str, object]:
    notifications, has_more = await NotificationService.list_for_user(
        session,
        current_user,
        page=page,
        page_size=page_size,
        unread_only=unread_only,
    )
    unread_count = await NotificationService.unread_count_for_user(session, current_user)
    return success(
        [NotificationService.serialize(item) for item in notifications],
        meta={
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "hasMore": has_more,
            },
            "unreadNotifications": unread_count,
        },
    )


@router.post("/read-all")
async def mark_all_notifications_as_read(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    notifications = await NotificationService.mark_all_as_read(session, current_user)
    await session.commit()
    return success({"markedCount": len(notifications)})


@router.post("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, object]:
    notification = await NotificationService.mark_as_read(
        session,
        notification_id,
        current_user,
    )
    await session.commit()
    return success(NotificationService.serialize(notification))

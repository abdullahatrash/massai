from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class Milestone(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "milestones"

    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id"),
    )
    milestone_ref: Mapped[str | None] = mapped_column(String)
    name: Mapped[str | None] = mapped_column(String)
    planned_date: Mapped[date | None] = mapped_column(Date)
    actual_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(
        String,
        server_default=text("'PENDING'"),
    )
    approval_required: Mapped[bool | None] = mapped_column(
        Boolean,
        server_default=text("false"),
    )
    completion_criteria: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    evidence: Mapped[list[Any] | None] = mapped_column(
        JSONB,
        server_default=text("'[]'::jsonb"),
    )

    contract: Mapped["Contract"] = relationship(back_populates="milestones")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="milestone")

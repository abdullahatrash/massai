from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class Alert(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "alerts"

    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id"),
    )
    rule_id: Mapped[str | None] = mapped_column(String)
    condition_description: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str | None] = mapped_column(String)
    triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    blockchain_logged: Mapped[bool | None] = mapped_column(
        Boolean,
        server_default=text("false"),
    )

    contract: Mapped["Contract"] = relationship(back_populates="alerts")

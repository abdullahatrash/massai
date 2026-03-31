from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class StatusUpdate(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "status_updates"

    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id"),
    )
    update_type: Mapped[str | None] = mapped_column(String)
    sensor_id: Mapped[str | None] = mapped_column(String)
    source_id: Mapped[str | None] = mapped_column(String)
    ingest_schema_version: Mapped[str | None] = mapped_column(String)
    ingest_profile_version: Mapped[int | None] = mapped_column(Integer)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    evidence: Mapped[list[Any] | None] = mapped_column(
        JSONB,
        server_default=text("'[]'::jsonb"),
    )
    processed: Mapped[bool | None] = mapped_column(
        Boolean,
        server_default=text("false"),
    )

    contract: Mapped["Contract"] = relationship(back_populates="status_updates")

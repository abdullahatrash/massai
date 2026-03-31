from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class IngestProfile(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ingest_profiles"
    __table_args__ = (
        UniqueConstraint("profile_key", "version"),
    )

    profile_key: Mapped[str] = mapped_column(String, nullable=False)
    factory_key: Mapped[str] = mapped_column(String, nullable=False)
    pilot_type: Mapped[str | None] = mapped_column(String)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'ACTIVE'"))
    supported_update_types: Mapped[list[str] | None] = mapped_column(JSONB)
    profile_definition: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    resolved_spec: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )

    contracts: Mapped[list["Contract"]] = relationship(back_populates="ingest_profile")

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class BlockchainEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "blockchain_events"

    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id"),
    )
    event_type: Mapped[str | None] = mapped_column(String)
    transaction_hash: Mapped[str | None] = mapped_column(String)
    block_number: Mapped[int | None] = mapped_column(BigInteger)
    event_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )

    contract: Mapped["Contract"] = relationship(back_populates="blockchain_events")

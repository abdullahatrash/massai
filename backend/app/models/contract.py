from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class Contract(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "contracts"

    public_id: Mapped[str | None] = mapped_column(String, index=True, unique=True)
    blockchain_contract_address: Mapped[str | None] = mapped_column(String)
    pilot_type: Mapped[str | None] = mapped_column(String)
    agreement_type: Mapped[str | None] = mapped_column(String)
    status: Mapped[str | None] = mapped_column(String)
    provider_id: Mapped[str | None] = mapped_column(String)
    consumer_id: Mapped[str | None] = mapped_column(String)
    product_name: Mapped[str | None] = mapped_column(String)
    quantity_total: Mapped[int | None] = mapped_column(Integer)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    milestones: Mapped[list["Milestone"]] = relationship(back_populates="contract")
    status_updates: Mapped[list["StatusUpdate"]] = relationship(back_populates="contract")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="contract")
    blockchain_events: Mapped[list["BlockchainEvent"]] = relationship(
        back_populates="contract"
    )
    notifications: Mapped[list["Notification"]] = relationship(back_populates="contract")

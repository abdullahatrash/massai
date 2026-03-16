"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-03-16 11:40:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("blockchain_contract_address", sa.String(), nullable=True),
        sa.Column("pilot_type", sa.String(), nullable=True),
        sa.Column("agreement_type", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("provider_id", sa.String(), nullable=True),
        sa.Column("consumer_id", sa.String(), nullable=True),
        sa.Column("product_name", sa.String(), nullable=True),
        sa.Column("quantity_total", sa.Integer(), nullable=True),
        sa.Column("delivery_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contracts")),
    )
    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "contract_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("milestone_ref", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("planned_date", sa.Date(), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(),
            server_default=sa.text("'PENDING'"),
            nullable=True,
        ),
        sa.Column(
            "approval_required",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
        ),
        sa.Column(
            "completion_criteria",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=op.f("fk_milestones_contract_id_contracts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_milestones")),
    )
    op.create_table(
        "status_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "contract_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("update_type", sa.String(), nullable=True),
        sa.Column("sensor_id", sa.String(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "processed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=op.f("fk_status_updates_contract_id_contracts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_status_updates")),
    )
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "contract_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("rule_id", sa.String(), nullable=True),
        sa.Column("condition_description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(), nullable=True),
        sa.Column(
            "triggered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "blockchain_logged",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=op.f("fk_alerts_contract_id_contracts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alerts")),
    )
    op.create_table(
        "blockchain_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "contract_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.Column("transaction_hash", sa.String(), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=True),
        sa.Column("event_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=op.f("fk_blockchain_events_contract_id_contracts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_blockchain_events")),
    )


def downgrade() -> None:
    op.drop_table("blockchain_events")
    op.drop_table("alerts")
    op.drop_table("status_updates")
    op.drop_table("milestones")
    op.drop_table("contracts")

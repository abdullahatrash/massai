"""add contract public id and notifications

Revision ID: 0003_add_contract_public_id_and_notifications
Revises: 0002_add_evidence_to_status_updates
Create Date: 2026-03-16 19:45:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0003_add_contract_public_id_and_notifications"
down_revision = "0002_add_evidence_to_status_updates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column("public_id", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE contracts
        SET public_id = config->>'public_id'
        WHERE public_id IS NULL
        """
    )
    op.alter_column("contracts", "public_id", nullable=False)
    op.create_index("ix_contracts_public_id", "contracts", ["public_id"], unique=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("contract_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("milestone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recipient_id", sa.String(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=op.f("fk_notifications_contract_id_contracts"),
        ),
        sa.ForeignKeyConstraint(
            ["milestone_id"],
            ["milestones.id"],
            name=op.f("fk_notifications_milestone_id_milestones"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_index("ix_contracts_public_id", table_name="contracts")
    op.drop_column("contracts", "public_id")

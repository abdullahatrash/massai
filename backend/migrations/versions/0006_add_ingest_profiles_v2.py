"""add ingest profiles v2

Revision ID: 0006_add_ingest_profiles_v2
Revises: 0005_add_notification_message
Create Date: 2026-03-30 18:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0006_add_ingest_profiles_v2"
down_revision = "0005_add_notification_message"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingest_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("profile_key", sa.String(), nullable=False),
        sa.Column("factory_key", sa.String(), nullable=False),
        sa.Column("pilot_type", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("supported_update_types", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("profile_definition", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("resolved_spec", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.UniqueConstraint("profile_key", "version"),
    )
    op.add_column("contracts", sa.Column("ingest_profile_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("contracts", sa.Column("ingest_profile_key", sa.String(), nullable=True))
    op.add_column("contracts", sa.Column("ingest_profile_version", sa.Integer(), nullable=True))
    op.add_column("contracts", sa.Column("ingest_profile_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_foreign_key(
        op.f("fk_contracts_ingest_profile_id_ingest_profiles"),
        "contracts",
        "ingest_profiles",
        ["ingest_profile_id"],
        ["id"],
    )

    op.add_column("status_updates", sa.Column("source_id", sa.String(), nullable=True))
    op.add_column("status_updates", sa.Column("ingest_schema_version", sa.String(), nullable=True))
    op.add_column("status_updates", sa.Column("ingest_profile_version", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("status_updates", "ingest_profile_version")
    op.drop_column("status_updates", "ingest_schema_version")
    op.drop_column("status_updates", "source_id")
    op.drop_constraint(op.f("fk_contracts_ingest_profile_id_ingest_profiles"), "contracts", type_="foreignkey")
    op.drop_column("contracts", "ingest_profile_snapshot")
    op.drop_column("contracts", "ingest_profile_version")
    op.drop_column("contracts", "ingest_profile_key")
    op.drop_column("contracts", "ingest_profile_id")
    op.drop_table("ingest_profiles")

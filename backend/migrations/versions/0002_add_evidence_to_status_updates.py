"""add evidence to status updates

Revision ID: 0002_add_evidence_to_status_updates
Revises: 0001_initial_schema
Create Date: 2026-03-16 17:15:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0002_add_evidence_to_status_updates"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "status_updates",
        sa.Column(
            "evidence",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("status_updates", "evidence")

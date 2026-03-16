"""add notification message

Revision ID: 0005_add_notification_message
Revises: 0004_add_blockchain_address_unique_index
Create Date: 2026-03-16 23:30:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0005_add_notification_message"
down_revision = "0004_add_blockchain_address_unique_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "message")

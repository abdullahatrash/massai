"""add unique index on contracts.blockchain_contract_address

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_add_blockchain_address_unique_index"
down_revision = "0003_add_contract_public_id_and_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_contracts_blockchain_contract_address",
        "contracts",
        ["blockchain_contract_address"],
        unique=True,
        postgresql_where=sa.text("blockchain_contract_address IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_contracts_blockchain_contract_address",
        table_name="contracts",
    )

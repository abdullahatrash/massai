from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path

from app.core.blockchain import (
    BlockchainContractMetadata,
    BlockchainMilestoneMetadata,
    BlockchainWriteResult,
)
from app.core.response import ApiException
from app.core.contracts import contract_public_id
from app.core.formatting import describe_alert


class MockBlockchainService:
    def __init__(self) -> None:
        self._events_db_path = Path(__file__).resolve().parents[3] / "mock_msb" / "events.db"
        self._fixtures = {
            "0x1111111111111111111111111111111111111111": BlockchainContractMetadata(
                agreement_id="contract-admin-factor-001",
                blockchain_contract_address="0x1111111111111111111111111111111111111111",
                pilot_type="FACTOR",
                provider_id="provider-factor-admin@test.com",
                consumer_id="consumer-factor-admin@test.com",
                product_name="Helical Gear Type A - Batch 500",
                quantity_total=500,
                delivery_date=date(2026, 6, 1),
                contract_status="ACTIVE",
                agreement_type="PRODUCTION_MONITORING",
                milestones=(
                    BlockchainMilestoneMetadata(
                        milestone_ref="TURNING",
                        name="Turning",
                        planned_date=date(2026, 4, 10),
                    ),
                    BlockchainMilestoneMetadata(
                        milestone_ref="INSPECTION",
                        name="Inspection",
                        planned_date=date(2026, 5, 8),
                        approval_required=True,
                    ),
                ),
                alert_conditions=(
                    {"type": "QUALITY_THRESHOLD", "threshold": 0.95},
                ),
            ),
            "0x2222222222222222222222222222222222222222": BlockchainContractMetadata(
                agreement_id="contract-admin-tasowheel-001",
                blockchain_contract_address="0x2222222222222222222222222222222222222222",
                pilot_type="TASOWHEEL",
                provider_id="provider-tasowheel-admin@test.com",
                consumer_id="consumer-tasowheel-admin@test.com",
                product_name="Wheel Hub V3 Batch",
                quantity_total=240,
                delivery_date=date(2026, 7, 12),
                contract_status="ACTIVE",
                agreement_type="ROUTING_EXECUTION",
                milestones=(
                    BlockchainMilestoneMetadata(
                        milestone_ref="STEP_10",
                        name="Blank Preparation",
                        planned_date=date(2026, 4, 14),
                    ),
                    BlockchainMilestoneMetadata(
                        milestone_ref="STEP_40",
                        name="Final Dispatch Check",
                        planned_date=date(2026, 5, 20),
                        approval_required=True,
                    ),
                ),
            ),
            "0x3333333333333333333333333333333333333333": BlockchainContractMetadata(
                agreement_id="contract-admin-e4m-001",
                blockchain_contract_address="0x3333333333333333333333333333333333333333",
                pilot_type="E4M",
                provider_id="provider-e4m-admin@test.com",
                consumer_id="consumer-e4m-admin@test.com",
                product_name="Modular Demonstrator Release 2",
                quantity_total=4,
                delivery_date=date(2026, 8, 30),
                contract_status="ACTIVE",
                agreement_type="PHASE_GATED_DELIVERY",
                milestones=(
                    BlockchainMilestoneMetadata(
                        milestone_ref="M1",
                        name="M1",
                        planned_date=date(2026, 4, 21),
                    ),
                    BlockchainMilestoneMetadata(
                        milestone_ref="M2",
                        name="M2",
                        planned_date=date(2026, 5, 19),
                        approval_required=True,
                    ),
                ),
            ),
        }

    async def get_contract_metadata(self, address: str) -> BlockchainContractMetadata:
        metadata = self._fixtures.get(address)
        if metadata is None:
            raise ApiException(
                status_code=404,
                code="BLOCKCHAIN_CONTRACT_NOT_FOUND",
                message="No contract metadata found for this blockchain address.",
            )
        return metadata

    async def log_alert_event(self, contract, alert) -> BlockchainWriteResult:
        self._events_db_path.parent.mkdir(parents=True, exist_ok=True)
        tx_hash = f"0xmock{str(alert.id).replace('-', '')[:8]}"
        with sqlite3.connect(self._events_db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS alert_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contract_id TEXT NOT NULL,
                    contract_public_id TEXT NOT NULL,
                    alert_id TEXT NOT NULL UNIQUE,
                    severity TEXT NOT NULL,
                    description TEXT NOT NULL,
                    transaction_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            existing = connection.execute(
                """
                SELECT transaction_hash, id
                FROM alert_events
                WHERE alert_id = ?
                """,
                (str(alert.id),),
            ).fetchone()
            if existing is not None:
                return BlockchainWriteResult(
                    transaction_hash=str(existing[0]),
                    block_number=int(existing[1]),
                )

            cursor = connection.execute(
                """
                INSERT INTO alert_events (
                    contract_id,
                    contract_public_id,
                    alert_id,
                    severity,
                    description,
                    transaction_hash,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(contract.id),
                    contract_public_id(contract),
                    str(alert.id),
                    alert.severity or "",
                    describe_alert(alert),
                    tx_hash,
                    alert.triggered_at.isoformat() if alert.triggered_at is not None else "",
                ),
            )
            connection.commit()
            return BlockchainWriteResult(
                transaction_hash=tx_hash,
                block_number=int(cursor.lastrowid),
            )

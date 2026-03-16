from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, TypedDict

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.contract import Contract
from app.models.milestone import Milestone

DATA_DIR = Path(__file__).resolve().parent / "data"
SEED_NAMESPACE = uuid.UUID("2c72f8dc-f2fb-4f97-bbf5-e8c556d7c8f0")
DATA_FILES = (
    "factor_contract.json",
    "tasowheel_contract.json",
    "e4m_contract.json",
)


class MilestoneSeed(TypedDict):
    milestone_ref: str
    name: str
    planned_in_days: int
    status: str
    approval_required: bool
    completion_criteria: dict[str, Any]


class ContractSeed(TypedDict):
    public_id: str
    pilot_type: str
    agreement_type: str
    status: str
    provider_id: str
    consumer_id: str
    product_name: str
    quantity_total: int
    delivery_in_days: int
    activated_days_ago: int
    blockchain_contract_address: str
    config: dict[str, Any]
    milestones: list[MilestoneSeed]


def _load_seed_contract(path: Path) -> ContractSeed:
    return json.loads(path.read_text(encoding="utf-8"))


def load_seed_contracts() -> list[ContractSeed]:
    return [_load_seed_contract(DATA_DIR / filename) for filename in DATA_FILES]


def contract_uuid(public_id: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, f"contract:{public_id}")


def milestone_uuid(contract_id: uuid.UUID, milestone_ref: str) -> uuid.UUID:
    return uuid.uuid5(contract_id, f"milestone:{milestone_ref}")


def _planned_date(offset_days: int, *, today: date) -> date:
    return today + timedelta(days=offset_days)


def _activated_at(offset_days: int, *, now: datetime) -> datetime:
    return now - timedelta(days=offset_days)


async def _upsert_contract(seed: ContractSeed, *, now: datetime, today: date) -> uuid.UUID:
    seed_id = contract_uuid(seed["public_id"])

    async with SessionLocal() as session:
        contract = await session.get(Contract, seed_id)
        if contract is None:
            contract = Contract(id=seed_id)
            session.add(contract)

        contract.blockchain_contract_address = seed["blockchain_contract_address"]
        contract.public_id = seed["public_id"]
        contract.pilot_type = seed["pilot_type"]
        contract.agreement_type = seed["agreement_type"]
        contract.status = seed["status"]
        contract.provider_id = seed["provider_id"]
        contract.consumer_id = seed["consumer_id"]
        contract.product_name = seed["product_name"]
        contract.quantity_total = seed["quantity_total"]
        contract.delivery_date = _planned_date(seed["delivery_in_days"], today=today)
        contract.activated_at = _activated_at(seed["activated_days_ago"], now=now)
        contract.config = dict(seed["config"])

        for milestone_seed in seed["milestones"]:
            seed_milestone_id = milestone_uuid(seed_id, milestone_seed["milestone_ref"])
            milestone = await session.get(Milestone, seed_milestone_id)
            if milestone is None:
                milestone = Milestone(id=seed_milestone_id, contract_id=seed_id)
                session.add(milestone)

            milestone.contract_id = seed_id
            milestone.milestone_ref = milestone_seed["milestone_ref"]
            milestone.name = milestone_seed["name"]
            milestone.planned_date = _planned_date(
                milestone_seed["planned_in_days"],
                today=today,
            )
            milestone.actual_date = None
            milestone.status = milestone_seed["status"]
            milestone.approval_required = milestone_seed["approval_required"]
            milestone.completion_criteria = milestone_seed["completion_criteria"]
            milestone.evidence = []

        await session.commit()

    return seed_id


async def seed_database() -> tuple[int, int]:
    now = datetime.now(UTC)
    today = now.date()
    contracts = load_seed_contracts()

    for contract_seed in contracts:
        await _upsert_contract(contract_seed, now=now, today=today)

    return len(contracts), sum(len(contract["milestones"]) for contract in contracts)


async def fetch_seeded_counts() -> tuple[int, int]:
    async with SessionLocal() as session:
        contract_count = len((await session.execute(select(Contract.id))).scalars().all())
        milestone_count = len((await session.execute(select(Milestone.id))).scalars().all())
    return contract_count, milestone_count


def expected_e4m_approval_refs(contracts: Iterable[ContractSeed]) -> tuple[str, ...]:
    for contract in contracts:
        if contract["pilot_type"] != "E4M":
            continue
        approval_refs = [
            milestone["milestone_ref"]
            for milestone in contract["milestones"]
            if milestone["approval_required"]
        ]
        return tuple(approval_refs)
    return ()


async def main() -> None:
    contract_total, milestone_total = await seed_database()
    print(f"Seeded {contract_total} contracts, {milestone_total} milestones")


if __name__ == "__main__":
    asyncio.run(main())

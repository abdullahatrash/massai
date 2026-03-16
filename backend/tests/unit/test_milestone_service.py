from __future__ import annotations

import asyncio
import unittest
import uuid
from datetime import UTC, date, datetime
from typing import Any

from app.models.blockchain_event import BlockchainEvent
from app.models.contract import Contract
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.status_update import StatusUpdate
from app.services.milestone import MilestoneService


class FakeScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeMilestoneSession:
    def __init__(
        self,
        *,
        contract: Contract | None = None,
        milestone: Milestone | None = None,
        latest_update: StatusUpdate | None = None,
    ) -> None:
        self.contract = contract
        self.milestone = milestone
        self.latest_update = latest_update
        self.added: list[Any] = []

    async def get(self, model: type[Any], identifier: Any) -> Any:
        if self.milestone is not None and identifier == self.milestone.id:
            return self.milestone
        if self.contract is not None and identifier == self.contract.id:
            return self.contract
        return None

    async def execute(self, statement: Any) -> FakeScalarResult:
        return FakeScalarResult(self.latest_update)

    def add(self, instance: Any) -> None:
        self.added.append(instance)


def build_contract(*, public_id: str = "contract-factor-001", pilot_type: str = "FACTOR") -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.consumer_id = "consumer@test.com"
    contract.provider_id = "provider@test.com"
    contract.config = {
        "public_id": public_id,
    }
    return contract


def build_milestone(
    contract: Contract,
    *,
    milestone_ref: str,
    approval_required: bool = False,
    completion_criteria: dict[str, Any] | None = None,
) -> Milestone:
    milestone = Milestone(id=uuid.uuid4(), contract_id=contract.id)
    milestone.contract = contract
    milestone.milestone_ref = milestone_ref
    milestone.status = "SUBMITTED"
    milestone.approval_required = approval_required
    milestone.completion_criteria = completion_criteria or {}
    milestone.actual_date = date(2026, 3, 16)
    milestone.evidence = []
    return milestone


def build_update(
    contract: Contract,
    *,
    payload: dict[str, Any],
    update_type: str = "MILESTONE_COMPLETE",
) -> StatusUpdate:
    update = StatusUpdate(
        id=uuid.uuid4(),
        contract_id=contract.id,
        update_type=update_type,
        sensor_id="sensor-1",
        timestamp=datetime.now(UTC),
        payload=payload,
        evidence=[],
        processed=True,
    )
    update.contract = contract
    return update


class MilestoneServiceTestCase(unittest.TestCase):
    def _run(self, coroutine: Any) -> Any:
        return asyncio.run(coroutine)

    def test_factor_milestone_completes_when_criteria_are_met(self) -> None:
        contract = build_contract(pilot_type="FACTOR")
        milestone = build_milestone(
            contract,
            milestone_ref="TURNING",
            completion_criteria={
                "currentStage": "TURNING",
                "minQualityPassRate": 0.97,
            },
        )
        update = build_update(
            contract,
            payload={
                "currentStage": "TURNING",
                "qualityPassRate": 0.99,
                "quantityProduced": 12000,
                "quantityPlanned": 12000,
            },
        )
        session = FakeMilestoneSession(contract=contract, milestone=milestone, latest_update=update)
        processed_at = datetime(2026, 3, 16, 19, 0, tzinfo=UTC)

        self._run(MilestoneService.evaluate_submission(milestone.id, session, now=processed_at))

        self.assertEqual(milestone.status, "COMPLETED")
        blockchain_event = self._single_added(session, BlockchainEvent)
        self.assertEqual(blockchain_event.event_type, "MILESTONE_COMPLETED")
        self.assertEqual(blockchain_event.event_data["milestoneRef"], "TURNING")

    def test_factor_milestone_rejects_when_quality_is_below_threshold(self) -> None:
        contract = build_contract(pilot_type="FACTOR")
        milestone = build_milestone(
            contract,
            milestone_ref="TURNING",
            completion_criteria={
                "currentStage": "TURNING",
                "minQualityPassRate": 0.97,
            },
        )
        update = build_update(
            contract,
            payload={
                "currentStage": "TURNING",
                "qualityPassRate": 0.81,
                "quantityProduced": 12000,
                "quantityPlanned": 12000,
            },
        )
        session = FakeMilestoneSession(contract=contract, milestone=milestone, latest_update=update)

        self._run(MilestoneService.evaluate_submission(milestone.id, session))

        self.assertEqual(milestone.status, "REJECTED")
        self.assertFalse(any(isinstance(item, BlockchainEvent) for item in session.added))

    def test_approval_required_milestone_stays_submitted_and_queues_notification(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        milestone = build_milestone(
            contract,
            milestone_ref="M2",
            approval_required=True,
            completion_criteria={
                "currentPhase": "M2",
                "completionPct": 100,
            },
        )
        update = build_update(
            contract,
            payload={
                "currentPhase": "M2",
                "completionPct": 100,
            },
        )
        session = FakeMilestoneSession(contract=contract, milestone=milestone, latest_update=update)
        processed_at = datetime(2026, 3, 16, 20, 0, tzinfo=UTC)

        self._run(MilestoneService.evaluate_submission(milestone.id, session, now=processed_at))

        self.assertEqual(milestone.status, "SUBMITTED")
        notification = self._single_added(session, Notification)
        self.assertEqual(notification.event_type, "MILESTONE_AWAITING_APPROVAL")
        self.assertEqual(notification.recipient_id, contract.consumer_id)
        self.assertEqual(notification.payload["milestoneRef"], "M2")

    def test_e4m_milestone_rejects_with_open_critical_issue(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        milestone = build_milestone(
            contract,
            milestone_ref="M1",
            completion_criteria={
                "currentPhase": "M1",
                "completionPct": 100,
            },
        )
        update = build_update(
            contract,
            payload={
                "currentPhase": "M1",
                "completionPct": 100,
                "issues": [
                    {
                        "severity": "CRITICAL",
                        "status": "OPEN",
                        "title": "Integration failure",
                    }
                ],
            },
        )
        session = FakeMilestoneSession(contract=contract, milestone=milestone, latest_update=update)

        self._run(MilestoneService.evaluate_submission(milestone.id, session))

        self.assertEqual(milestone.status, "REJECTED")

    def test_approve_submission_completes_milestone_and_logs_blockchain_event(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        milestone = build_milestone(
            contract,
            milestone_ref="M2",
            approval_required=True,
        )
        session = FakeMilestoneSession(contract=contract, milestone=milestone)

        self._run(
            MilestoneService.approve_submission(
                milestone.id,
                session,
                notes="Looks good.",
                now=datetime(2026, 3, 16, 21, 0, tzinfo=UTC),
            )
        )

        self.assertEqual(milestone.status, "COMPLETED")
        self.assertEqual(milestone.actual_date, date(2026, 3, 16))
        self.assertEqual(milestone.evidence[0]["type"], "APPROVAL_NOTE")
        blockchain_event = self._single_added(session, BlockchainEvent)
        self.assertEqual(blockchain_event.event_type, "MILESTONE_APPROVED")
        self.assertEqual(blockchain_event.event_data["milestoneRef"], "M2")
        notification = self._single_added(session, Notification)
        self.assertEqual(notification.event_type, "MILESTONE_APPROVED")
        self.assertEqual(notification.recipient_id, contract.provider_id)

    def test_reject_submission_sets_reason_and_queues_provider_notification(self) -> None:
        contract = build_contract(public_id="contract-e4m-001", pilot_type="E4M")
        contract.provider_id = "provider-e4m@test.com"
        milestone = build_milestone(
            contract,
            milestone_ref="M2",
            approval_required=True,
        )
        session = FakeMilestoneSession(contract=contract, milestone=milestone)

        self._run(
            MilestoneService.reject_submission(
                milestone.id,
                session,
                reason="Need updated deliverables.",
                now=datetime(2026, 3, 16, 22, 0, tzinfo=UTC),
            )
        )

        self.assertEqual(milestone.status, "REJECTED")
        self.assertEqual(milestone.evidence[0]["type"], "REJECTION_REASON")
        notification = self._single_added(session, Notification)
        self.assertEqual(notification.event_type, "MILESTONE_REJECTED")
        self.assertEqual(notification.recipient_id, "provider-e4m@test.com")
        self.assertEqual(notification.payload["reason"], "Need updated deliverables.")

    @staticmethod
    def _single_added(session: FakeMilestoneSession, model: type[Any]) -> Any:
        matches = [item for item in session.added if isinstance(item, model)]
        if len(matches) != 1:
            raise AssertionError(f"Expected exactly one {model.__name__}, found {len(matches)}")
        return matches[0]

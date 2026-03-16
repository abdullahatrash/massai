from __future__ import annotations

import unittest

from app.core.schema_validator import (
    SchemaNotFoundError,
    SchemaValidationError,
    validate,
)


class SchemaValidatorTestCase(unittest.TestCase):
    def assertHasError(
        self,
        errors: list[dict[str, str]],
        *,
        path: str,
        message_fragment: str,
    ) -> None:
        self.assertTrue(
            any(
                error["path"] == path and message_fragment in error["message"]
                for error in errors
            ),
            msg=f"Expected error at path '{path}' containing '{message_fragment}', got {errors!r}",
        )

    def test_valid_factor_payload_passes_validation(self) -> None:
        validate(
            "FACTOR",
            {
                "quantityProduced": 1800,
                "quantityPlanned": 12000,
                "currentStage": "TURNING",
                "qualityPassRate": 0.991,
                "machineUtilization": 0.82,
                "qualityRejectCount": 12,
                "shiftsCompleted": 3,
                "estimatedCompletionDate": "2026-06-30",
            },
        )

    def test_factor_payload_rejects_quality_rate_above_one(self) -> None:
        with self.assertRaises(SchemaValidationError) as ctx:
            validate(
                "FACTOR",
                {
                    "quantityProduced": 1800,
                    "quantityPlanned": 12000,
                    "currentStage": "TURNING",
                    "qualityPassRate": 1.5,
                },
            )

        self.assertHasError(
            ctx.exception.errors,
            path="qualityPassRate",
            message_fragment="is greater than the maximum",
        )

    def test_factor_payload_requires_quantity_produced(self) -> None:
        with self.assertRaises(SchemaValidationError) as ctx:
            validate(
                "FACTOR",
                {
                    "quantityPlanned": 12000,
                    "currentStage": "TURNING",
                    "qualityPassRate": 0.99,
                },
            )

        self.assertHasError(
            ctx.exception.errors,
            path="quantityProduced",
            message_fragment="required property",
        )

    def test_valid_tasowheel_payload_passes_validation(self) -> None:
        validate(
            "TASOWHEEL",
            {
                "routingStep": 20,
                "stepName": "CNC Machining",
                "stepStatus": "IN_PROGRESS",
                "cycleTimeActualSec": 155,
                "downtimeMinutes": 9,
                "energyKwh": 27.4,
                "carbonKgCo2e": 10.1,
            },
        )

    def test_e4m_payload_rejects_completion_pct_above_hundred(self) -> None:
        with self.assertRaises(SchemaValidationError) as ctx:
            validate(
                "E4M",
                {
                    "currentPhase": "M2",
                    "completionPct": 110,
                },
            )

        self.assertHasError(
            ctx.exception.errors,
            path="completionPct",
            message_fragment="is greater than the maximum",
        )

    def test_unknown_pilot_type_raises_schema_not_found(self) -> None:
        with self.assertRaises(SchemaNotFoundError):
            validate("UNKNOWN_PILOT", {"value": 1})

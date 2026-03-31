from __future__ import annotations

import unittest
import uuid

from app.models.contract import Contract
from app.services.ingest_profiles import IngestProfileService


def build_contract(*, public_id: str = "contract-factor-001", pilot_type: str = "FACTOR") -> Contract:
    contract = Contract(id=uuid.uuid4())
    contract.public_id = public_id
    contract.pilot_type = pilot_type
    contract.config = {
        "public_id": public_id,
        "quality_target": 0.985,
        "last_known_state": {
            "currentStage": "TURNING",
            "qualityPassRate": 0.991,
            "quantityProduced": 1800,
            "quantityPlanned": 12000,
        },
    }
    return contract


class IngestProfileServiceTestCase(unittest.TestCase):
    def test_resolves_default_factor_profile(self) -> None:
        resolved = IngestProfileService.resolve_default_profile_for_pilot("FACTOR")

        self.assertEqual(resolved["profileKey"], "FACTOR_DEFAULT")
        self.assertEqual(resolved["profileVersion"], 1)
        self.assertIn("PRODUCTION_UPDATE", resolved["allowedUpdateTypes"])
        self.assertIn(
            "qualityPassRate",
            resolved["updateTypes"]["PRODUCTION_UPDATE"]["jsonSchema"]["properties"],
        )

    def test_build_contract_spec_merges_defaults_and_last_known_state(self) -> None:
        contract = build_contract()
        IngestProfileService.bind_default_profile(contract)

        spec = IngestProfileService.build_contract_spec(contract)

        self.assertEqual(spec["contractId"], "contract-factor-001")
        self.assertEqual(spec["profileKey"], "FACTOR_DEFAULT")
        self.assertEqual(spec["profileVersion"], 1)
        self.assertEqual(spec["contractContext"]["qualityTarget"], 0.985)
        factor_update = spec["updateTypes"]["PRODUCTION_UPDATE"]
        self.assertEqual(factor_update["initialPayload"]["currentStage"], "TURNING")
        self.assertEqual(factor_update["initialPayload"]["qualityPassRate"], 0.991)
        self.assertEqual(factor_update["initialPayload"]["quantityPlanned"], 12000)


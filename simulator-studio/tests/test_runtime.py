from __future__ import annotations

import unittest

from simulator_studio.clients import merge_contract_ids
from simulator_studio.runtime import ScenarioCursor, build_ingest_request


class RuntimeHelpersTestCase(unittest.TestCase):
    def test_merge_contract_ids_keeps_existing_and_appends_new(self) -> None:
        self.assertEqual(
            merge_contract_ids(["contract-1"], "contract-2"),
            ["contract-1", "contract-2"],
        )
        self.assertEqual(
            merge_contract_ids(["contract-1"], "contract-1"),
            ["contract-1"],
        )

    def test_build_ingest_request_filters_payload_to_allowed_fields(self) -> None:
        cursor = ScenarioCursor(
            {
                "initialPayload": {"quantityProduced": 10, "extra": "ignored"},
                "steps": [
                    {
                        "updateType": "PRODUCTION_UPDATE",
                        "payload": {"quantityProduced": 20, "currentStage": "TURNING"},
                    }
                ],
            }
        )
        event = cursor.next_event(update_type="PRODUCTION_UPDATE")
        request = build_ingest_request(
            source_id="sensor-01",
            update_type="PRODUCTION_UPDATE",
            scenario_event=event,
            spec={
                "profileVersion": 3,
                "updateTypes": {
                    "PRODUCTION_UPDATE": {
                        "defaults": {"quantityProduced": 0, "currentStage": "TURNING"},
                        "initialPayload": {"quantityPlanned": 100},
                        "jsonSchema": {
                            "properties": {
                                "quantityProduced": {"type": "integer"},
                                "quantityPlanned": {"type": "integer"},
                                "currentStage": {"type": "string"},
                            }
                        },
                    }
                },
            },
        )

        self.assertEqual(request["sourceId"], "sensor-01")
        self.assertEqual(request["profileVersion"], 3)
        self.assertEqual(
            request["payload"],
            {
                "quantityProduced": 20,
                "quantityPlanned": 100,
                "currentStage": "TURNING",
            },
        )

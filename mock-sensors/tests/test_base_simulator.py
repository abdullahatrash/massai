from __future__ import annotations

import json
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

from base_simulator import (
    ScenarioPlayer,
    ServiceAccountTokenProvider,
    build_config,
    extract_alerts,
    format_status,
    load_scenario,
)


class ScenarioPlayerTestCase(unittest.TestCase):
    def test_player_merges_incremental_payloads_between_steps(self) -> None:
        player = ScenarioPlayer(
            {
                "scenario": "factor_quality_failure",
                "initialPayload": {
                    "quantityProduced": 50,
                    "quantityPlanned": 500,
                    "currentStage": "TURNING",
                    "qualityPassRate": 0.99,
                },
                "steps": [
                    {
                        "updateType": "PRODUCTION_UPDATE",
                        "payload": {
                            "quantityProduced": 100,
                        },
                    },
                    {
                        "updateType": "PRODUCTION_UPDATE",
                        "payload": {
                            "qualityPassRate": 0.81,
                        },
                    },
                ],
            }
        )

        first = player.next_request_body(
            sensor_id="factor-sensor-01",
            timestamp=datetime(2026, 3, 16, 12, 0, tzinfo=UTC),
        )
        second = player.next_request_body(
            sensor_id="factor-sensor-01",
            timestamp=datetime(2026, 3, 16, 12, 1, tzinfo=UTC),
        )

        self.assertEqual(first["payload"]["quantityPlanned"], 500)
        self.assertEqual(second["payload"]["quantityProduced"], 100)
        self.assertEqual(second["payload"]["qualityPassRate"], 0.81)
        self.assertEqual(second["payload"]["currentStage"], "TURNING")

    def test_player_cycles_steps_for_long_running_loop(self) -> None:
        player = ScenarioPlayer(
            {
                "scenario": "factor_normal",
                "steps": [
                    {"updateType": "PRODUCTION_UPDATE", "payload": {"quantityProduced": 100}},
                    {"updateType": "QUALITY_EVENT", "payload": {"qualityPassRate": 0.9}},
                ],
            }
        )

        first = player.next_request_body(
            sensor_id="factor-sensor-01",
            timestamp=datetime(2026, 3, 16, 12, 0, tzinfo=UTC),
        )
        second = player.next_request_body(
            sensor_id="factor-sensor-01",
            timestamp=datetime(2026, 3, 16, 12, 1, tzinfo=UTC),
        )
        third = player.next_request_body(
            sensor_id="factor-sensor-01",
            timestamp=datetime(2026, 3, 16, 12, 2, tzinfo=UTC),
        )

        self.assertEqual(first["updateType"], "PRODUCTION_UPDATE")
        self.assertEqual(second["updateType"], "QUALITY_EVENT")
        self.assertEqual(third["updateType"], "PRODUCTION_UPDATE")


class ServiceAccountTokenProviderTestCase(unittest.TestCase):
    def test_provider_reuses_cached_token_until_refresh_window(self) -> None:
        provider = ServiceAccountTokenProvider(
            keycloak_url="http://keycloak:8080",
            keycloak_realm="massai",
            client_id="provider-factor-sa",
            client_secret="secret",
            refresh_buffer_seconds=30,
        )

        responses = [
            {"access_token": "token-1", "expires_in": 60},
            {"access_token": "token-2", "expires_in": 60},
        ]

        class DummyResponse:
            def __init__(self, payload: dict[str, object]) -> None:
                self.payload = payload

            def __enter__(self) -> "DummyResponse":
                return self

            def __exit__(self, exc_type, exc, tb) -> bool:
                return False

            def read(self) -> bytes:
                return json.dumps(self.payload).encode("utf-8")

        def fake_urlopen(request, timeout=10):  # noqa: ANN001
            return DummyResponse(responses.pop(0))

        with (
            patch("base_simulator.urlopen", side_effect=fake_urlopen),
            patch("base_simulator.time.time", side_effect=[0.0, 10.0, 40.0]),
        ):
            first = provider.get_access_token()
            second = provider.get_access_token()
            third = provider.get_access_token()

        self.assertEqual(first, "token-1")
        self.assertEqual(second, "token-1")
        self.assertEqual(third, "token-2")


class HelperFunctionTestCase(unittest.TestCase):
    def test_load_scenario_reads_expected_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            scenario_dir = Path(tmpdir)
            scenario_path = scenario_dir / "factor_normal.json"
            scenario_path.write_text(
                json.dumps({"scenario": "factor_normal", "steps": [{"updateType": "PRODUCTION_UPDATE", "payload": {}}]}),
                encoding="utf-8",
            )

            with patch("base_simulator.SCENARIO_DIR", scenario_dir):
                scenario = load_scenario("factor", "normal")

        self.assertEqual(scenario["scenario"], "factor_normal")

    def test_build_config_parses_stop_after_steps(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "SIMULATOR_NAME": "factor",
                "CONTRACT_ID": "contract-factor-001",
                "API_URL": "http://backend:8000",
                "SCENARIO": "quality_failure",
                "INTERVAL_SECONDS": "5",
                "STOP_AFTER_STEPS": "3",
                "SENSOR_ID": "factor-sensor-02",
            },
            clear=False,
        ):
            config = build_config("factor")

        self.assertEqual(config.scenario_name, "quality_failure")
        self.assertEqual(config.stop_after_steps, 3)
        self.assertEqual(config.sensor_id, "factor-sensor-02")

    def test_status_and_alert_helpers(self) -> None:
        self.assertEqual(format_status(200), "200 OK")
        self.assertEqual(
            extract_alerts({"data": {"alertsTriggered": ["QUALITY_THRESHOLD"]}}),
            ["QUALITY_THRESHOLD"],
        )

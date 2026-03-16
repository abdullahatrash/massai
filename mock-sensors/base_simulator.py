from __future__ import annotations

import copy
import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from http import HTTPStatus
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


SCENARIO_DIR = Path(__file__).resolve().parent / "scenarios"


class ServiceAccountTokenProvider:
    def __init__(
        self,
        *,
        keycloak_url: str,
        keycloak_realm: str,
        client_id: str,
        client_secret: str,
        refresh_buffer_seconds: int = 30,
    ) -> None:
        self._token_url = (
            f"{keycloak_url.rstrip('/')}/realms/{keycloak_realm}/protocol/openid-connect/token"
        )
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_buffer_seconds = refresh_buffer_seconds
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    def get_access_token(self) -> str:
        now = time.time()
        if self._access_token and now < self._expires_at - self._refresh_buffer_seconds:
            return self._access_token

        request = Request(
            self._token_url,
            data=urlencode(
                {
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))

        access_token = payload.get("access_token")
        if not access_token:
            raise RuntimeError(
                f"Keycloak token response missing access_token for {self._client_id}: {payload}"
            )

        self._access_token = access_token
        self._expires_at = now + float(payload.get("expires_in", 60))
        print(f"Authenticated as {self._client_id}")
        return self._access_token


@dataclass(frozen=True)
class SimulatorConfig:
    simulator_name: str
    contract_id: str
    api_url: str
    sensor_id: str
    scenario_name: str
    interval_seconds: float
    stop_after_steps: int | None

    @property
    def ingest_url(self) -> str:
        return f"{self.api_url.rstrip('/')}/api/v1/ingest/{self.contract_id}"


class ScenarioPlayer:
    def __init__(self, scenario: dict[str, Any]) -> None:
        steps = scenario.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ValueError("Scenario must define a non-empty 'steps' array.")

        initial_payload = scenario.get("initialPayload", {})
        if not isinstance(initial_payload, dict):
            raise ValueError("'initialPayload' must be an object when provided.")

        self._steps = steps
        self._state = dict(initial_payload)
        self._index = 0

    @property
    def total_steps(self) -> int:
        return len(self._steps)

    @property
    def iteration(self) -> int:
        return self._index

    def next_request_body(self, *, sensor_id: str, timestamp: datetime) -> dict[str, Any]:
        step = self._steps[self._index % len(self._steps)]
        self._index += 1

        payload_delta = step.get("payload", {})
        if not isinstance(payload_delta, dict):
            raise ValueError("Scenario step payload must be an object.")

        payload = copy.deepcopy(self._state)
        payload.update(payload_delta)
        self._state = payload

        evidence = step.get("evidence") or []
        if not isinstance(evidence, list):
            raise ValueError("Scenario step evidence must be an array when provided.")

        return {
            "updateType": str(step["updateType"]),
            "timestamp": timestamp.isoformat(),
            "sensorId": sensor_id,
            "payload": payload,
            "evidence": evidence,
        }


def load_scenario(simulator_name: str, scenario_name: str) -> dict[str, Any]:
    scenario_path = SCENARIO_DIR / f"{simulator_name}_{scenario_name}.json"
    if not scenario_path.is_file():
        raise FileNotFoundError(f"Scenario file not found: {scenario_path}")
    return json.loads(scenario_path.read_text(encoding="utf-8"))


def build_config(default_name: str) -> SimulatorConfig:
    simulator_name = os.environ.get("SIMULATOR_NAME", default_name).strip().lower()
    contract_id = os.environ.get("CONTRACT_ID", f"contract-{default_name}-001")
    api_url = os.environ.get("API_URL", "http://backend:8000").rstrip("/")
    scenario_name = os.environ.get("SCENARIO", "normal").strip().lower()
    interval_seconds = float(os.environ.get("INTERVAL_SECONDS", "15"))
    stop_after_raw = os.environ.get("STOP_AFTER_STEPS")
    stop_after_steps = int(stop_after_raw) if stop_after_raw else None
    sensor_id = os.environ.get("SENSOR_ID", f"{simulator_name}-sensor-01")

    return SimulatorConfig(
        simulator_name=simulator_name,
        contract_id=contract_id,
        api_url=api_url,
        sensor_id=sensor_id,
        scenario_name=scenario_name,
        interval_seconds=interval_seconds,
        stop_after_steps=stop_after_steps,
    )


def format_status(code: int) -> str:
    try:
        phrase = HTTPStatus(code).phrase
    except ValueError:
        phrase = "UNKNOWN"
    return f"{code} {phrase}"


def extract_alerts(response_payload: dict[str, Any]) -> list[str]:
    data = response_payload.get("data", {})
    if not isinstance(data, dict):
        return []
    alerts = data.get("alertsTriggered") or []
    if isinstance(alerts, list):
        return [str(item) for item in alerts]
    return []


def post_update(
    ingest_url: str,
    *,
    token: str,
    body: dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    request = Request(
        ingest_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        status_code = response.status
        payload = json.loads(response.read().decode("utf-8"))
    return status_code, payload


def log_step(
    *,
    simulator_name: str,
    step_number: int,
    total_steps: int,
    update_type: str,
    status_text: str,
    alerts: list[str],
    error: str | None = None,
) -> None:
    prefix = f"[{simulator_name.upper()}] Step {step_number}/{total_steps}"
    message = f"{prefix} - pushed {update_type} -> {status_text}, alerts: {alerts}"
    if error:
        message = f"{message}, error: {error}"
    print(message)


def run_simulator(default_name: str) -> None:
    config = build_config(default_name)
    scenario = load_scenario(config.simulator_name, config.scenario_name)
    player = ScenarioPlayer(scenario)
    token_provider = ServiceAccountTokenProvider(
        keycloak_url=os.environ.get("KEYCLOAK_URL", "http://keycloak:8080"),
        keycloak_realm=os.environ.get("KEYCLOAK_REALM", "massai"),
        client_id=os.environ["KEYCLOAK_CLIENT_ID"],
        client_secret=os.environ["KEYCLOAK_CLIENT_SECRET"],
    )

    push_count = 0
    while True:
        push_count += 1
        body = player.next_request_body(
            sensor_id=config.sensor_id,
            timestamp=datetime.now(UTC),
        )

        try:
            token = token_provider.get_access_token()
            status_code, response_payload = post_update(
                config.ingest_url,
                token=token,
                body=body,
            )
            log_step(
                simulator_name=config.simulator_name,
                step_number=((player.iteration - 1) % player.total_steps) + 1,
                total_steps=player.total_steps,
                update_type=str(body["updateType"]),
                status_text=format_status(status_code),
                alerts=extract_alerts(response_payload),
            )
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            log_step(
                simulator_name=config.simulator_name,
                step_number=((player.iteration - 1) % player.total_steps) + 1,
                total_steps=player.total_steps,
                update_type=str(body["updateType"]),
                status_text=format_status(exc.code),
                alerts=[],
                error=details or exc.reason,
            )
        except URLError as exc:
            log_step(
                simulator_name=config.simulator_name,
                step_number=((player.iteration - 1) % player.total_steps) + 1,
                total_steps=player.total_steps,
                update_type=str(body["updateType"]),
                status_text="NETWORK_ERROR",
                alerts=[],
                error=str(exc.reason),
            )
        except Exception as exc:
            log_step(
                simulator_name=config.simulator_name,
                step_number=((player.iteration - 1) % player.total_steps) + 1,
                total_steps=player.total_steps,
                update_type=str(body["updateType"]),
                status_text="ERROR",
                alerts=[],
                error=str(exc),
            )

        if config.stop_after_steps is not None and push_count >= config.stop_after_steps:
            print(
                f"[{config.simulator_name.upper()}] Reached STOP_AFTER_STEPS={config.stop_after_steps}, exiting cleanly."
            )
            return

        time.sleep(config.interval_seconds)

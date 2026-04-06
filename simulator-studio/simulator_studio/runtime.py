from __future__ import annotations

import copy
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from .clients import HttpError, MassaiClient
from .config import StudioSettings
from .storage import StudioStorage


class ScenarioCursor:
    def __init__(self, definition: dict[str, Any]) -> None:
        steps = definition.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ValueError("Scenario definition must include a non-empty steps array.")
        initial_payload = definition.get("initialPayload") or {}
        if not isinstance(initial_payload, dict):
            raise ValueError("Scenario initialPayload must be an object.")
        self._steps = steps
        self._state = copy.deepcopy(initial_payload)
        self._index = 0

    def next_event(self, *, update_type: str | None = None) -> dict[str, Any]:
        attempts = 0
        while attempts < len(self._steps):
            step = self._steps[self._index % len(self._steps)]
            self._index += 1
            attempts += 1
            current_type = str(step.get("updateType", "")).upper()
            if update_type and current_type != update_type.upper():
                continue
            payload_delta = dict(step.get("payload") or {})
            merged = copy.deepcopy(self._state)
            merged.update(payload_delta)
            self._state = merged
            return {
                "updateType": current_type,
                "payload": merged,
                "evidence": list(step.get("evidence") or []),
            }
        raise ValueError(f"Scenario does not contain an event for update type '{update_type}'.")


def build_ingest_request(
    *,
    source_id: str,
    update_type: str,
    scenario_event: dict[str, Any],
    spec: dict[str, Any],
) -> dict[str, Any]:
    update_spec = dict(spec["updateTypes"][update_type])
    json_schema = dict(update_spec.get("jsonSchema") or {})
    allowed_properties = set(dict(json_schema.get("properties") or {}).keys())

    payload = {}
    payload.update(dict(update_spec.get("defaults") or {}))
    payload.update(dict(update_spec.get("initialPayload") or {}))
    payload.update(dict(scenario_event.get("payload") or {}))
    filtered_payload = {
        key: value
        for key, value in payload.items()
        if key in allowed_properties
    }

    return {
        "updateType": update_type,
        "timestamp": datetime.now(UTC).isoformat(),
        "sourceId": source_id,
        "payload": filtered_payload,
        "evidence": list(scenario_event.get("evidence") or []),
        "profileVersion": spec["profileVersion"],
    }


@dataclass
class _RunHandle:
    run_id: str
    thread: threading.Thread
    stop_event: threading.Event
    started_at: float


class SimulationManager:
    def __init__(
        self,
        *,
        storage: StudioStorage,
        massai_client: MassaiClient,
        settings: StudioSettings,
    ) -> None:
        self._storage = storage
        self._massai_client = massai_client
        self._settings = settings
        self._active_runs: dict[str, _RunHandle] = {}
        self._lock = threading.Lock()

    def get_status(self, factory_id: str) -> dict[str, Any]:
        with self._lock:
            handle = self._active_runs.get(factory_id)
            if handle is None:
                return {"running": False}
            return {
                "running": handle.thread.is_alive(),
                "runId": handle.run_id,
                "startedAt": handle.started_at,
            }

    def run_once(self, factory_id: str) -> str:
        run_id = f"manual-{uuid.uuid4()}"
        self._tick(factory_id=factory_id, run_id=run_id)
        return run_id

    def start(self, factory_id: str) -> str:
        with self._lock:
            existing = self._active_runs.get(factory_id)
            if existing and existing.thread.is_alive():
                return existing.run_id
            stop_event = threading.Event()
            run_id = f"stream-{uuid.uuid4()}"
            thread = threading.Thread(
                target=self._run_loop,
                kwargs={"factory_id": factory_id, "run_id": run_id, "stop_event": stop_event},
                daemon=True,
            )
            handle = _RunHandle(
                run_id=run_id,
                thread=thread,
                stop_event=stop_event,
                started_at=time.time(),
            )
            self._active_runs[factory_id] = handle
            thread.start()
            return run_id

    def stop(self, factory_id: str) -> None:
        with self._lock:
            handle = self._active_runs.get(factory_id)
            if handle is not None:
                handle.stop_event.set()

    def _run_loop(self, *, factory_id: str, run_id: str, stop_event: threading.Event) -> None:
        factory = self._storage.get_factory(factory_id)
        sensors = [sensor for sensor in factory["sensors"] if sensor["enabled"]]
        scenarios = {
            sensor["id"]: ScenarioCursor(
                self._storage.get_scenario(sensor["scenarioKey"])["definition"]
            )
            for sensor in sensors
        }
        next_due = {sensor["id"]: time.monotonic() for sensor in sensors}

        while not stop_event.is_set():
            now = time.monotonic()
            for sensor in sensors:
                if now < next_due[sensor["id"]]:
                    continue
                self._tick(
                    factory_id=factory_id,
                    run_id=run_id,
                    sensor=sensor,
                    cursor=scenarios[sensor["id"]],
                )
                next_due[sensor["id"]] = now + float(sensor["intervalSeconds"])
            stop_event.wait(1.0)

        with self._lock:
            self._active_runs.pop(factory_id, None)

    def _tick(
        self,
        *,
        factory_id: str,
        run_id: str,
        sensor: dict[str, Any] | None = None,
        cursor: ScenarioCursor | None = None,
    ) -> None:
        factory = self._storage.get_factory(factory_id)
        if not factory["contractId"]:
            self._storage.append_run_log(
                factory_id=factory_id,
                sensor_id=sensor["id"] if sensor else None,
                run_id=run_id,
                status="ERROR",
                request_payload=None,
                response_payload=None,
                error_text="Factory is not provisioned yet.",
            )
            return

        sensors = [sensor] if sensor is not None else [item for item in factory["sensors"] if item["enabled"]]
        spec = self._massai_client.get_contract_ingest_spec(factory["contractId"])

        for sensor_item in sensors:
            active_cursor = cursor or ScenarioCursor(
                self._storage.get_scenario(sensor_item["scenarioKey"])["definition"]
            )
            try:
                scenario_event = active_cursor.next_event(update_type=sensor_item["updateType"])
                request_body = build_ingest_request(
                    source_id=sensor_item["sourceId"],
                    update_type=sensor_item["updateType"],
                    scenario_event=scenario_event,
                    spec=spec,
                )
                response = self._massai_client.ingest_update(
                    contract_id=factory["contractId"],
                    client_id=factory["providerClientId"],
                    client_secret=self._settings.provider_secret_for_client(factory["providerClientId"]),
                    body=request_body,
                )
                self._storage.append_run_log(
                    factory_id=factory_id,
                    sensor_id=sensor_item["id"],
                    run_id=run_id,
                    status="SUCCESS",
                    request_payload=request_body,
                    response_payload=response,
                    error_text=None,
                )
            except (HttpError, KeyError, ValueError) as exc:
                self._storage.append_run_log(
                    factory_id=factory_id,
                    sensor_id=sensor_item["id"],
                    run_id=run_id,
                    status="ERROR",
                    request_payload=None,
                    response_payload=None,
                    error_text=str(exc),
                )

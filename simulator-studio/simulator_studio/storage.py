from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator


def _utcnow() -> str:
    return datetime.now(UTC).isoformat()


def _encode(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def _decode(value: str | None, *, fallback: Any) -> Any:
    if not value:
        return fallback
    return json.loads(value)


class StudioStorage:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @property
    def db_path(self) -> Path:
        return self._db_path

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self._db_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA journal_mode=WAL")
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS factories (
                    id TEXT PRIMARY KEY,
                    template_key TEXT NOT NULL,
                    name TEXT NOT NULL,
                    factory_key TEXT NOT NULL,
                    pilot_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    provider_client_id TEXT NOT NULL,
                    default_profile_key TEXT NOT NULL,
                    default_profile_version INTEGER NOT NULL,
                    agreement_type TEXT NOT NULL,
                    product_name TEXT NOT NULL,
                    quantity_total INTEGER NOT NULL,
                    delivery_date TEXT NOT NULL,
                    consumer_id TEXT NOT NULL,
                    contract_id TEXT,
                    status TEXT NOT NULL,
                    profile_mode TEXT NOT NULL,
                    profile_key TEXT,
                    profile_version INTEGER,
                    profile_definition TEXT NOT NULL,
                    milestones_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sensors (
                    id TEXT PRIMARY KEY,
                    factory_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    update_type TEXT NOT NULL,
                    interval_seconds REAL NOT NULL,
                    scenario_key TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(factory_id) REFERENCES factories(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS scenarios (
                    scenario_key TEXT PRIMARY KEY,
                    pilot_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    update_types_json TEXT NOT NULL,
                    definition_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS run_logs (
                    id TEXT PRIMARY KEY,
                    factory_id TEXT NOT NULL,
                    sensor_id TEXT,
                    run_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    request_json TEXT,
                    response_json TEXT,
                    error_text TEXT,
                    FOREIGN KEY(factory_id) REFERENCES factories(id) ON DELETE CASCADE,
                    FOREIGN KEY(sensor_id) REFERENCES sensors(id) ON DELETE SET NULL
                );
                """
            )

    def seed_scenarios(self, scenarios: list[dict[str, Any]]) -> None:
        with self._connect() as connection:
            for scenario in scenarios:
                connection.execute(
                    """
                    INSERT INTO scenarios (
                        scenario_key, pilot_type, title, update_types_json, definition_json, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(scenario_key) DO UPDATE SET
                        pilot_type = excluded.pilot_type,
                        title = excluded.title,
                        update_types_json = excluded.update_types_json,
                        definition_json = excluded.definition_json,
                        updated_at = excluded.updated_at
                    """,
                    (
                        scenario["scenarioKey"],
                        scenario["pilotType"],
                        scenario["title"],
                        _encode(scenario["updateTypes"]),
                        _encode(scenario["definition"]),
                        _utcnow(),
                    ),
                )

    def list_scenarios(self, pilot_type: str | None = None) -> list[dict[str, Any]]:
        sql = "SELECT * FROM scenarios"
        params: tuple[Any, ...] = ()
        if pilot_type:
            sql += " WHERE pilot_type = ?"
            params = (pilot_type.upper(),)
        sql += " ORDER BY pilot_type, scenario_key"
        with self._connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [self._scenario_row_to_dict(row) for row in rows]

    def get_scenario(self, scenario_key: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM scenarios WHERE scenario_key = ?",
                (scenario_key,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Scenario '{scenario_key}' not found.")
        return self._scenario_row_to_dict(row)

    def create_factory_from_template(
        self,
        template: dict[str, Any],
        *,
        name: str,
        factory_key: str,
        contract_id: str,
        product_name: str,
        quantity_total: int,
        delivery_date: str,
    ) -> dict[str, Any]:
        factory_id = str(uuid.uuid4())
        timestamp = _utcnow()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO factories (
                    id, template_key, name, factory_key, pilot_type, description,
                    provider_client_id, default_profile_key, default_profile_version,
                    agreement_type, product_name, quantity_total, delivery_date,
                    consumer_id, contract_id, status, profile_mode, profile_key,
                    profile_version, profile_definition, milestones_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    factory_id,
                    template["templateKey"],
                    name,
                    factory_key,
                    template["pilotType"],
                    template["description"],
                    template["providerClientId"],
                    template["defaultProfileKey"],
                    template["defaultProfileVersion"],
                    template["agreementType"],
                    product_name,
                    quantity_total,
                    delivery_date,
                    template["consumerId"],
                    contract_id,
                    "DRAFT",
                    "builtin",
                    template["defaultProfileKey"],
                    template["defaultProfileVersion"],
                    _encode(template["profileDefinition"]),
                    _encode(template["milestones"]),
                    timestamp,
                    timestamp,
                ),
            )
            for sensor in template["sensors"]:
                sensor_id = str(uuid.uuid4())
                connection.execute(
                    """
                    INSERT INTO sensors (
                        id, factory_id, name, source_id, update_type, interval_seconds,
                        scenario_key, enabled, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sensor_id,
                        factory_id,
                        sensor["name"],
                        sensor["sourceId"],
                        sensor["updateType"],
                        float(sensor["intervalSeconds"]),
                        sensor["scenarioKey"],
                        1 if sensor.get("enabled", True) else 0,
                        timestamp,
                        timestamp,
                    ),
                )
        return self.get_factory(factory_id)

    def list_factories(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM factories
                WHERE status != 'ARCHIVED'
                ORDER BY updated_at DESC, name ASC
                """
            ).fetchall()
        return [self._factory_row_to_dict(row) for row in rows]

    def get_factory(self, factory_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM factories WHERE id = ?",
                (factory_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Factory '{factory_id}' not found.")
        factory = self._factory_row_to_dict(row)
        factory["sensors"] = self.list_sensors(factory_id)
        return factory

    def update_factory_profile(
        self,
        factory_id: str,
        *,
        profile_definition: dict[str, Any],
        profile_key: str,
        profile_version: int,
        profile_mode: str,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE factories
                SET profile_definition = ?, profile_key = ?, profile_version = ?,
                    profile_mode = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    _encode(profile_definition),
                    profile_key,
                    profile_version,
                    profile_mode,
                    _utcnow(),
                    factory_id,
                ),
            )

    def update_factory_milestones(
        self,
        factory_id: str,
        milestones: list[dict[str, Any]],
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE factories
                SET milestones_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    _encode(milestones),
                    _utcnow(),
                    factory_id,
                ),
            )

    def mark_factory_provisioned(
        self,
        factory_id: str,
        *,
        contract_id: str,
        profile_key: str,
        profile_version: int,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE factories
                SET contract_id = ?, status = ?, profile_key = ?, profile_version = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    contract_id,
                    "PROVISIONED",
                    profile_key,
                    profile_version,
                    _utcnow(),
                    factory_id,
                ),
            )

    def archive_factory(self, factory_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE factories
                SET status = 'ARCHIVED', updated_at = ?
                WHERE id = ?
                """,
                (
                    _utcnow(),
                    factory_id,
                ),
            )

    def delete_factory(self, factory_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM factories WHERE id = ?",
                (factory_id,),
            )

    def list_sensors(self, factory_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM sensors WHERE factory_id = ? ORDER BY created_at ASC",
                (factory_id,),
            ).fetchall()
        return [self._sensor_row_to_dict(row) for row in rows]

    def add_sensor(
        self,
        factory_id: str,
        *,
        name: str,
        source_id: str,
        update_type: str,
        interval_seconds: float,
        scenario_key: str,
        enabled: bool,
    ) -> None:
        timestamp = _utcnow()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sensors (
                    id, factory_id, name, source_id, update_type, interval_seconds,
                    scenario_key, enabled, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    factory_id,
                    name,
                    source_id,
                    update_type,
                    float(interval_seconds),
                    scenario_key,
                    1 if enabled else 0,
                    timestamp,
                    timestamp,
                ),
            )

    def update_sensor(
        self,
        sensor_id: str,
        *,
        name: str,
        source_id: str,
        update_type: str,
        interval_seconds: float,
        scenario_key: str,
        enabled: bool,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sensors
                SET name = ?, source_id = ?, update_type = ?, interval_seconds = ?,
                    scenario_key = ?, enabled = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    name,
                    source_id,
                    update_type,
                    float(interval_seconds),
                    scenario_key,
                    1 if enabled else 0,
                    _utcnow(),
                    sensor_id,
                ),
            )

    def delete_sensor(self, sensor_id: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM sensors WHERE id = ?", (sensor_id,))

    def append_run_log(
        self,
        *,
        factory_id: str,
        sensor_id: str | None,
        run_id: str,
        status: str,
        request_payload: dict[str, Any] | None,
        response_payload: dict[str, Any] | None,
        error_text: str | None,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO run_logs (
                    id, factory_id, sensor_id, run_id, created_at, status,
                    request_json, response_json, error_text
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    factory_id,
                    sensor_id,
                    run_id,
                    _utcnow(),
                    status,
                    _encode(request_payload) if request_payload is not None else None,
                    _encode(response_payload) if response_payload is not None else None,
                    error_text,
                ),
            )

    def list_run_logs(self, factory_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM run_logs
                WHERE factory_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (factory_id, limit),
            ).fetchall()
        return [self._run_log_row_to_dict(row) for row in rows]

    def _factory_row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "templateKey": row["template_key"],
            "name": row["name"],
            "factoryKey": row["factory_key"],
            "pilotType": row["pilot_type"],
            "description": row["description"],
            "providerClientId": row["provider_client_id"],
            "defaultProfileKey": row["default_profile_key"],
            "defaultProfileVersion": row["default_profile_version"],
            "agreementType": row["agreement_type"],
            "productName": row["product_name"],
            "quantityTotal": row["quantity_total"],
            "deliveryDate": row["delivery_date"],
            "consumerId": row["consumer_id"],
            "contractId": row["contract_id"],
            "status": row["status"],
            "profileMode": row["profile_mode"],
            "profileKey": row["profile_key"],
            "profileVersion": row["profile_version"],
            "profileDefinition": _decode(row["profile_definition"], fallback={}),
            "milestones": _decode(row["milestones_json"], fallback=[]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def _sensor_row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "factoryId": row["factory_id"],
            "name": row["name"],
            "sourceId": row["source_id"],
            "updateType": row["update_type"],
            "intervalSeconds": row["interval_seconds"],
            "scenarioKey": row["scenario_key"],
            "enabled": bool(row["enabled"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def _scenario_row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "scenarioKey": row["scenario_key"],
            "pilotType": row["pilot_type"],
            "title": row["title"],
            "updateTypes": _decode(row["update_types_json"], fallback=[]),
            "definition": _decode(row["definition_json"], fallback={}),
            "updatedAt": row["updated_at"],
        }

    def _run_log_row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "factoryId": row["factory_id"],
            "sensorId": row["sensor_id"],
            "runId": row["run_id"],
            "createdAt": row["created_at"],
            "status": row["status"],
            "request": _decode(row["request_json"], fallback=None),
            "response": _decode(row["response_json"], fallback=None),
            "errorText": row["error_text"],
        }

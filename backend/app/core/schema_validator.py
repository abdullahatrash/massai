from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "pilot_schemas"
_REQUIRED_PROPERTY_PATTERN = re.compile(r"'([^']+)' is a required property")


class SchemaNotFoundError(LookupError):
    """Raised when a pilot type does not have a registered JSON schema."""


class SchemaValidationError(ValueError):
    """Raised when a payload does not satisfy the pilot JSON schema."""

    def __init__(self, errors: list[dict[str, str]]) -> None:
        super().__init__("Payload failed schema validation.")
        self.errors = errors


def _normalize_pilot_type(pilot_type: str) -> str:
    normalized = pilot_type.strip().lower()
    if not normalized:
        raise SchemaNotFoundError("Pilot type is required to resolve a JSON schema.")
    return normalized


def _schema_path(pilot_type: str) -> Path:
    return SCHEMA_DIR / f"{_normalize_pilot_type(pilot_type)}_update.json"


@lru_cache(maxsize=None)
def load_schema(pilot_type: str) -> dict[str, Any]:
    schema_path = _schema_path(pilot_type)
    if not schema_path.is_file():
        raise SchemaNotFoundError(
            f"No JSON schema found for pilot type '{pilot_type}'."
        )
    return json.loads(schema_path.read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def _get_validator(pilot_type: str) -> Draft202012Validator:
    schema = load_schema(pilot_type)
    return Draft202012Validator(
        schema,
        format_checker=Draft202012Validator.FORMAT_CHECKER,
    )


def _error_path(error: ValidationError) -> str:
    if error.validator == "required":
        match = _REQUIRED_PROPERTY_PATTERN.search(error.message)
        if match:
            return match.group(1)
    if not error.absolute_path:
        return "$"
    return ".".join(str(part) for part in error.absolute_path)


def _format_error(error: ValidationError) -> dict[str, str]:
    return {
        "path": _error_path(error),
        "message": error.message,
    }


def validate(pilot_type: str, payload: dict[str, Any]) -> None:
    validator = _get_validator(pilot_type)
    errors = sorted(
        (_format_error(error) for error in validator.iter_errors(payload)),
        key=lambda item: (item["path"], item["message"]),
    )
    if errors:
        raise SchemaValidationError(errors)

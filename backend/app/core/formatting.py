from __future__ import annotations

import json

from app.models.alert import Alert


def describe_alert(alert: Alert) -> str:
    """Return a human-readable description for an alert.

    Parses JSON ``condition_description`` values (e.g. quality events stored as
    a JSON blob) and formats them as plain English.  Falls back to a generic
    severity-based sentence when no description is available.
    """
    description = (alert.condition_description or "").strip()
    if description:
        if description.startswith("{"):
            try:
                data = json.loads(description)
                if isinstance(data, dict) and "sensorId" in data:
                    return f"Quality event received from sensor '{data['sensorId']}'"
            except (ValueError, TypeError):
                pass
        return description
    severity = (alert.severity or "alert").upper()
    return f"{severity.title()} alert triggered"

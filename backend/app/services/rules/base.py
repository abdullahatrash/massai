from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AlertResult:
    rule_id: str
    severity: str
    description: str

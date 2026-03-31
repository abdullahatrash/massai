from __future__ import annotations

import copy
from collections.abc import Iterable
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.contracts import contract_public_id
from app.core.response import ApiException
from app.models.contract import Contract
from app.models.ingest_profile import IngestProfile

SCHEMA_VERSION = "2"
SUPPORTED_UPDATE_TYPES = (
    "PRODUCTION_UPDATE",
    "QUALITY_EVENT",
    "PHASE_CHANGE",
    "MILESTONE_COMPLETE",
)

STANDARD_FIELD_CATALOG: dict[str, dict[str, dict[str, Any]]] = {
    "PRODUCTION_UPDATE": {
        "quantityProduced": {"type": "integer", "minimum": 0},
        "quantityPlanned": {"type": "integer", "minimum": 0},
        "currentStage": {
            "type": "string",
            "enum": ["TURNING", "HEAT_TREATMENT", "GRINDING", "INSPECTION"],
        },
        "qualityPassRate": {"type": "number", "minimum": 0, "maximum": 1},
        "machineUtilization": {"type": "number", "minimum": 0, "maximum": 1},
        "qualityRejectCount": {"type": "integer", "minimum": 0},
        "shiftsCompleted": {"type": "integer", "minimum": 0},
        "estimatedCompletionDate": {"type": "string", "format": "date"},
        "routingStep": {"type": "integer", "minimum": 0},
        "stepName": {"type": "string", "minLength": 1},
        "stepStatus": {"type": "string", "enum": ["IN_PROGRESS", "COMPLETE"]},
        "setupTimeActualMin": {"type": "number", "minimum": 0},
        "cycleTimeActualSec": {"type": "number", "minimum": 0},
        "downtimeMinutes": {"type": "number", "minimum": 0},
        "energyKwh": {"type": "number", "minimum": 0},
        "carbonKgCo2e": {"type": "number", "minimum": 0},
        "milestoneRef": {"type": "string", "minLength": 1},
    },
    "QUALITY_EVENT": {
        "quantityProduced": {"type": "integer", "minimum": 0},
        "quantityPlanned": {"type": "integer", "minimum": 0},
        "currentStage": {
            "type": "string",
            "enum": ["TURNING", "HEAT_TREATMENT", "GRINDING", "INSPECTION"],
        },
        "qualityPassRate": {"type": "number", "minimum": 0, "maximum": 1},
        "machineUtilization": {"type": "number", "minimum": 0, "maximum": 1},
        "qualityRejectCount": {"type": "integer", "minimum": 0},
        "currentPhase": {"type": "string", "pattern": "^M[1-6](?:_[A-Z0-9]+)*$"},
        "completionPct": {"type": "integer", "minimum": 0, "maximum": 100},
        "approvalRequired": {"type": "boolean"},
        "deliverables": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
        },
        "testResults": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "testName": {"type": "string"},
                    "result": {
                        "type": "string",
                        "enum": ["PASS", "FAIL", "BLOCKED"],
                    },
                    "defects": {"type": "integer", "minimum": 0},
                },
                "required": ["result"],
                "additionalProperties": False,
            },
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                    },
                    "status": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "additionalProperties": False,
            },
        },
        "milestoneRef": {"type": "string", "minLength": 1},
    },
    "PHASE_CHANGE": {
        "currentPhase": {"type": "string", "pattern": "^M[1-6](?:_[A-Z0-9]+)*$"},
        "completionPct": {"type": "integer", "minimum": 0, "maximum": 100},
        "approvalRequired": {"type": "boolean"},
        "deliverables": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
        },
        "testResults": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "testName": {"type": "string"},
                    "result": {
                        "type": "string",
                        "enum": ["PASS", "FAIL", "BLOCKED"],
                    },
                    "defects": {"type": "integer", "minimum": 0},
                },
                "required": ["result"],
                "additionalProperties": False,
            },
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                    },
                    "status": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "additionalProperties": False,
            },
        },
        "milestoneRef": {"type": "string", "minLength": 1},
    },
    "MILESTONE_COMPLETE": {
        "quantityProduced": {"type": "integer", "minimum": 0},
        "quantityPlanned": {"type": "integer", "minimum": 0},
        "currentStage": {
            "type": "string",
            "enum": ["TURNING", "HEAT_TREATMENT", "GRINDING", "INSPECTION"],
        },
        "qualityPassRate": {"type": "number", "minimum": 0, "maximum": 1},
        "machineUtilization": {"type": "number", "minimum": 0, "maximum": 1},
        "qualityRejectCount": {"type": "integer", "minimum": 0},
        "shiftsCompleted": {"type": "integer", "minimum": 0},
        "routingStep": {"type": "integer", "minimum": 0},
        "stepName": {"type": "string", "minLength": 1},
        "stepStatus": {"type": "string", "enum": ["IN_PROGRESS", "COMPLETE"]},
        "setupTimeActualMin": {"type": "number", "minimum": 0},
        "cycleTimeActualSec": {"type": "number", "minimum": 0},
        "downtimeMinutes": {"type": "number", "minimum": 0},
        "energyKwh": {"type": "number", "minimum": 0},
        "carbonKgCo2e": {"type": "number", "minimum": 0},
        "currentPhase": {"type": "string", "pattern": "^M[1-6](?:_[A-Z0-9]+)*$"},
        "completionPct": {"type": "integer", "minimum": 0, "maximum": 100},
        "approvalRequired": {"type": "boolean"},
        "deliverables": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
        },
        "testResults": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "testName": {"type": "string"},
                    "result": {
                        "type": "string",
                        "enum": ["PASS", "FAIL", "BLOCKED"],
                    },
                    "defects": {"type": "integer", "minimum": 0},
                },
                "required": ["result"],
                "additionalProperties": False,
            },
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                    },
                    "status": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "additionalProperties": False,
            },
        },
        "milestoneRef": {"type": "string", "minLength": 1},
    },
}

BUILTIN_PROFILE_DEFINITIONS: dict[tuple[str, int], dict[str, Any]] = {
    ("FACTOR_DEFAULT", 1): {
        "factoryKey": "factor",
        "pilotType": "FACTOR",
        "status": "ACTIVE",
        "supportedUpdateTypes": [
            "PRODUCTION_UPDATE",
            "QUALITY_EVENT",
            "MILESTONE_COMPLETE",
        ],
        "updateTypes": {
            "PRODUCTION_UPDATE": {
                "fields": [
                    "quantityProduced",
                    "quantityPlanned",
                    "currentStage",
                    "qualityPassRate",
                    "machineUtilization",
                    "qualityRejectCount",
                    "shiftsCompleted",
                    "estimatedCompletionDate",
                    "milestoneRef",
                ],
                "required": [
                    "quantityProduced",
                    "quantityPlanned",
                    "currentStage",
                    "qualityPassRate",
                ],
                "defaults": {
                    "currentStage": "TURNING",
                    "machineUtilization": 0.8,
                    "qualityPassRate": 0.99,
                    "quantityPlanned": 12000,
                    "quantityProduced": 0,
                    "qualityRejectCount": 0,
                    "shiftsCompleted": 0,
                },
                "ui": {
                    "fieldOrder": [
                        "quantityProduced",
                        "quantityPlanned",
                        "qualityPassRate",
                        "currentStage",
                        "machineUtilization",
                        "qualityRejectCount",
                        "shiftsCompleted",
                        "estimatedCompletionDate",
                        "milestoneRef",
                    ],
                    "groups": [
                        {
                            "id": "production",
                            "title": "Production metrics",
                            "fields": [
                                "quantityProduced",
                                "quantityPlanned",
                                "qualityPassRate",
                                "currentStage",
                                "machineUtilization",
                            ],
                        },
                        {
                            "id": "supporting",
                            "title": "Supporting data",
                            "fields": [
                                "qualityRejectCount",
                                "shiftsCompleted",
                                "estimatedCompletionDate",
                                "milestoneRef",
                            ],
                        },
                    ],
                    "fields": {
                        "quantityProduced": {"label": "Quantity produced", "placeholder": "0"},
                        "quantityPlanned": {"label": "Quantity planned", "placeholder": "0"},
                        "qualityPassRate": {
                            "label": "Quality pass rate (%)",
                            "displayAs": "percentage",
                            "placeholder": "98.5",
                            "helpText": "Enter the percentage value, for example 98.5.",
                        },
                        "currentStage": {"label": "Current stage"},
                        "machineUtilization": {
                            "label": "Machine utilization",
                            "placeholder": "0.80",
                        },
                        "qualityRejectCount": {"label": "Reject count", "placeholder": "0"},
                        "shiftsCompleted": {"label": "Shifts completed", "placeholder": "0"},
                        "estimatedCompletionDate": {
                            "label": "Estimated completion date",
                            "placeholder": "2026-04-30",
                        },
                        "milestoneRef": {
                            "label": "Milestone ref",
                            "placeholder": "Optional, e.g. TURNING",
                        },
                    },
                },
            },
            "QUALITY_EVENT": {
                "fields": [
                    "quantityProduced",
                    "quantityPlanned",
                    "currentStage",
                    "qualityPassRate",
                    "machineUtilization",
                    "qualityRejectCount",
                    "milestoneRef",
                ],
                "required": ["currentStage", "qualityPassRate"],
                "defaults": {
                    "currentStage": "TURNING",
                    "qualityPassRate": 0.99,
                },
                "ui": {
                    "fieldOrder": [
                        "quantityProduced",
                        "quantityPlanned",
                        "qualityPassRate",
                        "qualityRejectCount",
                        "currentStage",
                        "machineUtilization",
                        "milestoneRef",
                    ],
                    "fields": {
                        "quantityProduced": {"label": "Quantity produced", "placeholder": "0"},
                        "quantityPlanned": {"label": "Quantity planned", "placeholder": "0"},
                        "qualityPassRate": {
                            "label": "Quality pass rate (%)",
                            "displayAs": "percentage",
                            "placeholder": "90",
                        },
                        "qualityRejectCount": {"label": "Reject count", "placeholder": "0"},
                        "currentStage": {"label": "Current stage"},
                        "machineUtilization": {"label": "Machine utilization", "placeholder": "0.80"},
                        "milestoneRef": {"label": "Milestone ref", "placeholder": "Optional"},
                    },
                },
            },
            "MILESTONE_COMPLETE": {
                "fields": [
                    "quantityProduced",
                    "quantityPlanned",
                    "currentStage",
                    "qualityPassRate",
                    "machineUtilization",
                    "qualityRejectCount",
                    "shiftsCompleted",
                    "milestoneRef",
                ],
                "required": [
                    "quantityProduced",
                    "quantityPlanned",
                    "currentStage",
                    "qualityPassRate",
                    "milestoneRef",
                ],
                "defaults": {
                    "currentStage": "TURNING",
                    "qualityPassRate": 0.99,
                },
                "ui": {
                    "fieldOrder": [
                        "quantityProduced",
                        "quantityPlanned",
                        "qualityPassRate",
                        "currentStage",
                        "machineUtilization",
                        "qualityRejectCount",
                        "shiftsCompleted",
                        "milestoneRef",
                    ],
                    "fields": {
                        "quantityProduced": {"label": "Quantity produced", "placeholder": "0"},
                        "quantityPlanned": {"label": "Quantity planned", "placeholder": "0"},
                        "qualityPassRate": {
                            "label": "Quality pass rate (%)",
                            "displayAs": "percentage",
                            "placeholder": "100",
                        },
                        "currentStage": {"label": "Current stage"},
                        "machineUtilization": {"label": "Machine utilization", "placeholder": "0.80"},
                        "qualityRejectCount": {"label": "Reject count", "placeholder": "0"},
                        "shiftsCompleted": {"label": "Shifts completed", "placeholder": "0"},
                        "milestoneRef": {"label": "Milestone ref", "placeholder": "Required"},
                    },
                },
            },
        },
    },
    ("TASOWHEEL_DEFAULT", 1): {
        "factoryKey": "tasowheel",
        "pilotType": "TASOWHEEL",
        "status": "ACTIVE",
        "supportedUpdateTypes": ["PRODUCTION_UPDATE", "MILESTONE_COMPLETE"],
        "updateTypes": {
            "PRODUCTION_UPDATE": {
                "fields": [
                    "routingStep",
                    "stepName",
                    "stepStatus",
                    "setupTimeActualMin",
                    "cycleTimeActualSec",
                    "downtimeMinutes",
                    "energyKwh",
                    "carbonKgCo2e",
                    "milestoneRef",
                ],
                "required": ["routingStep", "stepName", "stepStatus"],
                "defaults": {
                    "routingStep": 10,
                    "stepName": "Blank Preparation",
                    "stepStatus": "IN_PROGRESS",
                },
                "ui": {
                    "fieldOrder": [
                        "routingStep",
                        "stepName",
                        "stepStatus",
                        "downtimeMinutes",
                        "energyKwh",
                        "setupTimeActualMin",
                        "cycleTimeActualSec",
                        "carbonKgCo2e",
                        "milestoneRef",
                    ],
                    "fields": {
                        "routingStep": {"label": "Routing step", "placeholder": "10"},
                        "stepName": {"label": "Step name", "placeholder": "Blank Preparation"},
                        "stepStatus": {"label": "Step status"},
                        "downtimeMinutes": {"label": "Downtime minutes", "placeholder": "0"},
                        "energyKwh": {"label": "Energy kWh", "placeholder": "0"},
                        "setupTimeActualMin": {
                            "label": "Setup time actual (min)",
                            "placeholder": "0",
                        },
                        "cycleTimeActualSec": {
                            "label": "Cycle time actual (sec)",
                            "placeholder": "0",
                        },
                        "carbonKgCo2e": {"label": "Carbon kgCO2e", "placeholder": "0"},
                        "milestoneRef": {
                            "label": "Milestone ref",
                            "placeholder": "Optional, e.g. STEP_20",
                        },
                    },
                },
            },
            "MILESTONE_COMPLETE": {
                "fields": [
                    "routingStep",
                    "stepName",
                    "stepStatus",
                    "setupTimeActualMin",
                    "cycleTimeActualSec",
                    "downtimeMinutes",
                    "energyKwh",
                    "carbonKgCo2e",
                    "milestoneRef",
                ],
                "required": ["routingStep", "stepName", "stepStatus", "milestoneRef"],
                "defaults": {
                    "routingStep": 10,
                    "stepName": "Blank Preparation",
                    "stepStatus": "COMPLETE",
                },
                "ui": {
                    "fieldOrder": [
                        "routingStep",
                        "stepName",
                        "stepStatus",
                        "downtimeMinutes",
                        "energyKwh",
                        "setupTimeActualMin",
                        "cycleTimeActualSec",
                        "carbonKgCo2e",
                        "milestoneRef",
                    ],
                    "fields": {
                        "routingStep": {"label": "Routing step", "placeholder": "10"},
                        "stepName": {"label": "Step name", "placeholder": "Blank Preparation"},
                        "stepStatus": {"label": "Step status"},
                        "downtimeMinutes": {"label": "Downtime minutes", "placeholder": "0"},
                        "energyKwh": {"label": "Energy kWh", "placeholder": "0"},
                        "setupTimeActualMin": {
                            "label": "Setup time actual (min)",
                            "placeholder": "0",
                        },
                        "cycleTimeActualSec": {
                            "label": "Cycle time actual (sec)",
                            "placeholder": "0",
                        },
                        "carbonKgCo2e": {"label": "Carbon kgCO2e", "placeholder": "0"},
                        "milestoneRef": {"label": "Milestone ref", "placeholder": "Required"},
                    },
                },
            },
        },
    },
    ("E4M_DEFAULT", 1): {
        "factoryKey": "e4m",
        "pilotType": "E4M",
        "status": "ACTIVE",
        "supportedUpdateTypes": ["PHASE_CHANGE", "QUALITY_EVENT", "MILESTONE_COMPLETE"],
        "updateTypes": {
            "PHASE_CHANGE": {
                "fields": [
                    "currentPhase",
                    "completionPct",
                    "approvalRequired",
                    "deliverables",
                    "testResults",
                    "issues",
                    "milestoneRef",
                ],
                "required": ["currentPhase", "completionPct"],
                "defaults": {
                    "currentPhase": "M1",
                    "completionPct": 0,
                    "approvalRequired": False,
                    "testResults": [{"result": "PASS", "defects": 0}],
                    "deliverables": [],
                    "issues": [],
                },
                "ui": {
                    "fieldOrder": [
                        "currentPhase",
                        "completionPct",
                        "approvalRequired",
                        "milestoneRef",
                        "deliverables",
                        "testResults",
                        "issues",
                    ],
                    "groups": [
                        {
                            "id": "phase",
                            "title": "Phase status",
                            "fields": [
                                "currentPhase",
                                "completionPct",
                                "approvalRequired",
                                "milestoneRef",
                            ],
                        },
                        {
                            "id": "deliverables",
                            "title": "Deliverables",
                            "fields": ["deliverables"],
                        },
                        {
                            "id": "testResults",
                            "title": "Test results",
                            "fields": ["testResults"],
                        },
                    ],
                    "fields": {
                        "currentPhase": {
                            "label": "Current phase",
                            "placeholder": "M1",
                            "helpText": "Enter M1-M6 or a phase-specific variant like M3_GATE.",
                        },
                        "completionPct": {"label": "Completion (%)", "placeholder": "0"},
                        "approvalRequired": {
                            "label": "Consumer approval required",
                            "widget": "toggle",
                        },
                        "milestoneRef": {
                            "label": "Milestone ref",
                            "placeholder": "Optional, e.g. M1",
                        },
                        "deliverables": {
                            "label": "Deliverables",
                            "widget": "multiline-list",
                            "placeholder": "One deliverable per line",
                        },
                        "testResults": {
                            "label": "Test results",
                            "widget": "object-array",
                            "itemLabel": "Test",
                            "itemFields": {
                                "testName": {
                                    "label": "Test name",
                                    "placeholder": "e.g. Thermal stress",
                                },
                                "result": {"label": "Result"},
                                "defects": {"label": "Defects", "placeholder": "0"},
                            },
                        },
                        "issues": {
                            "label": "Issues",
                            "widget": "object-array",
                            "itemLabel": "Issue",
                            "itemFields": {
                                "severity": {"label": "Severity"},
                                "status": {"label": "Status", "placeholder": "OPEN"},
                                "title": {"label": "Title", "placeholder": "Issue title"},
                                "description": {
                                    "label": "Description",
                                    "widget": "textarea",
                                    "placeholder": "Describe the issue",
                                },
                            },
                        },
                    },
                },
            },
            "QUALITY_EVENT": {
                "fields": [
                    "currentPhase",
                    "completionPct",
                    "approvalRequired",
                    "deliverables",
                    "testResults",
                    "issues",
                    "milestoneRef",
                ],
                "required": ["currentPhase", "completionPct", "testResults"],
                "defaults": {
                    "currentPhase": "M1",
                    "completionPct": 0,
                    "approvalRequired": False,
                    "testResults": [{"result": "PASS", "defects": 0}],
                    "deliverables": [],
                    "issues": [],
                },
                "ui": {
                    "fieldOrder": [
                        "currentPhase",
                        "completionPct",
                        "approvalRequired",
                        "milestoneRef",
                        "deliverables",
                        "testResults",
                        "issues",
                    ],
                    "fields": {
                        "currentPhase": {"label": "Current phase", "placeholder": "M3"},
                        "completionPct": {"label": "Completion (%)", "placeholder": "92"},
                        "approvalRequired": {
                            "label": "Consumer approval required",
                            "widget": "toggle",
                        },
                        "milestoneRef": {
                            "label": "Milestone ref",
                            "placeholder": "Optional",
                        },
                        "deliverables": {
                            "label": "Deliverables",
                            "widget": "multiline-list",
                            "placeholder": "One deliverable per line",
                        },
                        "testResults": {
                            "label": "Test results",
                            "widget": "object-array",
                            "itemLabel": "Test",
                            "itemFields": {
                                "testName": {"label": "Test name", "placeholder": "e.g. Thermal endurance"},
                                "result": {"label": "Result"},
                                "defects": {"label": "Defects", "placeholder": "0"},
                            },
                        },
                        "issues": {
                            "label": "Issues",
                            "widget": "object-array",
                            "itemLabel": "Issue",
                            "itemFields": {
                                "severity": {"label": "Severity"},
                                "status": {"label": "Status", "placeholder": "OPEN"},
                                "title": {"label": "Title", "placeholder": "Issue title"},
                                "description": {
                                    "label": "Description",
                                    "widget": "textarea",
                                    "placeholder": "Describe the issue",
                                },
                            },
                        },
                    },
                },
            },
            "MILESTONE_COMPLETE": {
                "fields": [
                    "currentPhase",
                    "completionPct",
                    "approvalRequired",
                    "deliverables",
                    "testResults",
                    "issues",
                    "milestoneRef",
                ],
                "required": ["currentPhase", "completionPct", "milestoneRef"],
                "defaults": {
                    "currentPhase": "M1",
                    "completionPct": 100,
                    "approvalRequired": True,
                    "testResults": [{"result": "PASS", "defects": 0}],
                    "deliverables": [],
                    "issues": [],
                },
                "ui": {
                    "fieldOrder": [
                        "currentPhase",
                        "completionPct",
                        "approvalRequired",
                        "milestoneRef",
                        "deliverables",
                        "testResults",
                        "issues",
                    ],
                    "fields": {
                        "currentPhase": {"label": "Current phase", "placeholder": "M2"},
                        "completionPct": {"label": "Completion (%)", "placeholder": "100"},
                        "approvalRequired": {
                            "label": "Consumer approval required",
                            "widget": "toggle",
                        },
                        "milestoneRef": {
                            "label": "Milestone ref",
                            "placeholder": "Required, e.g. M2",
                        },
                        "deliverables": {
                            "label": "Deliverables",
                            "widget": "multiline-list",
                            "placeholder": "One deliverable per line",
                        },
                        "testResults": {
                            "label": "Test results",
                            "widget": "object-array",
                            "itemLabel": "Test",
                            "itemFields": {
                                "testName": {"label": "Test name", "placeholder": "e.g. System smoke"},
                                "result": {"label": "Result"},
                                "defects": {"label": "Defects", "placeholder": "0"},
                            },
                        },
                        "issues": {
                            "label": "Issues",
                            "widget": "object-array",
                            "itemLabel": "Issue",
                            "itemFields": {
                                "severity": {"label": "Severity"},
                                "status": {"label": "Status", "placeholder": "OPEN"},
                                "title": {"label": "Title", "placeholder": "Issue title"},
                                "description": {
                                    "label": "Description",
                                    "widget": "textarea",
                                    "placeholder": "Describe the issue",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

DEFAULT_PROFILE_BY_PILOT = {
    "FACTOR": ("FACTOR_DEFAULT", 1),
    "TASOWHEEL": ("TASOWHEEL_DEFAULT", 1),
    "E4M": ("E4M_DEFAULT", 1),
}


class IngestProfileService:
    @staticmethod
    def list_builtin_profiles() -> list[dict[str, Any]]:
        profiles: list[dict[str, Any]] = []
        for (profile_key, version), definition in BUILTIN_PROFILE_DEFINITIONS.items():
            resolved_spec = IngestProfileService.resolve_definition(
                profile_key=profile_key,
                version=version,
                factory_key=str(definition["factoryKey"]),
                pilot_type=str(definition["pilotType"]),
                definition=definition,
            )
            profiles.append(
                {
                    "profileKey": profile_key,
                    "factoryKey": definition["factoryKey"],
                    "pilotType": definition["pilotType"],
                    "version": version,
                    "status": definition.get("status", "ACTIVE"),
                    "source": "builtin",
                    "supportedUpdateTypes": resolved_spec["allowedUpdateTypes"],
                    "resolvedSpec": resolved_spec,
                    "description": definition.get("description"),
                }
            )
        return sorted(profiles, key=lambda item: (str(item["pilotType"]), str(item["profileKey"])))

    @staticmethod
    def resolve_definition(
        *,
        profile_key: str,
        version: int,
        factory_key: str,
        pilot_type: str,
        definition: dict[str, Any],
    ) -> dict[str, Any]:
        supported_update_types = definition.get("supportedUpdateTypes")
        if not isinstance(supported_update_types, list) or not supported_update_types:
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message="Profile definition must include supportedUpdateTypes.",
            )
        allowed_update_types = [str(item).upper() for item in supported_update_types]
        update_types = definition.get("updateTypes")
        if not isinstance(update_types, dict) or not update_types:
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message="Profile definition must include updateTypes.",
            )

        resolved_update_types: dict[str, Any] = {}
        for update_type in allowed_update_types:
            if update_type not in SUPPORTED_UPDATE_TYPES:
                raise ApiException(
                    status_code=422,
                    code="UNSUPPORTED_UPDATE_TYPE",
                    message=f"Unsupported update type '{update_type}'.",
                )

            update_type_definition = update_types.get(update_type)
            if not isinstance(update_type_definition, dict):
                raise ApiException(
                    status_code=422,
                    code="INVALID_PROFILE_DEFINITION",
                    message=f"Missing update type definition for '{update_type}'.",
                )

            resolved_update_types[update_type] = IngestProfileService._resolve_update_type_spec(
                update_type,
                update_type_definition,
            )

        return {
            "profileKey": profile_key,
            "factoryKey": factory_key,
            "pilotType": pilot_type.upper(),
            "schemaVersion": SCHEMA_VERSION,
            "allowedUpdateTypes": allowed_update_types,
            "updateTypes": resolved_update_types,
        }

    @staticmethod
    def _resolve_update_type_spec(
        update_type: str,
        definition: dict[str, Any],
    ) -> dict[str, Any]:
        field_catalog = STANDARD_FIELD_CATALOG[update_type]
        fields = definition.get("fields")
        if not isinstance(fields, list) or not fields:
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message=f"Update type '{update_type}' must define at least one field.",
            )
        field_names = [str(item) for item in fields]
        properties: dict[str, Any] = {}
        schema_overrides = definition.get("schemaOverrides", {})
        if schema_overrides is None:
            schema_overrides = {}
        if not isinstance(schema_overrides, dict):
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message=f"schemaOverrides for '{update_type}' must be an object.",
            )

        for field_name in field_names:
            if field_name not in field_catalog:
                raise ApiException(
                    status_code=422,
                    code="UNKNOWN_STANDARD_FIELD",
                    message=f"Field '{field_name}' is not available for update type '{update_type}'.",
                )
            properties[field_name] = copy.deepcopy(field_catalog[field_name])
            override_payload = schema_overrides.get(field_name)
            if isinstance(override_payload, dict):
                properties[field_name].update(copy.deepcopy(override_payload))

        required_fields = [str(item) for item in definition.get("required", [])]
        if not set(required_fields).issubset(set(field_names)):
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message=f"Required fields for '{update_type}' must be included in fields.",
            )

        defaults = copy.deepcopy(definition.get("defaults", {}))
        if not isinstance(defaults, dict):
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message=f"defaults for '{update_type}' must be an object.",
            )
        for field_name in field_names:
            field_default = properties[field_name].get("default")
            if field_name not in defaults and field_default is not None:
                defaults[field_name] = copy.deepcopy(field_default)

        ui = copy.deepcopy(definition.get("ui", {}))
        if not isinstance(ui, dict):
            raise ApiException(
                status_code=422,
                code="INVALID_PROFILE_DEFINITION",
                message=f"ui for '{update_type}' must be an object.",
            )
        if "fieldOrder" not in ui:
            ui["fieldOrder"] = list(field_names)

        return {
            "jsonSchema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "properties": properties,
                "required": required_fields,
                "additionalProperties": False,
            },
            "uiSchema": ui,
            "defaults": defaults,
        }

    @staticmethod
    def resolve_builtin_profile(
        profile_key: str,
        version: int,
    ) -> dict[str, Any]:
        definition = BUILTIN_PROFILE_DEFINITIONS.get((profile_key, version))
        if definition is None:
            raise ApiException(
                status_code=404,
                code="INGEST_PROFILE_NOT_FOUND",
                message="Ingest profile not found.",
            )
        return IngestProfileService.resolve_definition(
            profile_key=profile_key,
            version=version,
            factory_key=str(definition["factoryKey"]),
            pilot_type=str(definition["pilotType"]),
            definition=definition,
        )

    @staticmethod
    def resolve_default_profile_for_pilot(pilot_type: str | None) -> dict[str, Any]:
        if not pilot_type:
            raise ApiException(
                status_code=422,
                code="MISSING_PILOT_TYPE",
                message="Contract is missing a pilot type.",
            )
        profile_reference = DEFAULT_PROFILE_BY_PILOT.get(pilot_type.upper())
        if profile_reference is None:
            raise ApiException(
                status_code=404,
                code="INGEST_PROFILE_NOT_FOUND",
                message=f"No default ingest profile is registered for pilot type '{pilot_type}'.",
            )
        resolved_spec = IngestProfileService.resolve_builtin_profile(*profile_reference)
        resolved_spec["profileVersion"] = profile_reference[1]
        return resolved_spec

    @staticmethod
    async def create_profile(
        session: AsyncSession,
        *,
        profile_key: str,
        factory_key: str,
        pilot_type: str,
        version: int,
        status: str,
        description: str | None,
        definition: dict[str, Any],
    ) -> IngestProfile:
        existing = await IngestProfileService.get_profile(session, profile_key, version)
        if existing is not None:
            raise ApiException(
                status_code=409,
                code="INGEST_PROFILE_EXISTS",
                message="An ingest profile with this key and version already exists.",
            )

        resolved_spec = IngestProfileService.resolve_definition(
            profile_key=profile_key,
            version=version,
            factory_key=factory_key,
            pilot_type=pilot_type,
            definition=definition,
        )
        resolved_spec["profileVersion"] = version
        profile = IngestProfile(
            profile_key=profile_key,
            factory_key=factory_key,
            pilot_type=pilot_type.upper(),
            version=version,
            status=status.upper(),
            supported_update_types=list(resolved_spec["allowedUpdateTypes"]),
            profile_definition=copy.deepcopy(definition),
            resolved_spec=resolved_spec,
            description=description,
        )
        session.add(profile)
        return profile

    @staticmethod
    async def list_profiles(session: AsyncSession) -> list[IngestProfile]:
        result = await session.execute(
            select(IngestProfile).order_by(
                IngestProfile.pilot_type.asc(),
                IngestProfile.profile_key.asc(),
                IngestProfile.version.asc(),
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_profile(
        session: AsyncSession,
        profile_key: str,
        version: int,
    ) -> IngestProfile | None:
        result = await session.execute(
            select(IngestProfile).where(
                IngestProfile.profile_key == profile_key,
                IngestProfile.version == version,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    def bind_contract_snapshot(
        contract: Contract,
        resolved_spec: dict[str, Any],
        *,
        profile_id: Any | None = None,
    ) -> Contract:
        contract.ingest_profile_id = profile_id
        contract.ingest_profile_key = str(resolved_spec["profileKey"])
        contract.ingest_profile_version = int(resolved_spec["profileVersion"]) if "profileVersion" in resolved_spec else None
        contract.ingest_profile_snapshot = IngestProfileService._snapshot_with_contract_context(
            contract,
            resolved_spec,
        )
        return contract

    @staticmethod
    def bind_default_profile(contract: Contract) -> Contract:
        resolved_spec = IngestProfileService.resolve_default_profile_for_pilot(contract.pilot_type)
        return IngestProfileService.bind_contract_snapshot(contract, resolved_spec)

    @staticmethod
    def get_contract_snapshot(contract: Contract) -> dict[str, Any]:
        snapshot = copy.deepcopy(contract.ingest_profile_snapshot or {})
        if snapshot:
            if "profileVersion" not in snapshot and contract.ingest_profile_version is not None:
                snapshot["profileVersion"] = contract.ingest_profile_version
            if "profileKey" not in snapshot and contract.ingest_profile_key is not None:
                snapshot["profileKey"] = contract.ingest_profile_key
            if "schemaVersion" not in snapshot:
                snapshot["schemaVersion"] = SCHEMA_VERSION
            if "contractContext" not in snapshot:
                snapshot["contractContext"] = IngestProfileService._contract_context(contract)
            return snapshot

        resolved_spec = IngestProfileService.resolve_default_profile_for_pilot(contract.pilot_type)
        return IngestProfileService._snapshot_with_contract_context(contract, resolved_spec)

    @staticmethod
    def build_contract_spec(contract: Contract) -> dict[str, Any]:
        snapshot = IngestProfileService.get_contract_snapshot(contract)
        update_types: dict[str, Any] = {}
        for update_type, spec in dict(snapshot.get("updateTypes") or {}).items():
            json_schema = copy.deepcopy(spec.get("jsonSchema") or {})
            defaults = copy.deepcopy(spec.get("defaults") or {})
            initial_payload = IngestProfileService._build_initial_payload(
                contract,
                json_schema,
                defaults,
            )
            update_types[str(update_type)] = {
                "jsonSchema": json_schema,
                "uiSchema": copy.deepcopy(spec.get("uiSchema") or {}),
                "defaults": defaults,
                "initialPayload": initial_payload,
            }
        return {
            "contractId": contract_public_id(contract),
            "pilotType": contract.pilot_type,
            "profileKey": snapshot["profileKey"],
            "profileVersion": snapshot["profileVersion"],
            "schemaVersion": snapshot.get("schemaVersion", SCHEMA_VERSION),
            "allowedUpdateTypes": list(snapshot.get("allowedUpdateTypes") or []),
            "updateTypes": update_types,
            "contractContext": copy.deepcopy(snapshot.get("contractContext") or {}),
        }

    @staticmethod
    def validate_payload(
        contract: Contract,
        update_type: str,
        payload: dict[str, Any],
        *,
        provided_profile_version: int | None = None,
    ) -> tuple[dict[str, Any], int]:
        snapshot = IngestProfileService.get_contract_snapshot(contract)
        profile_version = int(snapshot["profileVersion"])
        if provided_profile_version is not None and provided_profile_version != profile_version:
            raise ApiException(
                status_code=409,
                code="PROFILE_VERSION_MISMATCH",
                message="Request profile version does not match the contract-bound profile version.",
            )

        normalized_update_type = update_type.upper()
        if normalized_update_type not in set(snapshot.get("allowedUpdateTypes") or []):
            raise ApiException(
                status_code=422,
                code="UNSUPPORTED_UPDATE_TYPE",
                message=f"Update type '{normalized_update_type}' is not allowed for this contract.",
            )

        spec = dict(snapshot.get("updateTypes") or {}).get(normalized_update_type)
        if not isinstance(spec, dict):
            raise ApiException(
                status_code=422,
                code="MISSING_UPDATE_SPEC",
                message=f"No ingest spec is defined for update type '{normalized_update_type}'.",
            )
        json_schema = dict(spec.get("jsonSchema") or {})
        errors = [
            IngestProfileService._format_validation_error(error)
            for error in Draft202012Validator(
                json_schema,
                format_checker=Draft202012Validator.FORMAT_CHECKER,
            ).iter_errors(payload)
        ]
        errors.sort(key=lambda item: (item["field"], item["message"]))
        if errors:
            raise ApiException(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Payload schema validation failed.",
                details=errors,
            )
        return snapshot, profile_version

    @staticmethod
    def serialize_builtin_profile(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "profileKey": item["profileKey"],
            "factoryKey": item["factoryKey"],
            "pilotType": item["pilotType"],
            "version": item["version"],
            "status": item["status"],
            "source": item["source"],
            "supportedUpdateTypes": item["supportedUpdateTypes"],
            "description": item.get("description"),
            "resolvedSpec": item["resolvedSpec"],
        }

    @staticmethod
    def serialize_profile(profile: IngestProfile) -> dict[str, Any]:
        resolved_spec = copy.deepcopy(profile.resolved_spec or {})
        resolved_spec["profileVersion"] = profile.version
        return {
            "profileKey": profile.profile_key,
            "factoryKey": profile.factory_key,
            "pilotType": profile.pilot_type,
            "version": profile.version,
            "status": profile.status,
            "source": "database",
            "supportedUpdateTypes": list(profile.supported_update_types or []),
            "description": profile.description,
            "resolvedSpec": resolved_spec,
        }

    @staticmethod
    def _snapshot_with_contract_context(
        contract: Contract,
        resolved_spec: dict[str, Any],
    ) -> dict[str, Any]:
        snapshot = copy.deepcopy(resolved_spec)
        snapshot["profileVersion"] = int(
            snapshot.get("profileVersion") or contract.ingest_profile_version or 1
        )
        snapshot["contractContext"] = IngestProfileService._contract_context(contract)
        return snapshot

    @staticmethod
    def _contract_context(contract: Contract) -> dict[str, Any]:
        config = dict(contract.config or {})
        context: dict[str, Any] = {}
        if config.get("quality_target") is not None:
            context["qualityTarget"] = config.get("quality_target")
        if config.get("dataUpdateFrequency") is not None:
            context["dataUpdateFrequency"] = config.get("dataUpdateFrequency")
        return context

    @staticmethod
    def _build_initial_payload(
        contract: Contract,
        json_schema: dict[str, Any],
        defaults: dict[str, Any],
    ) -> dict[str, Any]:
        config = dict(contract.config or {})
        last_known_state = dict(config.get("last_known_state") or {})
        initial_payload = copy.deepcopy(defaults)
        properties = dict(json_schema.get("properties") or {})
        for field_name in properties:
            if field_name in last_known_state:
                initial_payload[field_name] = copy.deepcopy(last_known_state[field_name])
        return initial_payload

    @staticmethod
    def _format_validation_error(error: ValidationError) -> dict[str, str]:
        path = ".".join(str(part) for part in error.absolute_path) if error.absolute_path else "$"
        field = "payload" if path == "$" else f"payload.{path}"
        return {
            "field": field,
            "message": error.message,
            "type": "json_schema",
        }


def select_ingest_profiles() -> Select[tuple[IngestProfile]]:
    return select(IngestProfile)

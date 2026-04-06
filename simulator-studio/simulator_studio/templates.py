from __future__ import annotations

import copy
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SCENARIO_DIR = REPO_ROOT / "mock-sensors" / "scenarios"


def _future_date(days_from_now: int) -> str:
    return (date.today() + timedelta(days=days_from_now)).isoformat()


def _load_scenario(scenario_key: str) -> dict[str, Any]:
    scenario_path = SCENARIO_DIR / f"{scenario_key}.json"
    payload = json.loads(scenario_path.read_text(encoding="utf-8"))
    return {
        "scenarioKey": scenario_key,
        "pilotType": scenario_key.split("_", 1)[0].upper(),
        "title": scenario_key.replace("_", " ").title(),
        "definition": payload,
        "updateTypes": sorted(
            {str(step.get("updateType", "")).upper() for step in payload.get("steps", []) if step.get("updateType")}
        ),
    }


def load_scenarios() -> list[dict[str, Any]]:
    return [_load_scenario(path.stem) for path in sorted(SCENARIO_DIR.glob("*.json"))]


def _field_ui(label: str, *, placeholder: str | None = None, help_text: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"label": label}
    if placeholder is not None:
        payload["placeholder"] = placeholder
    if help_text is not None:
        payload["helpText"] = help_text
    return payload


STARTER_TEMPLATES: dict[str, dict[str, Any]] = {
    "factor": {
        "templateKey": "factor",
        "name": "Factor Gear Machining Cell",
        "factoryKey": "factor",
        "pilotType": "FACTOR",
        "description": "Discrete machining workflow focused on throughput, quality, and milestone completion.",
        "providerClientId": "provider-factor-sa",
        "defaultProfileKey": "FACTOR_DEFAULT",
        "defaultProfileVersion": 1,
        "agreementType": "PRODUCTION_MONITORING",
        "productName": "Helical Gear Type A - Demo Batch",
        "quantityTotal": 1200,
        "deliveryDate": _future_date(90),
        "consumerId": "admin@test.com",
        "milestones": [
            {
                "milestoneRef": "TURNING",
                "name": "Turning",
                "plannedDate": _future_date(14),
                "approvalRequired": False,
                "completionCriteria": {"currentStage": "TURNING"},
            },
            {
                "milestoneRef": "INSPECTION",
                "name": "Inspection",
                "plannedDate": _future_date(45),
                "approvalRequired": True,
                "completionCriteria": {"currentStage": "INSPECTION"},
            },
        ],
        "sensors": [
            {
                "name": "Production Line Sensor",
                "sourceId": "factor-line-01",
                "updateType": "PRODUCTION_UPDATE",
                "intervalSeconds": 15.0,
                "scenarioKey": "factor_normal",
                "enabled": True,
            },
            {
                "name": "Quality Gate",
                "sourceId": "factor-quality-01",
                "updateType": "QUALITY_EVENT",
                "intervalSeconds": 30.0,
                "scenarioKey": "factor_quality_failure",
                "enabled": True,
            },
            {
                "name": "Milestone Gateway",
                "sourceId": "factor-milestone-01",
                "updateType": "MILESTONE_COMPLETE",
                "intervalSeconds": 45.0,
                "scenarioKey": "factor_milestone_complete",
                "enabled": False,
            },
        ],
        "profileDefinition": {
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
                        "quantityProduced": 0,
                        "quantityPlanned": 1200,
                        "currentStage": "TURNING",
                        "qualityPassRate": 0.99,
                        "machineUtilization": 0.82,
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
                        "fields": {
                            "quantityProduced": _field_ui("Quantity produced", placeholder="0"),
                            "quantityPlanned": _field_ui("Quantity planned", placeholder="0"),
                            "qualityPassRate": _field_ui("Quality pass rate", placeholder="0.99"),
                            "currentStage": _field_ui("Current stage"),
                            "machineUtilization": _field_ui("Machine utilization", placeholder="0.82"),
                            "qualityRejectCount": _field_ui("Reject count", placeholder="0"),
                            "shiftsCompleted": _field_ui("Shifts completed", placeholder="0"),
                            "estimatedCompletionDate": _field_ui("Estimated completion date", placeholder="2026-06-01"),
                            "milestoneRef": _field_ui("Milestone reference", placeholder="TURNING"),
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
                        "qualityRejectCount": 0,
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
                            "quantityProduced": _field_ui("Quantity produced", placeholder="0"),
                            "quantityPlanned": _field_ui("Quantity planned", placeholder="0"),
                            "qualityPassRate": _field_ui("Quality pass rate", placeholder="0.99"),
                            "qualityRejectCount": _field_ui("Reject count", placeholder="0"),
                            "currentStage": _field_ui("Current stage"),
                            "machineUtilization": _field_ui("Machine utilization", placeholder="0.82"),
                            "milestoneRef": _field_ui("Milestone reference", placeholder="TURNING"),
                        },
                    },
                },
                "MILESTONE_COMPLETE": {
                    "fields": [
                        "quantityProduced",
                        "currentStage",
                        "qualityPassRate",
                        "milestoneRef",
                    ],
                    "required": ["milestoneRef"],
                    "defaults": {
                        "currentStage": "INSPECTION",
                        "qualityPassRate": 0.99,
                    },
                    "ui": {
                        "fieldOrder": [
                            "milestoneRef",
                            "quantityProduced",
                            "currentStage",
                            "qualityPassRate",
                        ],
                        "fields": {
                            "milestoneRef": _field_ui("Milestone reference", placeholder="INSPECTION"),
                            "quantityProduced": _field_ui("Quantity produced", placeholder="0"),
                            "currentStage": _field_ui("Current stage"),
                            "qualityPassRate": _field_ui("Quality pass rate", placeholder="0.99"),
                        },
                    },
                },
            },
        },
    },
    "tasowheel": {
        "templateKey": "tasowheel",
        "name": "Tasowheel Routing Cell",
        "factoryKey": "tasowheel",
        "pilotType": "TASOWHEEL",
        "description": "Routing-centric pilot covering setup time, cycle time, and downtime monitoring.",
        "providerClientId": "provider-tasowheel-sa",
        "defaultProfileKey": "TASOWHEEL_DEFAULT",
        "defaultProfileVersion": 1,
        "agreementType": "ROUTING_EXECUTION",
        "productName": "Wheel Hub V3 Demo Batch",
        "quantityTotal": 240,
        "deliveryDate": _future_date(75),
        "consumerId": "admin@test.com",
        "milestones": [
            {
                "milestoneRef": "STEP_10",
                "name": "Blank Preparation",
                "plannedDate": _future_date(10),
                "approvalRequired": False,
                "completionCriteria": {"routingStep": 10},
            },
            {
                "milestoneRef": "STEP_40",
                "name": "Final Dispatch Check",
                "plannedDate": _future_date(38),
                "approvalRequired": True,
                "completionCriteria": {"routingStep": 40},
            },
        ],
        "sensors": [
            {
                "name": "Routing Tracker",
                "sourceId": "tasowheel-routing-01",
                "updateType": "PRODUCTION_UPDATE",
                "intervalSeconds": 20.0,
                "scenarioKey": "tasowheel_normal",
                "enabled": True,
            },
            {
                "name": "Downtime Monitor",
                "sourceId": "tasowheel-downtime-01",
                "updateType": "PRODUCTION_UPDATE",
                "intervalSeconds": 35.0,
                "scenarioKey": "tasowheel_downtime",
                "enabled": True,
            },
            {
                "name": "Completion Gateway",
                "sourceId": "tasowheel-milestone-01",
                "updateType": "MILESTONE_COMPLETE",
                "intervalSeconds": 50.0,
                "scenarioKey": "tasowheel_milestone_complete",
                "enabled": False,
            },
        ],
        "profileDefinition": {
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
                    "required": [
                        "routingStep",
                        "stepName",
                        "stepStatus",
                    ],
                    "defaults": {
                        "routingStep": 10,
                        "stepStatus": "IN_PROGRESS",
                        "setupTimeActualMin": 6.0,
                        "cycleTimeActualSec": 72.0,
                        "downtimeMinutes": 0.0,
                        "energyKwh": 18.0,
                        "carbonKgCo2e": 6.0,
                    },
                    "ui": {
                        "fieldOrder": [
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
                        "fields": {
                            "routingStep": _field_ui("Routing step", placeholder="10"),
                            "stepName": _field_ui("Step name", placeholder="Blank Preparation"),
                            "stepStatus": _field_ui("Step status"),
                            "setupTimeActualMin": _field_ui("Setup time (min)", placeholder="6.0"),
                            "cycleTimeActualSec": _field_ui("Cycle time (sec)", placeholder="72.0"),
                            "downtimeMinutes": _field_ui("Downtime (min)", placeholder="0.0"),
                            "energyKwh": _field_ui("Energy (kWh)", placeholder="18"),
                            "carbonKgCo2e": _field_ui("Carbon (kg CO2e)", placeholder="6"),
                            "milestoneRef": _field_ui("Milestone reference", placeholder="STEP_10"),
                        },
                    },
                },
                "MILESTONE_COMPLETE": {
                    "fields": [
                        "routingStep",
                        "stepName",
                        "stepStatus",
                        "milestoneRef",
                    ],
                    "required": ["milestoneRef", "stepStatus"],
                    "defaults": {
                        "stepStatus": "COMPLETE",
                    },
                    "ui": {
                        "fieldOrder": ["milestoneRef", "routingStep", "stepName", "stepStatus"],
                        "fields": {
                            "milestoneRef": _field_ui("Milestone reference", placeholder="STEP_40"),
                            "routingStep": _field_ui("Routing step", placeholder="40"),
                            "stepName": _field_ui("Step name", placeholder="Final Dispatch Check"),
                            "stepStatus": _field_ui("Step status"),
                        },
                    },
                },
            },
        },
    },
    "e4m": {
        "templateKey": "e4m",
        "name": "E4M Phase-Gated Program",
        "factoryKey": "e4m",
        "pilotType": "E4M",
        "description": "Program-style pilot tracking phases, test results, and approvals.",
        "providerClientId": "provider-e4m-sa",
        "defaultProfileKey": "E4M_DEFAULT",
        "defaultProfileVersion": 1,
        "agreementType": "PHASE_GATED_DELIVERY",
        "productName": "Modular Demonstrator Release 2",
        "quantityTotal": 4,
        "deliveryDate": _future_date(110),
        "consumerId": "admin@test.com",
        "milestones": [
            {
                "milestoneRef": "M1",
                "name": "Concept Freeze",
                "plannedDate": _future_date(21),
                "approvalRequired": False,
                "completionCriteria": {"currentPhase": "M1"},
            },
            {
                "milestoneRef": "M2",
                "name": "Subsystem Review",
                "plannedDate": _future_date(55),
                "approvalRequired": True,
                "completionCriteria": {"currentPhase": "M2"},
            },
        ],
        "sensors": [
            {
                "name": "Phase Tracker",
                "sourceId": "e4m-phase-01",
                "updateType": "PHASE_CHANGE",
                "intervalSeconds": 25.0,
                "scenarioKey": "e4m_normal",
                "enabled": True,
            },
            {
                "name": "Quality Gate",
                "sourceId": "e4m-quality-01",
                "updateType": "QUALITY_EVENT",
                "intervalSeconds": 40.0,
                "scenarioKey": "e4m_test_failure",
                "enabled": True,
            },
            {
                "name": "Milestone Gateway",
                "sourceId": "e4m-milestone-01",
                "updateType": "MILESTONE_COMPLETE",
                "intervalSeconds": 55.0,
                "scenarioKey": "e4m_milestone_complete",
                "enabled": False,
            },
        ],
        "profileDefinition": {
            "supportedUpdateTypes": ["PHASE_CHANGE", "QUALITY_EVENT", "MILESTONE_COMPLETE"],
            "updateTypes": {
                "PHASE_CHANGE": {
                    "fields": [
                        "currentPhase",
                        "completionPct",
                        "approvalRequired",
                        "deliverables",
                        "milestoneRef",
                    ],
                    "required": ["currentPhase", "completionPct"],
                    "defaults": {
                        "currentPhase": "M1",
                        "completionPct": 10,
                        "approvalRequired": False,
                    },
                    "ui": {
                        "fieldOrder": [
                            "currentPhase",
                            "completionPct",
                            "approvalRequired",
                            "deliverables",
                            "milestoneRef",
                        ],
                        "fields": {
                            "currentPhase": _field_ui("Current phase", placeholder="M1"),
                            "completionPct": _field_ui("Completion %", placeholder="10"),
                            "approvalRequired": _field_ui("Approval required"),
                            "deliverables": _field_ui("Deliverables"),
                            "milestoneRef": _field_ui("Milestone reference", placeholder="M1"),
                        },
                    },
                },
                "QUALITY_EVENT": {
                    "fields": [
                        "currentPhase",
                        "completionPct",
                        "approvalRequired",
                        "testResults",
                        "issues",
                        "milestoneRef",
                    ],
                    "required": ["currentPhase", "testResults"],
                    "defaults": {
                        "currentPhase": "M1",
                        "completionPct": 10,
                        "approvalRequired": True,
                    },
                    "ui": {
                        "fieldOrder": [
                            "currentPhase",
                            "completionPct",
                            "approvalRequired",
                            "testResults",
                            "issues",
                            "milestoneRef",
                        ],
                        "fields": {
                            "currentPhase": _field_ui("Current phase", placeholder="M1"),
                            "completionPct": _field_ui("Completion %", placeholder="10"),
                            "approvalRequired": _field_ui("Approval required"),
                            "testResults": _field_ui("Test results"),
                            "issues": _field_ui("Issues"),
                            "milestoneRef": _field_ui("Milestone reference", placeholder="M1"),
                        },
                    },
                },
                "MILESTONE_COMPLETE": {
                    "fields": [
                        "currentPhase",
                        "completionPct",
                        "approvalRequired",
                        "deliverables",
                        "milestoneRef",
                    ],
                    "required": ["milestoneRef"],
                    "defaults": {
                        "approvalRequired": True,
                    },
                    "ui": {
                        "fieldOrder": [
                            "milestoneRef",
                            "currentPhase",
                            "completionPct",
                            "approvalRequired",
                            "deliverables",
                        ],
                        "fields": {
                            "milestoneRef": _field_ui("Milestone reference", placeholder="M2"),
                            "currentPhase": _field_ui("Current phase", placeholder="M2"),
                            "completionPct": _field_ui("Completion %", placeholder="100"),
                            "approvalRequired": _field_ui("Approval required"),
                            "deliverables": _field_ui("Deliverables"),
                        },
                    },
                },
            },
        },
    },
}


def list_templates() -> list[dict[str, Any]]:
    return [copy.deepcopy(value) for _, value in sorted(STARTER_TEMPLATES.items())]


def get_template(template_key: str) -> dict[str, Any]:
    try:
        return copy.deepcopy(STARTER_TEMPLATES[template_key])
    except KeyError as exc:
        raise KeyError(f"Unknown template '{template_key}'.") from exc

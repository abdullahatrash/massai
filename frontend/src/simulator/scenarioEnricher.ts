import type { ScenarioDefinition, ScenarioStep } from "./runner";

export type RawScenarioStep = {
  evidence?: string[];
  payload: Record<string, unknown>;
  updateType: string;
};

export type RawScenarioFile = {
  initialPayload: Record<string, unknown>;
  scenario: string;
  steps: RawScenarioStep[];
};

const DEFAULT_DELAY_MS = 4000;

function formatScenarioName(key: string): string {
  const parts = key.split("_");
  // Drop pilot prefix (first part), capitalize the rest
  const descriptive = parts.slice(1);
  return descriptive
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatStepTitle(updateType: string, index: number): string {
  const label = updateType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return `${label} (step ${index + 1})`;
}

function summarizePayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload);
  if (keys.length === 0) return "Empty payload";
  if (keys.length <= 3) return `Updates: ${keys.join(", ")}`;
  return `Updates ${keys.length} fields: ${keys.slice(0, 3).join(", ")}...`;
}

function buildSummary(raw: RawScenarioFile): string {
  const updateTypes = [...new Set(raw.steps.map((s) => s.updateType))];
  return `${raw.steps.length} steps covering ${updateTypes.join(", ").toLowerCase().split("_").join(" ")}`;
}

export function enrichScenario(raw: RawScenarioFile): ScenarioDefinition {
  const key = raw.scenario;

  const steps: ScenarioStep[] = raw.steps.map((step, index) => ({
    delayMs: DEFAULT_DELAY_MS,
    description: summarizePayload(step.payload),
    evidence: step.evidence,
    id: `${key}-${index}`,
    payload: step.payload,
    title: formatStepTitle(step.updateType, index),
    updateType: step.updateType as ScenarioStep["updateType"],
  }));

  return {
    id: key,
    initialPayload: raw.initialPayload,
    name: formatScenarioName(key),
    steps,
    summary: buildSummary(raw),
  };
}

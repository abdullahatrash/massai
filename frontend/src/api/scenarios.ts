import { enrichScenario, type RawScenarioFile } from "../simulator/scenarioEnricher";
import type { ScenarioDefinition } from "../simulator/runner";

const SCENARIO_KEYS = [
  "e4m_delay",
  "e4m_dispute",
  "e4m_milestone_complete",
  "e4m_normal",
  "e4m_test_failure",
  "factor_delay",
  "factor_dispute",
  "factor_milestone_complete",
  "factor_normal",
  "factor_quality_failure",
  "tasowheel_dispute",
  "tasowheel_downtime",
  "tasowheel_milestone_complete",
  "tasowheel_normal",
] as const;

const scenarioCache = new Map<string, ScenarioDefinition>();

async function fetchRawScenario(
  key: string,
  signal?: AbortSignal,
): Promise<RawScenarioFile> {
  const response = await fetch(`/scenarios/${key}.json`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load scenario "${key}": ${response.status}`);
  }
  return response.json() as Promise<RawScenarioFile>;
}

export async function fetchScenariosForPilot(
  pilotType: string | null,
  signal?: AbortSignal,
): Promise<ScenarioDefinition[]> {
  const prefix = (pilotType ?? "").toLowerCase();
  if (!prefix) return [];

  const keys = SCENARIO_KEYS.filter((key) => key.startsWith(`${prefix}_`));
  const results: ScenarioDefinition[] = [];

  for (const key of keys) {
    const cached = scenarioCache.get(key);
    if (cached) {
      results.push(cached);
      continue;
    }

    try {
      const raw = await fetchRawScenario(key, signal);
      const enriched = enrichScenario(raw);
      scenarioCache.set(key, enriched);
      results.push(enriched);
    } catch {
      // Skip scenarios that fail to load
    }
  }

  return results;
}

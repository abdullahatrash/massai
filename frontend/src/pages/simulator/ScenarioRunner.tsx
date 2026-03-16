import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import type { SimulatorContract } from "./simulatorShared";
import {
  getProviderClientConfig,
  formatRunnerError,
  isPlaybackAbort,
  type ScenarioDefinition,
  type ScenarioStepResult,
  runScenarioPlayback,
} from "../../simulator/runner";
import { e4mScenarios } from "../../simulator/scenarios/e4m_scenarios";
import { factorScenarios } from "../../simulator/scenarios/factor_scenarios";
import { tasowheelScenarios } from "../../simulator/scenarios/tasowheel_scenarios";

type ScenarioRunnerProps = {
  contract: SimulatorContract;
  onPlaybackSettled: () => void;
};

type RunnerStatus = "completed" | "error" | "idle" | "running" | "stopped";

type ScenarioLogEntry = {
  id: string;
  level: "error" | "info" | "success";
  message: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
};

const SPEED_OPTIONS = [1, 10, 100] as const;

function getScenarioCatalog(pilotType: string | null): ScenarioDefinition[] {
  switch ((pilotType ?? "").toUpperCase()) {
    case "FACTOR":
      return factorScenarios;
    case "TASOWHEEL":
      return tasowheelScenarios;
    case "E4M":
      return e4mScenarios;
    default:
      return [];
  }
}

function createLogEntry(
  level: ScenarioLogEntry["level"],
  message: string,
  details?: {
    payload?: Record<string, unknown>;
    response?: Record<string, unknown>;
  },
): ScenarioLogEntry {
  return {
    id: `${level}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message,
    payload: details?.payload,
    response: details?.response,
  };
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function summarizeStepResult(result: ScenarioStepResult) {
  const alertSummary =
    result.alertDetails.length > 0
      ? result.alertDetails
          .map((alert) => `${alert.severity ?? "UNKNOWN"}: ${alert.description}`)
          .join(" | ")
      : "No new alerts detected.";

  return `Step ${result.currentStep}/${result.totalSteps} completed. ${result.step.title}. ${alertSummary}`;
}

export function ScenarioRunner({ contract, onPlaybackSettled }: ScenarioRunnerProps) {
  const scenarios = useMemo(() => getScenarioCatalog(contract.pilotType), [contract.pilotType]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id ?? "");
  const [speedIndex, setSpeedIndex] = useState(0);
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [currentStepLabel, setCurrentStepLabel] = useState("Choose a scenario to begin.");
  const [progressText, setProgressText] = useState(
    scenarios[0] ? `Step 0/${scenarios[0].steps.length}` : "No scenario selected.",
  );
  const [logs, setLogs] = useState<ScenarioLogEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  const speedMultiplier = SPEED_OPTIONS[speedIndex] ?? 10;
  const providerClient = getProviderClientConfig(contract.pilotType);

  useEffect(() => {
    setSelectedScenarioId(scenarios[0]?.id ?? "");
    setStatus("idle");
    setLogs([]);
    setCurrentStepLabel("Choose a scenario to begin.");
    setProgressText(scenarios[0] ? `Step 0/${scenarios[0].steps.length}` : "No scenario selected.");
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [contract.id, scenarios]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleRun = async () => {
    if (!selectedScenario || !providerClient) {
      return;
    }

    abortControllerRef.current?.abort();
    const nextController = new AbortController();
    abortControllerRef.current = nextController;

    startTransition(() => {
      setStatus("running");
      setLogs([
        createLogEntry(
          "info",
          `Starting ${selectedScenario.name} at ${speedMultiplier}x speed for ${contract.id}.`,
        ),
      ]);
      setCurrentStepLabel(selectedScenario.steps[0]?.description ?? "Scenario starting.");
      setProgressText(`Step 0/${selectedScenario.steps.length}`);
    });

    try {
      await runScenarioPlayback({
        contractId: contract.id,
        onStepStart: ({ currentStep, payload, step, totalSteps }) => {
          startTransition(() => {
            setCurrentStepLabel(`Pushing ${step.title.toLowerCase()}...`);
            setProgressText(`Step ${currentStep}/${totalSteps} - ${step.description}`);
            setLogs((currentLogs) => [
              ...currentLogs,
              createLogEntry(
                "info",
                `Step ${currentStep}/${totalSteps} - ${step.title}`,
                { payload },
              ),
            ]);
          });
        },
        onStepSuccess: (result) => {
          startTransition(() => {
            setProgressText(
              result.delayUntilNextStepMs > 0
                ? `Step ${result.currentStep}/${result.totalSteps} complete - waiting ${result.delayUntilNextStepMs}ms`
                : `Step ${result.currentStep}/${result.totalSteps} complete - final step reached`,
            );
            setCurrentStepLabel(
              result.delayUntilNextStepMs > 0
                ? "Waiting for the next playback interval."
                : "Playback complete.",
            );
            setLogs((currentLogs) => [
              ...currentLogs,
              createLogEntry("success", summarizeStepResult(result), {
                payload: result.payload,
                response: {
                  alertsTriggered: result.alertDetails.map((alert) => ({
                    description: alert.description,
                    severity: alert.severity,
                  })),
                  ...result.response,
                },
              }),
            ]);
          });
        },
        providerClient,
        scenario: selectedScenario,
        signal: nextController.signal,
        speedMultiplier,
      });

      startTransition(() => {
        setStatus("completed");
        setCurrentStepLabel("Scenario playback finished.");
        setLogs((currentLogs) => [
          ...currentLogs,
          createLogEntry("success", `${selectedScenario.name} finished successfully.`),
        ]);
      });
      onPlaybackSettled();
    } catch (error) {
      const message = formatRunnerError(error);
      const nextStatus: RunnerStatus = isPlaybackAbort(error) ? "stopped" : "error";
      startTransition(() => {
        setStatus(nextStatus);
        setCurrentStepLabel(message);
        setLogs((currentLogs) => [...currentLogs, createLogEntry("error", message)]);
      });
      onPlaybackSettled();
    } finally {
      if (abortControllerRef.current === nextController) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <section className="scenario-runner-grid">
      <article className="simulator-module-card scenario-controls-card">
        <div className="scenario-controls-header">
          <div>
            <span className="simulator-section-kicker">Scenarios</span>
            <h3>Automated playback</h3>
          </div>
          <span className={`scenario-status-pill ${status}`}>{status}</span>
        </div>

        <p className="scenario-summary">
          Select a prebuilt pilot scenario, choose a playback speed, and push updates into ingest
          with the provider service account for this contract.
        </p>

        {!providerClient && contract.pilotType ? (
          <div className="simulator-state-card simulator-state-card-error" role="alert">
            <h4>No provider configured</h4>
            <p>
              No provider service account is configured for pilot type &quot;{contract.pilotType}&quot;.
              Add credentials for this pilot in your environment.
            </p>
          </div>
        ) : null}

        <div className="scenario-choice-grid" role="radiogroup" aria-label="Scenario choices">
          {scenarios.length === 0 ? (
            <div className="simulator-state-card" role="status">
              <h4>No scenarios available</h4>
              <p>
                {contract.pilotType
                  ? `No prebuilt scenarios exist for pilot type "${contract.pilotType}".`
                  : "No pilot type is set for this contract."}
              </p>
            </div>
          ) : (
            scenarios.map((scenario) => (
              <button
                className={
                  scenario.id === selectedScenarioId
                    ? "scenario-choice-card active"
                    : "scenario-choice-card"
                }
                key={scenario.id}
                onClick={() => setSelectedScenarioId(scenario.id)}
                type="button"
              >
                <strong>{scenario.name}</strong>
                <span>{scenario.summary}</span>
                <span>{scenario.steps.length} steps</span>
              </button>
            ))
          )}
        </div>

        {selectedScenario ? (
          <div className="scenario-meta-card">
            <h4>Playback status</h4>
            <p>{progressText}</p>
            <p>{currentStepLabel}</p>
          </div>
        ) : null}

        <div className="scenario-speed-card">
          <div className="scenario-speed-labels">
            <span>Playback speed</span>
            <strong>{speedMultiplier}x</strong>
          </div>
          <input
            aria-label="Playback speed"
            max={SPEED_OPTIONS.length - 1}
            min={0}
            onChange={(event) => setSpeedIndex(Number(event.target.value))}
            step={1}
            type="range"
            value={speedIndex}
          />
          <div className="scenario-speed-ticks">
            {SPEED_OPTIONS.map((speed) => (
              <span key={speed}>{speed}x</span>
            ))}
          </div>
        </div>

        <div className="scenario-action-row">
          <button
            className="primary-button"
            disabled={!selectedScenario || status === "running" || !providerClient}
            onClick={() => void handleRun()}
            type="button"
          >
            Run
          </button>
          <button
            className="ghost-button simulator-button"
            disabled={status !== "running"}
            onClick={handleStop}
            type="button"
          >
            Stop
          </button>
        </div>
      </article>

      <article className="simulator-module-card scenario-log-card">
        <div className="scenario-controls-header">
          <div>
            <span className="simulator-section-kicker">Log</span>
            <h3>Runner output</h3>
          </div>
        </div>
        <div className="scenario-log-list">
          {logs.length === 0 ? (
            <div className="scenario-log-entry">
              <strong>No playback yet</strong>
              <p>Run a scenario to capture payloads, responses, and alert changes here.</p>
            </div>
          ) : (
            logs.map((entry) => (
              <div className={`scenario-log-entry ${entry.level}`} key={entry.id}>
                <strong>{entry.message}</strong>
                {entry.payload ? <pre>{prettyJson(entry.payload)}</pre> : null}
                {entry.response ? <pre>{prettyJson(entry.response)}</pre> : null}
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

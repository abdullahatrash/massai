import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Play, Square, TimerReset } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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

function getStatusDotClassName(status: RunnerStatus) {
  if (status === "completed") {
    return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]";
  }
  if (status === "error" || status === "stopped") {
    return "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]";
  }
  if (status === "running") {
    return "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)] animate-pulse";
  }

  return "bg-slate-500";
}

function getLogToneClassName(level: ScenarioLogEntry["level"]) {
  if (level === "success") {
    return "border-emerald-400/15 bg-emerald-400/[0.04]";
  }
  if (level === "error") {
    return "border-rose-400/15 bg-rose-400/[0.04]";
  }

  return "border-white/[0.06] bg-white/[0.02]";
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
    <div className="space-y-4">
      {/* ── Controls Panel ── */}
      <div className="sim-panel">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full", getStatusDotClassName(status))} />
            <h3 className="text-[0.82rem] font-semibold text-white">Scenario Playback</h3>
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{status}</span>
        </div>

        <div className="space-y-4 p-4">
          {!providerClient && contract.pilotType ? (
            <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-[0.72rem] text-rose-300">
              No provider service account configured for pilot type &ldquo;{contract.pilotType}&rdquo;.
            </div>
          ) : null}

          {/* Scenario selector */}
          <div className="grid gap-2">
            {scenarios.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[0.72rem] text-slate-500">
                {contract.pilotType
                  ? `No prebuilt scenarios for "${contract.pilotType}".`
                  : "No pilot type set."}
              </div>
            ) : (
              scenarios.map((scenario) => (
                <Button
                  className={cn(
                    "h-auto flex-col items-stretch rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/10 hover:bg-white/[0.04]",
                    scenario.id === selectedScenarioId && "border-white/12 bg-white/[0.06]",
                  )}
                  key={scenario.id}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  variant="ghost"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[0.78rem] font-medium text-white">{scenario.name}</span>
                    <Badge className="border-white/[0.06] bg-white/[0.04] text-[0.6rem] text-slate-500">
                      {scenario.steps.length} steps
                    </Badge>
                  </div>
                  <span className="mt-1.5 text-[0.7rem] leading-relaxed font-normal text-slate-400 whitespace-normal">{scenario.summary}</span>
                </Button>
              ))
            )}
          </div>

          {/* Status + Speed */}
          {selectedScenario ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <TimerReset className="size-3 text-slate-600" />
                  Status
                </div>
                <p className="mt-2 text-[0.78rem] font-medium text-white">{progressText}</p>
                <p className="mt-1 text-[0.68rem] text-slate-400">{currentStepLabel}</p>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Gauge className="size-3 text-slate-600" />
                  Speed
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-[1.2rem] font-semibold tabular-nums tracking-tight text-white">
                    {speedMultiplier}x
                  </p>
                  <p className="text-[0.62rem] text-slate-500">multiplier</p>
                </div>
                <Slider
                  className="mt-3"
                  max={SPEED_OPTIONS.length - 1}
                  min={0}
                  onValueChange={(values) =>
                    setSpeedIndex(Array.isArray(values) ? (values[0] ?? 0) : values)
                  }
                  step={1}
                  value={[speedIndex]}
                />
                <div className="mt-2 flex justify-between text-[0.58rem] uppercase tracking-[0.14em] text-slate-600">
                  {SPEED_OPTIONS.map((speed) => (
                    <span key={speed}>{speed}x</span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              disabled={!selectedScenario || status === "running" || !providerClient}
              onClick={() => void handleRun()}
              size="sm"
              type="button"
            >
              <Play data-icon="inline-start" />
              Run scenario
            </Button>
            <Button
              disabled={status !== "running"}
              onClick={handleStop}
              size="sm"
              type="button"
              variant="outline"
            >
              <Square data-icon="inline-start" />
              Stop
            </Button>
          </div>
        </div>
      </div>

      {/* ── Runner Log ── */}
      <div className="sim-panel">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[0.82rem] font-semibold text-white">Runner Output</h3>
        </div>
        <div className="p-3">
          <ScrollArea className="h-[28rem] pr-2">
            <div className="grid gap-2">
              {logs.length === 0 ? (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center">
                  <p className="text-[0.78rem] font-medium text-slate-400">No playback yet</p>
                  <p className="mt-1 text-[0.68rem] text-slate-600">
                    Run a scenario to capture output here.
                  </p>
                </div>
              ) : (
                logs.map((entry) => (
                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      getLogToneClassName(entry.level),
                    )}
                    key={entry.id}
                  >
                    <p className="text-[0.75rem] font-medium text-slate-200">{entry.message}</p>
                    {entry.payload ? (
                      <pre className="mt-2 overflow-x-auto rounded-md border border-white/[0.06] bg-black/20 p-2.5 text-[0.62rem] leading-relaxed text-slate-400">
                        {prettyJson(entry.payload)}
                      </pre>
                    ) : null}
                    {entry.response ? (
                      <pre className="mt-2 overflow-x-auto rounded-md border border-white/[0.06] bg-black/20 p-2.5 text-[0.62rem] leading-relaxed text-slate-400">
                        {prettyJson(entry.response)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

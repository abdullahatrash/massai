import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Play, Square, TimerReset } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function getStatusBadgeClassName(status: RunnerStatus) {
  if (status === "completed") {
    return "border-emerald-300/25 bg-emerald-300/12 text-emerald-50";
  }
  if (status === "error" || status === "stopped") {
    return "border-rose-300/25 bg-rose-300/12 text-rose-100";
  }
  if (status === "running") {
    return "border-cyan-300/25 bg-cyan-300/12 text-cyan-50";
  }

  return "border-white/12 bg-white/8 text-white/75";
}

function getLogToneClassName(level: ScenarioLogEntry["level"]) {
  if (level === "success") {
    return "border-emerald-300/18 bg-emerald-400/[0.06]";
  }
  if (level === "error") {
    return "border-rose-300/18 bg-rose-400/[0.06]";
  }

  return "border-white/10 bg-white/[0.03]";
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
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-white/10 bg-white/[0.045] text-white shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/8 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="border-white/12 bg-white/8 text-white/70">Scenarios</Badge>
              <CardTitle className="mt-4 text-2xl text-white">Automated playback</CardTitle>
              <CardDescription className="mt-3 max-w-2xl text-slate-300">
                Select a pilot scenario, tune playback speed, and stream the scripted steps into
                ingest using the configured provider service account.
              </CardDescription>
            </div>
            <Badge className={getStatusBadgeClassName(status)}>{status}</Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 pt-5">
          {!providerClient && contract.pilotType ? (
            <div className="rounded-[28px] border border-rose-300/15 bg-rose-950/25 p-4 text-sm text-rose-100">
              No provider service account is configured for pilot type "{contract.pilotType}".
            </div>
          ) : null}

          <div className="grid gap-3">
            {scenarios.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                {contract.pilotType
                  ? `No prebuilt scenarios exist for pilot type "${contract.pilotType}".`
                  : "No pilot type is set for this contract."}
              </div>
            ) : (
              scenarios.map((scenario) => (
                <button
                  className={cn(
                    "rounded-[28px] border border-white/10 bg-slate-950/45 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.08]",
                    scenario.id === selectedScenarioId ? "border-white/18 bg-white/[0.11]" : null,
                  )}
                  key={scenario.id}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base font-semibold text-white">{scenario.name}</p>
                    <Badge className="border-white/12 bg-white/8 text-white/70">
                      {scenario.steps.length} steps
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{scenario.summary}</p>
                </button>
              ))
            )}
          </div>

          {selectedScenario ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <TimerReset className="text-slate-500" />
                  Playback status
                </div>
                <p className="mt-4 text-base font-semibold text-white">{progressText}</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">{currentStepLabel}</p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <Gauge className="text-slate-500" />
                  Playback speed
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold tracking-[-0.04em] text-white">
                    {speedMultiplier}x
                  </p>
                  <p className="text-sm text-slate-300">Interval multiplier</p>
                </div>
                <Slider
                  className="mt-5"
                  max={SPEED_OPTIONS.length - 1}
                  min={0}
                  onValueChange={(values) =>
                    setSpeedIndex(Array.isArray(values) ? (values[0] ?? 0) : values)
                  }
                  step={1}
                  value={[speedIndex]}
                />
                <div className="mt-3 flex justify-between gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {SPEED_OPTIONS.map((speed) => (
                    <span key={speed}>{speed}x</span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!selectedScenario || status === "running" || !providerClient}
              onClick={() => void handleRun()}
              type="button"
            >
              <Play data-icon="inline-start" />
              Run scenario
            </Button>
            <Button
              disabled={status !== "running"}
              onClick={handleStop}
              type="button"
              variant="outline"
            >
              <Square data-icon="inline-start" />
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.045] text-white shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/8 pb-4">
          <Badge className="border-white/12 bg-white/8 text-white/70">Log</Badge>
          <CardTitle className="text-2xl text-white">Runner output</CardTitle>
          <CardDescription className="text-slate-300">
            Payloads, responses, and scenario-side alerts stream here as each playback step
            executes.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ScrollArea className="h-[35rem] pr-3">
            <div className="grid gap-3">
              {logs.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-base font-semibold text-white">No playback yet</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Run a scenario to capture payloads, responses, and alert changes here.
                  </p>
                </div>
              ) : (
                logs.map((entry) => (
                  <div
                    className={cn(
                      "rounded-[28px] border p-4",
                      getLogToneClassName(entry.level),
                    )}
                    key={entry.id}
                  >
                    <p className="text-sm font-semibold text-white">{entry.message}</p>
                    {entry.payload ? (
                      <pre className="mt-3 overflow-x-auto rounded-[22px] border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-200">
                        {prettyJson(entry.payload)}
                      </pre>
                    ) : null}
                    {entry.response ? (
                      <pre className="mt-3 overflow-x-auto rounded-[22px] border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-200">
                        {prettyJson(entry.response)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  );
}

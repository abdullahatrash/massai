import { startTransition, useEffect, useRef, useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import {
  type ProviderClientConfig,
  type ScenarioDefinition,
  type ScenarioStepResult,
  runContinuousPlayback,
  formatRunnerError,
  isPlaybackAbort,
} from "../../simulator/runner";

type SensorPanelProps = {
  contractId: string;
  onRemove: () => void;
  profileVersion?: number;
  providerClient: ProviderClientConfig;
  quantityOverride?: number;
  scenarios: ScenarioDefinition[];
  sensorIndex: number;
};

type SensorStatus = "error" | "idle" | "running" | "stopped";

const SPEED_OPTIONS = [1, 10, 100] as const;

function getStatusColor(status: SensorStatus) {
  if (status === "running") return "bg-cyan-400 animate-pulse";
  if (status === "error" || status === "stopped") return "bg-rose-400";
  return "bg-slate-500";
}

export function SensorPanel({
  contractId,
  onRemove,
  profileVersion,
  providerClient,
  quantityOverride,
  scenarios,
  sensorIndex,
}: SensorPanelProps) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    scenarios[0]?.id ?? "",
  );
  const [sourceId, setSourceId] = useState(
    `${contractId}-sensor-${sensorIndex}`,
  );
  const [speedIndex, setSpeedIndex] = useState(0);
  const [status, setStatus] = useState<SensorStatus>("idle");
  const [cycleCount, setCycleCount] = useState(0);
  const [lastStep, setLastStep] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const selectedScenario =
    scenarios.find((s) => s.id === selectedScenarioId) ?? null;
  const speedMultiplier = SPEED_OPTIONS[speedIndex] ?? 1;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStart = async () => {
    if (!selectedScenario) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    startTransition(() => {
      setStatus("running");
      setCycleCount(0);
      setLastStep("Starting...");
    });

    try {
      await runContinuousPlayback({
        contractId,
        profileVersion,
        providerClient,
        quantityOverride,
        scenario: selectedScenario,
        signal: controller.signal,
        speedMultiplier,
        onStepStart: ({ currentStep, step, totalSteps }) => {
          startTransition(() => {
            setLastStep(`Step ${currentStep}/${totalSteps} — ${step.title}`);
          });
        },
        onStepSuccess: (_result: ScenarioStepResult) => {},
        onCycleComplete: (cycle) => {
          startTransition(() => setCycleCount(cycle));
        },
      });
    } catch (error) {
      const nextStatus: SensorStatus = isPlaybackAbort(error)
        ? "stopped"
        : "error";
      startTransition(() => {
        setStatus(nextStatus);
        setLastStep(formatRunnerError(error));
      });
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", getStatusColor(status))} />
          <span className="text-[0.78rem] font-medium text-white">
            Sensor {sensorIndex + 1}
          </span>
          {cycleCount > 0 && (
            <Badge className="border-cyan-400/20 bg-cyan-400/8 text-[0.55rem] text-cyan-300">
              {cycleCount} cycles
            </Badge>
          )}
        </div>
        <button
          className="rounded p-1 text-slate-600 hover:bg-white/[0.06] hover:text-rose-400"
          disabled={status === "running"}
          onClick={onRemove}
          type="button"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[0.6rem] uppercase tracking-wider text-slate-500">
            Source ID
          </label>
          <Input
            className="h-7 bg-white/[0.03] text-[0.72rem]"
            disabled={status === "running"}
            onChange={(e) => setSourceId(e.target.value)}
            value={sourceId}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[0.6rem] uppercase tracking-wider text-slate-500">
            Scenario
          </label>
          <select
            className="h-7 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[0.72rem] text-white"
            disabled={status === "running"}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            value={selectedScenarioId}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[0.6rem] uppercase tracking-wider text-slate-500">
            Speed
          </label>
          <div className="flex items-center gap-2">
            <Slider
              className="flex-1"
              disabled={status === "running"}
              max={SPEED_OPTIONS.length - 1}
              min={0}
              onValueChange={(v) =>
                setSpeedIndex(Array.isArray(v) ? (v[0] ?? 0) : v)
              }
              step={1}
              value={[speedIndex]}
            />
            <span className="text-[0.68rem] font-medium tabular-nums text-white">
              {speedMultiplier}x
            </span>
          </div>
        </div>
      </div>

      {lastStep && (
        <p className="text-[0.65rem] text-slate-400 truncate">{lastStep}</p>
      )}

      <div className="flex gap-2">
        <Button
          disabled={!selectedScenario || status === "running"}
          onClick={() => void handleStart()}
          size="sm"
          type="button"
        >
          <Play data-icon="inline-start" />
          Start
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
  );
}

import { startTransition, useEffect, useState } from "react";
import { ArrowUpRight, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { qualityRatioToPercent } from "@/lib/quality";
import {
  DocumentReferenceEditor,
  createDocumentReferenceDraft,
  serializeDocumentReferenceDrafts,
  type DocumentReferenceDraft,
  type DocumentReferenceDraftErrors,
} from "@/components/DocumentReferenceEditor";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiRequest, ApiError } from "../../api/client";
import {
  deriveAlertRuleId,
  fetchSimulatorAlerts,
  fetchSimulatorMilestones,
  formatRunnerError,
  getProviderClientConfig,
  submitSimulatorUpdate,
  type SimulatorAlert,
  type SimulatorMilestoneSummary,
} from "../../simulator/runner";
import { E4mForm } from "./forms/E4mForm";
import { FactorForm } from "./forms/FactorForm";
import { TasowheelForm } from "./forms/TasowheelForm";
import { getPilotMeta, getPilotTheme, type SimulatorContract } from "./simulatorShared";

type ManualSendFormProps = {
  contract: SimulatorContract;
  onSubmitSettled: () => void;
};

type ContractOverview = {
  id: string;
  lastKnownState: Record<string, unknown>;
  qualityTarget?: number | null;
};

type UpdateType = "MILESTONE_COMPLETE" | "PHASE_CHANGE" | "PRODUCTION_UPDATE" | "QUALITY_EVENT";

type FactorFormValues = {
  currentStage: string;
  machineUtilization: string;
  milestoneRef: string;
  qualityPassRate: string;
  qualityRejectCount: string;
  quantityPlanned: string;
  quantityProduced: string;
  shiftsCompleted: string;
};

type TasowheelFormValues = {
  carbonKgCo2e: string;
  cycleTimeActualSec: string;
  downtimeMinutes: string;
  energyKwh: string;
  milestoneRef: string;
  routingStep: string;
  setupTimeActualMin: string;
  stepName: string;
  stepStatus: string;
};

type E4mTestResult = {
  defects: string;
  id: string;
  result: string;
  testName: string;
};

type E4mFormValues = {
  approvalRequired: boolean;
  completionPct: string;
  currentPhase: string;
  deliverables: string;
  milestoneRef: string;
  testResults: E4mTestResult[];
};

type ManualFormValues = E4mFormValues | FactorFormValues | TasowheelFormValues;

type ResponsePanelState = {
  alertsTriggered: string[];
  httpStatus: number;
  milestoneUpdated: string | null;
  response: Record<string, unknown>;
};

function parseString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseNumberString(value: unknown, fallback: string) {
  return typeof value === "number" ? String(value) : typeof value === "string" ? value : fallback;
}

function parseLocaleNumber(value: string) {
  return Number(value.trim().replace(",", "."));
}

function formatInputPercent(value: unknown, fallback: string) {
  const percent = qualityRatioToPercent(typeof value === "number" ? value : null);
  if (percent === null) {
    return fallback;
  }

  const roundedPercent = Math.round(percent * 10) / 10;
  return Number.isInteger(roundedPercent) ? String(roundedPercent) : String(roundedPercent);
}

function createEmptyTestResult(): E4mTestResult {
  return {
    defects: "0",
    id: `test-${crypto.randomUUID()}`,
    result: "PASS",
    testName: "",
  };
}

function buildInitialFactorValues(lastKnownState: Record<string, unknown>): FactorFormValues {
  return {
    currentStage: parseString(lastKnownState.currentStage, "TURNING"),
    machineUtilization: parseNumberString(lastKnownState.machineUtilization, "0.8"),
    milestoneRef: parseString(lastKnownState.milestoneRef),
    qualityPassRate: formatInputPercent(lastKnownState.qualityPassRate, "99"),
    qualityRejectCount: parseNumberString(lastKnownState.qualityRejectCount, "0"),
    quantityPlanned: parseNumberString(lastKnownState.quantityPlanned, "12000"),
    quantityProduced: parseNumberString(lastKnownState.quantityProduced, "0"),
    shiftsCompleted: parseNumberString(lastKnownState.shiftsCompleted, "0"),
  };
}

function buildInitialTasowheelValues(
  lastKnownState: Record<string, unknown>,
): TasowheelFormValues {
  return {
    carbonKgCo2e: parseNumberString(lastKnownState.carbonKgCo2e, "0"),
    cycleTimeActualSec: parseNumberString(lastKnownState.cycleTimeActualSec, "0"),
    downtimeMinutes: parseNumberString(lastKnownState.downtimeMinutes, "0"),
    energyKwh: parseNumberString(lastKnownState.energyKwh, "0"),
    milestoneRef: parseString(lastKnownState.milestoneRef),
    routingStep: parseNumberString(lastKnownState.routingStep, "10"),
    setupTimeActualMin: parseNumberString(lastKnownState.setupTimeActualMin, "0"),
    stepName: parseString(lastKnownState.stepName, "Blank Preparation"),
    stepStatus: parseString(lastKnownState.stepStatus, "IN_PROGRESS"),
  };
}

function buildInitialE4mValues(lastKnownState: Record<string, unknown>): E4mFormValues {
  const deliverables = Array.isArray(lastKnownState.deliverables)
    ? lastKnownState.deliverables.filter((item): item is string => typeof item === "string")
    : [];
  const testResults = Array.isArray(lastKnownState.testResults)
    ? lastKnownState.testResults
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((result) => ({
          defects: parseNumberString(result.defects, "0"),
          id: `test-${crypto.randomUUID()}`,
          result: parseString(result.result, "PASS"),
          testName: parseString(result.testName),
        }))
    : [];

  return {
    approvalRequired:
      typeof lastKnownState.approvalRequired === "boolean"
        ? lastKnownState.approvalRequired
        : false,
    completionPct: parseNumberString(lastKnownState.completionPct, "0"),
    currentPhase: parseString(lastKnownState.currentPhase, "M1"),
    deliverables: deliverables.join("\n"),
    milestoneRef: parseString(lastKnownState.milestoneRef),
    testResults: testResults.length > 0 ? testResults : [createEmptyTestResult()],
  };
}

function buildInitialFormValues(
  pilotType: string | null,
  lastKnownState: Record<string, unknown>,
): ManualFormValues {
  switch ((pilotType ?? "").toUpperCase()) {
    case "FACTOR":
      return buildInitialFactorValues(lastKnownState);
    case "TASOWHEEL":
      return buildInitialTasowheelValues(lastKnownState);
    case "E4M":
      return buildInitialE4mValues(lastKnownState);
    default:
      return buildInitialFactorValues(lastKnownState);
  }
}

function compareMilestones(
  previousMilestones: SimulatorMilestoneSummary[],
  nextMilestones: SimulatorMilestoneSummary[],
) {
  const previousIndex = new Map(
    previousMilestones.map((milestone) => [milestone.id, milestone.status ?? "UNKNOWN"]),
  );
  const changedMilestone = nextMilestones.find(
    (milestone) => previousIndex.get(milestone.id) !== (milestone.status ?? "UNKNOWN"),
  );

  if (!changedMilestone) {
    return null;
  }

  return `${changedMilestone.milestoneRef ?? changedMilestone.name ?? changedMilestone.id}: ${changedMilestone.status ?? "UNKNOWN"}`;
}

function deriveAlertRules(alerts: SimulatorAlert[]) {
  return Array.from(new Set(alerts.map((alert) => deriveAlertRuleId(alert))));
}

function parseLineList(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateFactorForm(values: FactorFormValues) {
  const errors: Record<string, string> = {};

  const quantityProduced = parseLocaleNumber(values.quantityProduced);
  if (!Number.isFinite(quantityProduced) || quantityProduced < 0) {
    errors.quantityProduced = "Quantity produced must be 0 or greater.";
  }

  const quantityPlanned = parseLocaleNumber(values.quantityPlanned);
  if (!Number.isFinite(quantityPlanned) || quantityPlanned < 0) {
    errors.quantityPlanned = "Quantity planned must be 0 or greater.";
  }

  const qualityPassRatePct = parseLocaleNumber(values.qualityPassRate);
  if (!Number.isFinite(qualityPassRatePct) || qualityPassRatePct < 0 || qualityPassRatePct > 100) {
    errors.qualityPassRate = "Quality pass rate must stay between 0 and 100.";
  }

  const machineUtilization = parseLocaleNumber(values.machineUtilization);
  if (
    values.machineUtilization &&
    (!Number.isFinite(machineUtilization) || machineUtilization < 0 || machineUtilization > 1)
  ) {
    errors.machineUtilization = "Machine utilization must stay between 0 and 1.";
  }

  if (!values.currentStage) {
    errors.currentStage = "Current stage is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  return {
    errors,
      payload: {
        currentStage: values.currentStage,
        ...(values.machineUtilization ? { machineUtilization } : {}),
        ...(values.milestoneRef.trim() ? { milestoneRef: values.milestoneRef.trim() } : {}),
        qualityPassRate: qualityPassRatePct / 100,
        ...(values.qualityRejectCount
          ? { qualityRejectCount: parseLocaleNumber(values.qualityRejectCount) }
          : {}),
        quantityPlanned,
        quantityProduced,
        ...(values.shiftsCompleted
          ? { shiftsCompleted: parseLocaleNumber(values.shiftsCompleted) }
          : {}),
      },
    };
}

function validateTasowheelForm(values: TasowheelFormValues) {
  const errors: Record<string, string> = {};

  const routingStep = parseLocaleNumber(values.routingStep);
  if (!Number.isFinite(routingStep) || routingStep < 0) {
    errors.routingStep = "Routing step must be 0 or greater.";
  }

  if (!values.stepName.trim()) {
    errors.stepName = "Step name is required.";
  }

  if (!values.stepStatus) {
    errors.stepStatus = "Step status is required.";
  }

  for (const fieldName of [
    "setupTimeActualMin",
    "cycleTimeActualSec",
    "downtimeMinutes",
    "energyKwh",
    "carbonKgCo2e",
  ] as const) {
    const rawValue = values[fieldName];
    if (!rawValue) {
      continue;
    }

    const parsedValue = parseLocaleNumber(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      errors[fieldName] = "Value must be 0 or greater.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      ...(values.carbonKgCo2e ? { carbonKgCo2e: parseLocaleNumber(values.carbonKgCo2e) } : {}),
      ...(values.cycleTimeActualSec ? { cycleTimeActualSec: parseLocaleNumber(values.cycleTimeActualSec) } : {}),
      ...(values.downtimeMinutes ? { downtimeMinutes: parseLocaleNumber(values.downtimeMinutes) } : {}),
      ...(values.energyKwh ? { energyKwh: parseLocaleNumber(values.energyKwh) } : {}),
      ...(values.milestoneRef.trim() ? { milestoneRef: values.milestoneRef.trim() } : {}),
      routingStep,
      ...(values.setupTimeActualMin ? { setupTimeActualMin: parseLocaleNumber(values.setupTimeActualMin) } : {}),
      stepName: values.stepName.trim(),
      stepStatus: values.stepStatus,
    },
  };
}

function validateE4mForm(values: E4mFormValues) {
  const errors: Record<string, string> = {};

  if (!/^M[1-6](?:_[A-Z0-9]+)*$/.test(values.currentPhase)) {
    errors.currentPhase = "Current phase must be between M1 and M6.";
  }

  const rawCompletion = parseLocaleNumber(values.completionPct);
  const completionPct = Number.isFinite(rawCompletion) ? Math.round(rawCompletion) : NaN;
  if (completionPct < 0 || completionPct > 100) {
    errors.completionPct = "Completion percent must be between 0 and 100.";
  }

  values.testResults.forEach((result, index) => {
    const defects = parseLocaleNumber(result.defects);
    if (!Number.isFinite(defects) || defects < 0) {
      errors[`testResults.${index}`] = "Defects must be 0 or greater.";
    }
  });

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      approvalRequired: values.approvalRequired,
      completionPct,
      currentPhase: values.currentPhase,
      ...(values.deliverables.trim()
        ? { deliverables: parseLineList(values.deliverables) }
        : {}),
      ...(values.milestoneRef.trim() ? { milestoneRef: values.milestoneRef.trim() } : {}),
      testResults: values.testResults.map((result) => ({
        defects: parseLocaleNumber(result.defects),
        result: result.result,
        ...(result.testName.trim() ? { testName: result.testName.trim() } : {}),
      })),
    },
  };
}

export function ManualSendForm({ contract, onSubmitSettled }: ManualSendFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateType, setUpdateType] = useState<UpdateType>("PRODUCTION_UPDATE");
  const [formValues, setFormValues] = useState<ManualFormValues>(buildInitialFormValues(contract.pilotType, {}));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [responsePanel, setResponsePanel] = useState<ResponsePanelState | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [documentDrafts, setDocumentDrafts] = useState<DocumentReferenceDraft[]>([]);
  const [documentDraftErrors, setDocumentDraftErrors] = useState<DocumentReferenceDraftErrors>({});
  const [qualityTarget, setQualityTarget] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadInitialState() {
      setIsLoading(true);
      setRequestError(null);

      try {
        const overview = await apiRequest<ContractOverview>(`/api/v1/contracts/${contract.id}`, {
          signal: controller.signal,
        });
        if (!isActive) {
          return;
        }

        startTransition(() => {
          setFormValues(buildInitialFormValues(contract.pilotType, overview.lastKnownState ?? {}));
          setQualityTarget(overview.qualityTarget ?? null);
          setDocumentDrafts([]);
          setDocumentDraftErrors({});
          setErrors({});
          setResponsePanel(null);
          setIsLoading(false);
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        startTransition(() => {
          setRequestError(
            error instanceof ApiError
              ? error.message
              : "Unable to load the last known state for this contract.",
          );
          setIsLoading(false);
        });
      }
    }

    void loadInitialState();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [contract.id, contract.pilotType]);

  useEffect(() => {
    if (updateType !== "MILESTONE_COMPLETE" && Object.keys(documentDraftErrors).length > 0) {
      setDocumentDraftErrors({});
    }
  }, [documentDraftErrors, updateType]);

  const providerClient = getProviderClientConfig(contract.pilotType);

  const handleSubmit = async () => {
    const pilotKey = (contract.pilotType ?? "").toUpperCase();
    const validationResult =
      pilotKey === "FACTOR"
        ? validateFactorForm(formValues as FactorFormValues)
        : pilotKey === "TASOWHEEL"
          ? validateTasowheelForm(formValues as TasowheelFormValues)
          : pilotKey === "E4M"
            ? validateE4mForm(formValues as E4mFormValues)
            : {
                errors: {
                  pilotType: `No form available for pilot type "${contract.pilotType ?? "unknown"}".`,
                },
                payload: null,
              };

    if (!validationResult.payload) {
      startTransition(() => {
        setErrors(validationResult.errors);
        setResponsePanel(null);
      });
      return;
    }

    const serializedEvidence =
      updateType === "MILESTONE_COMPLETE"
        ? serializeDocumentReferenceDrafts(documentDrafts)
        : { documents: [], errorsById: {}, hasErrors: false };
    if (serializedEvidence.hasErrors) {
      startTransition(() => {
        setDocumentDraftErrors(serializedEvidence.errorsById);
      });
      return;
    }

    if (!providerClient) {
      startTransition(() => {
        setRequestError("No provider service account is configured for this pilot.");
      });
      return;
    }

    const controller = new AbortController();
    setIsSubmitting(true);
    setRequestError(null);
    setDocumentDraftErrors({});

    try {
      const [beforeAlerts, beforeMilestones] = await Promise.all([
        fetchSimulatorAlerts(contract.id, controller.signal),
        fetchSimulatorMilestones(contract.id, controller.signal),
      ]);

      const body = {
        evidence: serializedEvidence.documents,
        payload: validationResult.payload,
        sensorId: `${contract.id}-manual-send`,
        timestamp: new Date().toISOString(),
        updateType,
      };

      const result = await submitSimulatorUpdate(
        contract.id,
        providerClient,
        body,
        controller.signal,
      );

      const [afterAlerts, afterMilestones, overview] = await Promise.all([
        fetchSimulatorAlerts(contract.id, controller.signal),
        fetchSimulatorMilestones(contract.id, controller.signal),
        apiRequest<ContractOverview>(`/api/v1/contracts/${contract.id}`, {
          signal: controller.signal,
        }),
      ]);

      startTransition(() => {
        setDocumentDrafts([]);
        setDocumentDraftErrors({});
        setErrors({});
        setFormValues(buildInitialFormValues(contract.pilotType, overview.lastKnownState ?? {}));
        setQualityTarget(overview.qualityTarget ?? null);
        setResponsePanel({
          alertsTriggered: deriveAlertRules(
            afterAlerts.filter((alert) => !beforeAlerts.some((existing) => existing.id === alert.id)),
          ),
          httpStatus: result.status,
          milestoneUpdated: compareMilestones(beforeMilestones, afterMilestones),
          response: {
            alertsTriggered: deriveAlertRules(
              afterAlerts.filter((alert) => !beforeAlerts.some((existing) => existing.id === alert.id)),
            ),
            milestoneUpdated: compareMilestones(beforeMilestones, afterMilestones),
            ...result.response,
          },
        });
      });
      onSubmitSettled();
    } catch (error) {
      startTransition(() => {
        setRequestError(formatRunnerError(error));
      });
      onSubmitSettled();
    } finally {
      setIsSubmitting(false);
    }
  };

  const pilotKey = (contract.pilotType ?? "").toUpperCase();
  const pilotMeta = getPilotMeta(contract.pilotType);
  const pilotTheme = getPilotTheme(contract.pilotType);

  return (
    <div className="space-y-4">
      {/* ── Form Panel ── */}
      <div className="sim-panel">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-[0.58rem]", pilotTheme.badgeClassName)}>{pilotMeta.label}</Badge>
            <h3 className="text-[0.82rem] font-semibold text-white">Manual Send</h3>
          </div>
          <div className="w-48">
            <Select
              onValueChange={(value) => setUpdateType(value as UpdateType)}
              value={updateType}
            >
              <SelectTrigger className="h-8 border-white/[0.08] bg-white/[0.03] text-[0.72rem] text-white">
                <SelectValue placeholder="Update type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="PRODUCTION_UPDATE">PRODUCTION_UPDATE</SelectItem>
                  <SelectItem value="QUALITY_EVENT">QUALITY_EVENT</SelectItem>
                  <SelectItem value="PHASE_CHANGE">PHASE_CHANGE</SelectItem>
                  <SelectItem value="MILESTONE_COMPLETE">MILESTONE_COMPLETE</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {isLoading ? (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[0.72rem] text-slate-500">
              Loading last known state...
            </div>
          ) : null}

          {!isLoading && pilotKey === "FACTOR" ? (
            <FactorForm
              errors={errors}
              onChange={(patch) =>
                setFormValues((currentValues) => ({ ...(currentValues as FactorFormValues), ...patch }))
              }
              qualityTarget={qualityTarget}
              values={formValues as FactorFormValues}
            />
          ) : null}

          {!isLoading && pilotKey === "TASOWHEEL" ? (
            <TasowheelForm
              errors={errors}
              onChange={(patch) =>
                setFormValues((currentValues) => ({
                  ...(currentValues as TasowheelFormValues),
                  ...patch,
                }))
              }
              values={formValues as TasowheelFormValues}
            />
          ) : null}

          {!isLoading && !["FACTOR", "TASOWHEEL", "E4M"].includes(pilotKey) ? (
            <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-3 text-[0.72rem] text-rose-300" role="alert">
              No manual send form for pilot type &quot;{contract.pilotType ?? "unknown"}&quot;.
              Supported: FACTOR, TASOWHEEL, E4M.
            </div>
          ) : null}

          {!isLoading && pilotKey === "E4M" ? (
            <E4mForm
              errors={errors}
              onAddTestResult={() =>
                setFormValues((currentValues) => ({
                  ...(currentValues as E4mFormValues),
                  testResults: [
                    ...(currentValues as E4mFormValues).testResults,
                    createEmptyTestResult(),
                  ],
                }))
              }
              onChange={(patch) =>
                setFormValues((currentValues) => ({ ...(currentValues as E4mFormValues), ...patch }))
              }
              onRemoveTestResult={(id) =>
                setFormValues((currentValues) => ({
                  ...(currentValues as E4mFormValues),
                  testResults: (currentValues as E4mFormValues).testResults.filter(
                    (result) => result.id !== id,
                  ),
                }))
              }
              onUpdateTestResult={(id, patch) =>
                setFormValues((currentValues) => ({
                  ...(currentValues as E4mFormValues),
                  testResults: (currentValues as E4mFormValues).testResults.map((result) =>
                    result.id === id ? { ...result, ...patch } : result,
                  ),
                }))
              }
              values={formValues as E4mFormValues}
            />
          ) : null}

          {!isLoading && updateType === "MILESTONE_COMPLETE" ? (
            <DocumentReferenceEditor
              description="Attach hosted document URLs for this milestone-complete update."
              errorsById={documentDraftErrors}
              onAddRow={() =>
                setDocumentDrafts((currentDrafts) => [
                  ...currentDrafts,
                  createDocumentReferenceDraft(),
                ])
              }
              onChangeRow={(id, patch) => {
                setDocumentDraftErrors({});
                setDocumentDrafts((currentDrafts) =>
                  currentDrafts.map((draft) =>
                    draft.id === id ? { ...draft, ...patch } : draft,
                  ),
                );
              }}
              onRemoveRow={(id) => {
                setDocumentDraftErrors({});
                setDocumentDrafts((currentDrafts) =>
                  currentDrafts.filter((draft) => draft.id !== id),
                );
              }}
              rows={documentDrafts}
              title="Evidence attachments"
            />
          ) : null}

          {errors.pilotType || requestError ? (
            <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-[0.72rem] text-rose-300" role="alert">
              {errors.pilotType || requestError}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              disabled={isLoading || isSubmitting || !["FACTOR", "TASOWHEEL", "E4M"].includes(pilotKey)}
              onClick={() => void handleSubmit()}
              size="sm"
              type="button"
            >
              <Send data-icon="inline-start" />
              {isSubmitting ? "Sending..." : "Submit update"}
            </Button>
            <Button
              onClick={() =>
                window.open(
                  `${window.location.origin}/contracts/${encodeURIComponent(contract.id)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <ArrowUpRight data-icon="inline-start" />
              Consumer view
            </Button>
          </div>
        </div>
      </div>

      {/* ── Response Panel ── */}
      <div className="sim-panel">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[0.82rem] font-semibold text-white">Submit Result</h3>
        </div>

        <div className="p-4">
          {responsePanel ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    HTTP status
                  </p>
                  <p className="mt-1.5 text-[1.1rem] font-semibold tabular-nums text-white">{responsePanel.httpStatus}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Alerts
                  </p>
                  <p className="mt-1.5 text-[0.72rem] text-slate-300">
                    {responsePanel.alertsTriggered.length > 0
                      ? responsePanel.alertsTriggered.join(", ")
                      : "None"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Milestone
                  </p>
                  <p className="mt-1.5 text-[0.72rem] text-slate-300">
                    {responsePanel.milestoneUpdated ?? "None"}
                  </p>
                </div>
              </div>

              <ScrollArea className="h-[24rem] pr-2">
                <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[0.62rem] leading-relaxed text-slate-400">
                  {JSON.stringify(responsePanel.response, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-[0.78rem] font-medium text-slate-400">No response yet</p>
              <p className="mt-1 text-[0.68rem] text-slate-600">
                Submit an update to inspect the response envelope.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

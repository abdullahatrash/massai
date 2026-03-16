import { startTransition, useEffect, useState } from "react";

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
import type { SimulatorContract } from "./simulatorShared";

type ManualSendFormProps = {
  contract: SimulatorContract;
  onSubmitSettled: () => void;
};

type ContractOverview = {
  id: string;
  lastKnownState: Record<string, unknown>;
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
    qualityPassRate: parseNumberString(lastKnownState.qualityPassRate, "0.99"),
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

  const quantityProduced = Number(values.quantityProduced);
  if (!Number.isFinite(quantityProduced) || quantityProduced < 0) {
    errors.quantityProduced = "Quantity produced must be 0 or greater.";
  }

  const quantityPlanned = Number(values.quantityPlanned);
  if (!Number.isFinite(quantityPlanned) || quantityPlanned < 0) {
    errors.quantityPlanned = "Quantity planned must be 0 or greater.";
  }

  const qualityPassRate = Number(values.qualityPassRate);
  if (!Number.isFinite(qualityPassRate) || qualityPassRate < 0 || qualityPassRate > 1) {
    errors.qualityPassRate = "Quality pass rate must stay between 0 and 1.";
  }

  const machineUtilization = Number(values.machineUtilization);
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
      qualityPassRate,
      ...(values.qualityRejectCount ? { qualityRejectCount: Number(values.qualityRejectCount) } : {}),
      quantityPlanned,
      quantityProduced,
      ...(values.shiftsCompleted ? { shiftsCompleted: Number(values.shiftsCompleted) } : {}),
    },
  };
}

function validateTasowheelForm(values: TasowheelFormValues) {
  const errors: Record<string, string> = {};

  const routingStep = Number(values.routingStep);
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

    const parsedValue = Number(rawValue);
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
      ...(values.carbonKgCo2e ? { carbonKgCo2e: Number(values.carbonKgCo2e) } : {}),
      ...(values.cycleTimeActualSec ? { cycleTimeActualSec: Number(values.cycleTimeActualSec) } : {}),
      ...(values.downtimeMinutes ? { downtimeMinutes: Number(values.downtimeMinutes) } : {}),
      ...(values.energyKwh ? { energyKwh: Number(values.energyKwh) } : {}),
      ...(values.milestoneRef.trim() ? { milestoneRef: values.milestoneRef.trim() } : {}),
      routingStep,
      ...(values.setupTimeActualMin ? { setupTimeActualMin: Number(values.setupTimeActualMin) } : {}),
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

  const rawCompletion = Number(values.completionPct);
  const completionPct = Number.isFinite(rawCompletion) ? Math.round(rawCompletion) : NaN;
  if (completionPct < 0 || completionPct > 100) {
    errors.completionPct = "Completion percent must be between 0 and 100.";
  }

  values.testResults.forEach((result, index) => {
    const defects = Number(result.defects);
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
        defects: Number(result.defects),
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

    if (!providerClient) {
      startTransition(() => {
        setRequestError("No provider service account is configured for this pilot.");
      });
      return;
    }

    const controller = new AbortController();
    setIsSubmitting(true);
    setRequestError(null);

    try {
      const [beforeAlerts, beforeMilestones] = await Promise.all([
        fetchSimulatorAlerts(contract.id, controller.signal),
        fetchSimulatorMilestones(contract.id, controller.signal),
      ]);

      const body = {
        evidence: [],
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
        setErrors({});
        setFormValues(buildInitialFormValues(contract.pilotType, overview.lastKnownState ?? {}));
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

  return (
    <section className="manual-send-grid">
      <article className="simulator-module-card">
        <div className="scenario-controls-header">
          <div>
            <span className="simulator-section-kicker">Manual Send</span>
            <h3>Pilot-specific update form</h3>
          </div>
        </div>

        <p className="scenario-summary">
          This form is prefilled from the contract&apos;s last known state and submits a single ingest
          update with the provider service account for this pilot.
        </p>

        <label className="simulator-field simulator-field-wide">
          <span>Update type</span>
          <select
            onChange={(event) => setUpdateType(event.target.value as UpdateType)}
            value={updateType}
          >
            <option value="PRODUCTION_UPDATE">PRODUCTION_UPDATE</option>
            <option value="QUALITY_EVENT">QUALITY_EVENT</option>
            <option value="PHASE_CHANGE">PHASE_CHANGE</option>
            <option value="MILESTONE_COMPLETE">MILESTONE_COMPLETE</option>
          </select>
        </label>

        {isLoading ? (
          <div className="simulator-state-card">
            <h4>Loading last known state</h4>
            <p>Pulling the latest contract overview to prefill the manual form.</p>
          </div>
        ) : null}

        {!isLoading && (contract.pilotType ?? "").toUpperCase() === "FACTOR" ? (
          <FactorForm
            errors={errors}
            onChange={(patch) =>
              setFormValues((currentValues) => ({ ...(currentValues as FactorFormValues), ...patch }))
            }
            values={formValues as FactorFormValues}
          />
        ) : null}

        {!isLoading && (contract.pilotType ?? "").toUpperCase() === "TASOWHEEL" ? (
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

        {!isLoading &&
        !["FACTOR", "TASOWHEEL", "E4M"].includes((contract.pilotType ?? "").toUpperCase()) ? (
          <div className="simulator-state-card simulator-state-card-error" role="alert">
            <h4>No form available</h4>
            <p>
              No manual send form exists for pilot type &quot;{contract.pilotType ?? "unknown"}&quot;.
              Supported pilots: FACTOR, TASOWHEEL, E4M.
            </p>
          </div>
        ) : null}

        {!isLoading && (contract.pilotType ?? "").toUpperCase() === "E4M" ? (
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

        {(errors.pilotType || requestError) ? (
          <p className="simulator-request-error" role="alert">
            {errors.pilotType || requestError}
          </p>
        ) : null}

        <div className="scenario-action-row">
          <button
            className="primary-button"
            disabled={
              isLoading ||
              isSubmitting ||
              !["FACTOR", "TASOWHEEL", "E4M"].includes((contract.pilotType ?? "").toUpperCase())
            }
            onClick={() => void handleSubmit()}
            type="button"
          >
            {isSubmitting ? "Sending..." : "Submit update"}
          </button>
        </div>
      </article>

      <article className="simulator-module-card">
        <div className="scenario-controls-header">
          <div>
            <span className="simulator-section-kicker">Response</span>
            <h3>Submit result</h3>
          </div>
        </div>

        {responsePanel ? (
          <div className="simulator-response-panel">
            <dl className="simulator-response-grid">
              <div>
                <dt>HTTP status</dt>
                <dd>{responsePanel.httpStatus}</dd>
              </div>
              <div>
                <dt>alertsTriggered</dt>
                <dd>
                  {responsePanel.alertsTriggered.length > 0
                    ? responsePanel.alertsTriggered.join(", ")
                    : "[]"}
                </dd>
              </div>
              <div>
                <dt>milestoneUpdated</dt>
                <dd>{responsePanel.milestoneUpdated ?? "None"}</dd>
              </div>
            </dl>
            <pre>{JSON.stringify(responsePanel.response, null, 2)}</pre>
          </div>
        ) : (
          <div className="simulator-state-card">
            <h4>No response yet</h4>
            <p>Submit a manual update to inspect the response envelope, alerts, and milestone changes.</p>
          </div>
        )}
      </article>
    </section>
  );
}

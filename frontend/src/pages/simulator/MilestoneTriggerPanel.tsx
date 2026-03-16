import { startTransition, useEffect, useState } from "react";

import { apiRequest, ApiError } from "../../api/client";
import {
  fetchSimulatorMilestones,
  formatRunnerError,
  getProviderClientConfig,
  submitSimulatorUpdate,
  type SimulatorMilestoneSummary,
} from "../../simulator/runner";
import type { SimulatorContract } from "./simulatorShared";

type MilestoneTriggerPanelProps = {
  contract: SimulatorContract;
  onSubmissionSettled: () => void;
};

type ContractOverview = {
  id: string;
  lastKnownState: Record<string, unknown>;
};

function parseRoutingStep(milestoneRef: string | null, fallback = 10) {
  if (!milestoneRef) {
    return fallback;
  }

  const match = milestoneRef.match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function buildMilestonePayload(
  contract: SimulatorContract,
  milestone: SimulatorMilestoneSummary,
  lastKnownState: Record<string, unknown>,
) {
  const pilotType = (contract.pilotType ?? "").toUpperCase();

  if (pilotType === "FACTOR") {
    const quantityPlanned =
      typeof lastKnownState.quantityPlanned === "number" ? lastKnownState.quantityPlanned : 12000;
    const qualityPassRate =
      typeof lastKnownState.qualityPassRate === "number"
        ? Math.max(lastKnownState.qualityPassRate, 0.99)
        : 0.99;

    return {
      ...lastKnownState,
      currentStage: milestone.milestoneRef ?? lastKnownState.currentStage ?? "TURNING",
      milestoneRef: milestone.milestoneRef,
      qualityPassRate,
      quantityPlanned,
      quantityProduced: quantityPlanned,
    };
  }

  if (pilotType === "TASOWHEEL") {
    return {
      ...lastKnownState,
      milestoneRef: milestone.milestoneRef,
      routingStep: parseRoutingStep(
        milestone.milestoneRef,
        Number(lastKnownState.routingStep) || 10,
      ),
      stepName: milestone.name ?? String(lastKnownState.stepName ?? "Routing Step"),
      stepStatus: "COMPLETE",
    };
  }

  if (pilotType === "E4M") {
    return {
      ...lastKnownState,
      approvalRequired: milestone.approvalRequired,
      completionPct: 100,
      currentPhase: milestone.milestoneRef ?? lastKnownState.currentPhase ?? "M1",
      issues: [],
      milestoneRef: milestone.milestoneRef,
    };
  }

  return {
    ...lastKnownState,
    milestoneRef: milestone.milestoneRef,
  };
}

function canSubmitMilestone(milestone: SimulatorMilestoneSummary, submittingId: string | null) {
  const normalizedStatus = (milestone.status ?? "").toUpperCase();
  if (submittingId === milestone.id) {
    return false;
  }

  return !["APPROVED", "COMPLETED", "SUBMITTED"].includes(normalizedStatus);
}

function formatMilestoneStatus(status: string | null) {
  return (status ?? "UNKNOWN").split("_").join(" ");
}

export function MilestoneTriggerPanel({
  contract,
  onSubmissionSettled,
}: MilestoneTriggerPanelProps) {
  const [milestones, setMilestones] = useState<SimulatorMilestoneSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastKnownState, setLastKnownState] = useState<Record<string, unknown>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMilestones(signal?: AbortSignal) {
      try {
        const [nextMilestones, overview] = await Promise.all([
          fetchSimulatorMilestones(contract.id, signal ?? new AbortController().signal),
          apiRequest<ContractOverview>(`/api/v1/contracts/${contract.id}`, {
            signal: signal ?? new AbortController().signal,
          }),
        ]);
        if (!isActive) {
          return;
        }

        startTransition(() => {
          setMilestones(nextMilestones);
          setLastKnownState(overview.lastKnownState ?? {});
          setRequestError(null);
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
              : "Unable to load milestone status for this contract.",
          );
          setIsLoading(false);
        });
      }
    }

    const controller = new AbortController();
    void loadMilestones(controller.signal);
    const intervalId = window.setInterval(() => {
      void loadMilestones(controller.signal);
    }, 4000);

    return () => {
      isActive = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [contract.id]);

  const providerClient = getProviderClientConfig(contract.pilotType);

  const handleSubmit = async (milestone: SimulatorMilestoneSummary) => {
    if (!providerClient) {
      startTransition(() => {
        setRequestError("No provider service account is configured for this pilot.");
      });
      return;
    }

    const controller = new AbortController();
    setSubmittingId(milestone.id);
    setRequestError(null);
    startTransition(() => {
      setMilestones((currentMilestones) =>
        currentMilestones.map((entry) =>
          entry.id === milestone.id ? { ...entry, status: "SUBMITTED" } : entry,
        ),
      );
    });

    try {
      await submitSimulatorUpdate(
        contract.id,
        providerClient,
        {
          evidence: [],
          payload: buildMilestonePayload(contract, milestone, lastKnownState),
          sensorId: `${contract.id}-milestone-trigger`,
          timestamp: new Date().toISOString(),
          updateType: "MILESTONE_COMPLETE",
        },
        controller.signal,
      );

      const [nextMilestones, overview] = await Promise.all([
        fetchSimulatorMilestones(contract.id, controller.signal),
        apiRequest<ContractOverview>(`/api/v1/contracts/${contract.id}`, {
          signal: controller.signal,
        }),
      ]);

      startTransition(() => {
        setMilestones(nextMilestones);
        setLastKnownState(overview.lastKnownState ?? {});
      });
      onSubmissionSettled();
    } catch (error) {
      startTransition(() => {
        setRequestError(formatRunnerError(error));
      });
      onSubmissionSettled();
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <section className="milestone-trigger-panel">
      <article className="simulator-module-card">
        <div className="scenario-controls-header">
          <div>
            <span className="simulator-section-kicker">Milestones</span>
            <h3>Milestone trigger panel</h3>
          </div>
          <button
            className="ghost-button simulator-button"
            onClick={() =>
              window.open(
                `${window.location.origin}/contracts/${encodeURIComponent(contract.id)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
            type="button"
          >
            Open Consumer View
          </button>
        </div>

        <p className="scenario-summary">
          Submit milestone completion updates directly from the simulator to test auto-verification
          and approval-required flows.
        </p>

        {isLoading ? (
          <div className="simulator-state-card">
            <h4>Loading milestones</h4>
            <p>Pulling the latest milestone state for this contract.</p>
          </div>
        ) : null}

        {requestError ? <p className="simulator-request-error">{requestError}</p> : null}

        <div className="milestone-list">
          {milestones.map((milestone) => {
            const normalizedStatus = (milestone.status ?? "").toUpperCase();
            const isSubmittable = canSubmitMilestone(milestone, submittingId);

            return (
              <article className="milestone-card" key={milestone.id}>
                <div className="milestone-card-header">
                  <div>
                    <strong>{milestone.name ?? milestone.milestoneRef ?? milestone.id}</strong>
                    <p>{milestone.milestoneRef ?? "No milestone ref"}</p>
                  </div>
                  <span className={`milestone-status-pill ${normalizedStatus.toLowerCase()}`}>
                    {formatMilestoneStatus(milestone.status)}
                  </span>
                </div>

                <div className="milestone-meta-row">
                  <span>
                    Approval: {milestone.approvalRequired ? "Required" : "Auto-verified"}
                  </span>
                  {milestone.approvalRequired ? (
                    <span
                      className="milestone-hint"
                      title="Consumer approval required after submission"
                    >
                      Consumer approval required after submission
                    </span>
                  ) : null}
                </div>

                <button
                  className="primary-button"
                  disabled={!isSubmittable}
                  onClick={() => void handleSubmit(milestone)}
                  type="button"
                >
                  {submittingId === milestone.id
                    ? "Submitting..."
                    : normalizedStatus === "SUBMITTED"
                      ? "Awaiting Approval"
                      : normalizedStatus === "COMPLETED"
                        ? "Completed"
                        : "Submit Complete"}
                </button>
              </article>
            );
          })}
        </div>
      </article>
    </section>
  );
}

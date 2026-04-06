import { startTransition, useEffect, useState } from "react";
import { ArrowUpRight, Milestone, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DocumentReferenceEditor,
  createDocumentReferenceDraft,
  serializeDocumentReferenceDrafts,
  type DocumentReferenceDraft,
  type DocumentReferenceDraftErrors,
} from "@/components/DocumentReferenceEditor";

import { apiRequest, ApiError } from "../../api/client";
import { fetchContractIngestSpec } from "../../api/ingestSpec";
import {
  fetchSimulatorMilestones,
  formatRunnerError,
  getProviderClientConfig,
  submitSimulatorUpdateV2,
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

function getStatusBadgeClassName(status: string | null) {
  const normalizedStatus = (status ?? "").toUpperCase();

  if (normalizedStatus === "COMPLETED" || normalizedStatus === "APPROVED") {
    return "border-emerald-300/25 bg-emerald-300/12 text-emerald-50";
  }
  if (normalizedStatus === "SUBMITTED") {
    return "border-amber-300/25 bg-amber-300/12 text-amber-50";
  }
  if (normalizedStatus === "REJECTED") {
    return "border-rose-300/25 bg-rose-300/12 text-rose-100";
  }

  return "border-white/12 bg-white/8 text-white/75";
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
  const [documentDraftsByMilestoneId, setDocumentDraftsByMilestoneId] = useState<
    Record<string, DocumentReferenceDraft[]>
  >({});
  const [documentErrorsByMilestoneId, setDocumentErrorsByMilestoneId] = useState<
    Record<string, DocumentReferenceDraftErrors>
  >({});
  const [profileVersion, setProfileVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetchContractIngestSpec(contract.id, controller.signal)
      .then((spec) => setProfileVersion(spec.profileVersion))
      .catch(() => {});
    return () => controller.abort();
  }, [contract.id]);

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

  const updateDocumentDrafts = (
    milestoneId: string,
    updater: (currentDrafts: DocumentReferenceDraft[]) => DocumentReferenceDraft[],
  ) => {
    setDocumentDraftsByMilestoneId((currentDraftsByMilestoneId) => ({
      ...currentDraftsByMilestoneId,
      [milestoneId]: updater(currentDraftsByMilestoneId[milestoneId] ?? []),
    }));
  };

  const clearDocumentErrors = (milestoneId: string) => {
    setDocumentErrorsByMilestoneId((currentErrorsByMilestoneId) => {
      if (!(milestoneId in currentErrorsByMilestoneId)) {
        return currentErrorsByMilestoneId;
      }

      const nextErrorsByMilestoneId = { ...currentErrorsByMilestoneId };
      delete nextErrorsByMilestoneId[milestoneId];
      return nextErrorsByMilestoneId;
    });
  };

  const clearDocumentDrafts = (milestoneId: string) => {
    setDocumentDraftsByMilestoneId((currentDraftsByMilestoneId) => {
      if (!(milestoneId in currentDraftsByMilestoneId)) {
        return currentDraftsByMilestoneId;
      }

      const nextDraftsByMilestoneId = { ...currentDraftsByMilestoneId };
      delete nextDraftsByMilestoneId[milestoneId];
      return nextDraftsByMilestoneId;
    });
  };

  const handleSubmit = async (milestone: SimulatorMilestoneSummary) => {
    if (!providerClient) {
      startTransition(() => {
        setRequestError("No provider service account is configured for this pilot.");
      });
      return;
    }

    const evidenceDrafts = documentDraftsByMilestoneId[milestone.id] ?? [];
    const serializedEvidence = serializeDocumentReferenceDrafts(evidenceDrafts);
    if (serializedEvidence.hasErrors) {
      setDocumentErrorsByMilestoneId((currentErrorsByMilestoneId) => ({
        ...currentErrorsByMilestoneId,
        [milestone.id]: serializedEvidence.errorsById,
      }));
      return;
    }
    clearDocumentErrors(milestone.id);

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
      await submitSimulatorUpdateV2(
        contract.id,
        providerClient,
        {
          evidence: serializedEvidence.documents,
          payload: buildMilestonePayload(contract, milestone, lastKnownState),
          sourceId: `${contract.id}-milestone-trigger`,
          timestamp: new Date().toISOString(),
          updateType: "MILESTONE_COMPLETE",
          ...(profileVersion != null ? { profileVersion } : {}),
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
      clearDocumentDrafts(milestone.id);
      clearDocumentErrors(milestone.id);
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
    <div className="sim-panel">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[0.82rem] font-semibold text-white">Milestone Triggers</h3>
        <Button
          className="text-[0.65rem] text-slate-500"
          onClick={() =>
            window.open(
              `${window.location.origin}/contracts/${encodeURIComponent(contract.id)}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          size="sm"
          variant="ghost"
        >
          <ArrowUpRight className="size-3" />
          Consumer view
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {isLoading ? (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[0.72rem] text-slate-500">
            Loading milestone state...
          </div>
        ) : null}

        {requestError ? (
          <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-[0.72rem] text-rose-300">
            {requestError}
          </div>
        ) : null}

        <div className="grid gap-2">
          {milestones.map((milestone) => {
            const normalizedStatus = (milestone.status ?? "").toUpperCase();
            const isSubmittable = canSubmitMilestone(milestone, submittingId);
            const documentDrafts = documentDraftsByMilestoneId[milestone.id] ?? [];
            const showDocumentEditor = isSubmittable || documentDrafts.length > 0;

            return (
              <div
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                key={milestone.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Milestone className="size-3.5 shrink-0 text-slate-500" />
                      <p className="truncate text-[0.78rem] font-medium text-white">
                        {milestone.name ?? milestone.milestoneRef ?? milestone.id}
                      </p>
                    </div>
                    <p className="mt-1 text-[0.68rem] text-slate-500">
                      {milestone.milestoneRef ?? "No ref"}
                    </p>
                  </div>

                  <Badge className={getStatusBadgeClassName(milestone.status)}>
                    {formatMilestoneStatus(milestone.status)}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.65rem]">
                  <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-slate-400">
                    {milestone.approvalRequired ? "Approval required" : "Auto-verified"}
                  </span>
                  {milestone.approvalRequired ? (
                    <span className="flex items-center gap-1 rounded-md border border-amber-400/12 bg-amber-400/[0.04] px-2 py-1 text-amber-300">
                      <ShieldCheck className="size-3" />
                      Needs consumer approval
                    </span>
                  ) : null}
                </div>

                {showDocumentEditor ? (
                  <div className="mt-3">
                    <DocumentReferenceEditor
                      description="Attach hosted evidence links before submitting this milestone."
                      errorsById={documentErrorsByMilestoneId[milestone.id]}
                      onAddRow={() =>
                        updateDocumentDrafts(milestone.id, (currentDrafts) => [
                          ...currentDrafts,
                          createDocumentReferenceDraft(),
                        ])
                      }
                      onChangeRow={(id, patch) => {
                        clearDocumentErrors(milestone.id);
                        updateDocumentDrafts(milestone.id, (currentDrafts) =>
                          currentDrafts.map((draft) =>
                            draft.id === id ? { ...draft, ...patch } : draft,
                          ),
                        );
                      }}
                      onRemoveRow={(id) => {
                        clearDocumentErrors(milestone.id);
                        updateDocumentDrafts(milestone.id, (currentDrafts) =>
                          currentDrafts.filter((draft) => draft.id !== id),
                        );
                      }}
                      rows={documentDrafts}
                      title="Evidence attachments"
                    />
                  </div>
                ) : null}

                <div className="mt-3">
                  <Button
                    disabled={!isSubmittable}
                    onClick={() => void handleSubmit(milestone)}
                    size="sm"
                    type="button"
                  >
                    {submittingId === milestone.id
                      ? "Submitting..."
                      : normalizedStatus === "SUBMITTED"
                        ? "Awaiting approval"
                        : normalizedStatus === "COMPLETED"
                          ? "Completed"
                          : "Submit complete"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { startTransition, useEffect, useState } from "react";
import { ArrowUpRight, Milestone, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card className="border-white/10 bg-white/[0.045] text-white shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <CardHeader className="border-b border-white/8 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-white/12 bg-white/8 text-white/70">Milestones</Badge>
            <CardTitle className="mt-4 text-2xl text-white">Milestone trigger panel</CardTitle>
            <CardDescription className="mt-3 max-w-2xl text-slate-300">
              Submit milestone completion updates directly from the simulator to test
              auto-verification and consumer approval flows.
            </CardDescription>
          </div>
          <Button
            onClick={() =>
              window.open(
                `${window.location.origin}/contracts/${encodeURIComponent(contract.id)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
            type="button"
            variant="outline"
          >
            <ArrowUpRight data-icon="inline-start" />
            Open consumer view
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 pt-5">
        {isLoading ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
            Pulling the latest milestone state for this contract.
          </div>
        ) : null}

        {requestError ? (
          <div className="rounded-[28px] border border-rose-300/15 bg-rose-950/25 p-4 text-sm text-rose-100">
            {requestError}
          </div>
        ) : null}

        <div className="grid gap-4">
          {milestones.map((milestone) => {
            const normalizedStatus = (milestone.status ?? "").toUpperCase();
            const isSubmittable = canSubmitMilestone(milestone, submittingId);

            return (
              <div
                className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4"
                key={milestone.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Milestone className="text-slate-500" />
                      <p className="text-base font-semibold text-white">
                        {milestone.name ?? milestone.milestoneRef ?? milestone.id}
                      </p>
                    </div>
                    <p className="text-sm text-slate-300">
                      {milestone.milestoneRef ?? "No milestone ref"}
                    </p>
                  </div>

                  <Badge className={getStatusBadgeClassName(milestone.status)}>
                    {formatMilestoneStatus(milestone.status)}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    Approval: {milestone.approvalRequired ? "Required" : "Auto-verified"}
                  </div>
                  {milestone.approvalRequired ? (
                    <div className="flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1.5 text-amber-50">
                      <ShieldCheck className="text-amber-200" />
                      Consumer approval required after submission
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <Button
                    disabled={!isSubmittable}
                    onClick={() => void handleSubmit(milestone)}
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
      </CardContent>
    </Card>
  );
}

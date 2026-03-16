import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import {
  approveMilestone,
  getMilestone,
  listMilestones,
  rejectMilestone,
  type MilestoneDetail,
  type MilestoneSummary,
} from "../api/milestones";
import { MilestoneCard } from "../components/MilestoneCard";
import { useWebSocket } from "../hooks/useWebSocket";
import type { ContractOutletContext } from "./ContractRouteLayout";

type MutationContext = {
  previousDetail?: MilestoneDetail;
  previousMilestones?: MilestoneSummary[];
};

function updateMilestoneSummary(
  milestones: MilestoneSummary[] | undefined,
  milestoneId: string,
  updater: (milestone: MilestoneSummary) => MilestoneSummary,
): MilestoneSummary[] | undefined {
  if (!milestones) {
    return milestones;
  }

  return milestones.map((milestone) =>
    milestone.id === milestoneId ? updater(milestone) : milestone,
  );
}

function updateMilestoneDetail(
  detail: MilestoneDetail | undefined,
  updater: (milestone: MilestoneDetail) => MilestoneDetail,
): MilestoneDetail | undefined {
  if (!detail) {
    return detail;
  }

  return updater(detail);
}

export function MilestoneTimeline() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const milestonesQuery = useQuery({
    queryFn: () => listMilestones(contract.id),
    queryKey: ["contract-milestones", contract.id],
  });

  const milestoneDetailQueries = useQueries({
    queries: (milestonesQuery.data ?? []).map((milestone) => ({
      enabled: milestonesQuery.isSuccess,
      queryFn: () => getMilestone(contract.id, milestone.id),
      queryKey: ["milestone-detail", contract.id, milestone.id],
      staleTime: 30_000,
    })),
  });

  const detailById = useMemo(
    () =>
      new Map(
        (milestonesQuery.data ?? []).map((milestone, index) => [
          milestone.id,
          {
            data: milestoneDetailQueries[index]?.data,
            error:
              milestoneDetailQueries[index]?.error instanceof Error
                ? milestoneDetailQueries[index]?.error.message
                : null,
            isLoading: milestoneDetailQueries[index]?.isPending ?? false,
          },
        ]),
      ),
    [milestoneDetailQueries, milestonesQuery.data],
  );

  const invalidateMilestoneViews = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contract-milestones", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contract-overview", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contract-timeline", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contract-alerts", contract.id] }),
      queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      queryClient.invalidateQueries({ queryKey: ["milestone-detail", contract.id] }),
    ]);

  useWebSocket({
    contractId: contract.id,
    onMessage: (message) => {
      if (["MILESTONE_CHANGED", "UPDATE_RECEIVED", "CONTRACT_STATE_CHANGED"].includes(message.type)) {
        void invalidateMilestoneViews();
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ milestoneId }: { milestoneId: string }) =>
      approveMilestone(contract.id, milestoneId),
    onMutate: async ({ milestoneId }): Promise<MutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["contract-milestones", contract.id] }),
        queryClient.cancelQueries({ queryKey: ["milestone-detail", contract.id, milestoneId] }),
      ]);

      const previousMilestones = queryClient.getQueryData<MilestoneSummary[]>([
        "contract-milestones",
        contract.id,
      ]);
      const previousDetail = queryClient.getQueryData<MilestoneDetail>([
        "milestone-detail",
        contract.id,
        milestoneId,
      ]);

      const today = new Date().toISOString().slice(0, 10);

      queryClient.setQueryData<MilestoneSummary[]>(
        ["contract-milestones", contract.id],
        (current) =>
          updateMilestoneSummary(current, milestoneId, (milestone) => ({
            ...milestone,
            actualDate: today,
            isOverdue: false,
            status: "COMPLETED",
          })),
      );

      queryClient.setQueryData<MilestoneDetail>(
        ["milestone-detail", contract.id, milestoneId],
        (current) =>
          updateMilestoneDetail(current, (milestone) => ({
            ...milestone,
            actualDate: today,
            isOverdue: false,
            status: "COMPLETED",
          })),
      );

      return {
        previousDetail,
        previousMilestones,
      };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMilestones) {
        queryClient.setQueryData(
          ["contract-milestones", contract.id],
          context.previousMilestones,
        );
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          ["milestone-detail", contract.id, variables.milestoneId],
          context.previousDetail,
        );
      }
    },
    onSettled: () => {
      void invalidateMilestoneViews();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ milestoneId, reason }: { milestoneId: string; reason: string }) =>
      rejectMilestone(contract.id, milestoneId, reason),
    onMutate: async ({ milestoneId, reason }): Promise<MutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["contract-milestones", contract.id] }),
        queryClient.cancelQueries({ queryKey: ["milestone-detail", contract.id, milestoneId] }),
      ]);

      const previousMilestones = queryClient.getQueryData<MilestoneSummary[]>([
        "contract-milestones",
        contract.id,
      ]);
      const previousDetail = queryClient.getQueryData<MilestoneDetail>([
        "milestone-detail",
        contract.id,
        milestoneId,
      ]);

      queryClient.setQueryData<MilestoneSummary[]>(
        ["contract-milestones", contract.id],
        (current) =>
          updateMilestoneSummary(current, milestoneId, (milestone) => ({
            ...milestone,
            isOverdue: false,
            status: "REJECTED",
          })),
      );

      queryClient.setQueryData<MilestoneDetail>(
        ["milestone-detail", contract.id, milestoneId],
        (current) =>
          updateMilestoneDetail(current, (milestone) => ({
            ...milestone,
            evidence: [
              ...(milestone.evidence ?? []),
              {
                reason,
                type: "REJECTION_REASON",
              },
            ],
            isOverdue: false,
            status: "REJECTED",
          })),
      );

      return {
        previousDetail,
        previousMilestones,
      };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMilestones) {
        queryClient.setQueryData(
          ["contract-milestones", contract.id],
          context.previousMilestones,
        );
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          ["milestone-detail", contract.id, variables.milestoneId],
          context.previousDetail,
        );
      }
    },
    onSettled: () => {
      void invalidateMilestoneViews();
    },
  });

  const toggleExpanded = (milestoneId: string) => {
    setExpandedIds((current) =>
      current.includes(milestoneId)
        ? current.filter((id) => id !== milestoneId)
        : [...current, milestoneId],
    );
  };

  return (
    <section className="page-stack">
      <div className="content-card milestone-timeline-shell">
        <div className="section-header">
          <div>
            <span className="eyebrow">Milestones</span>
            <h3>Delivery timeline</h3>
          </div>
        </div>

        <p className="overview-supporting-copy">
          Follow what is complete, what is still planned, and any milestone awaiting your approval.
        </p>

        {milestonesQuery.isPending ? <p>Loading the milestone delivery sequence.</p> : null}

        {milestonesQuery.isError ? (
          <div className="content-card error-card">
            <h3>Unable to load milestones</h3>
            <p>{milestonesQuery.error.message}</p>
            <button
              className="primary-button"
              onClick={() => void milestonesQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {milestonesQuery.isSuccess && milestonesQuery.data.length === 0 ? (
          <p>No milestones are currently defined for this contract.</p>
        ) : null}

        {milestonesQuery.isSuccess && milestonesQuery.data.length > 0 ? (
          <div className="milestone-timeline-list">
            {milestonesQuery.data.map((milestone) => {
              const milestoneDetail = detailById.get(milestone.id);
              return (
                <MilestoneCard
                  detail={milestoneDetail?.data}
                  errorMessage={milestoneDetail?.error}
                  isApproving={
                    approveMutation.isPending && approveMutation.variables?.milestoneId === milestone.id
                  }
                  isDetailLoading={milestoneDetail?.isLoading ?? false}
                  isExpanded={expandedIds.includes(milestone.id)}
                  isRejecting={
                    rejectMutation.isPending && rejectMutation.variables?.milestoneId === milestone.id
                  }
                  key={milestone.id}
                  milestone={milestone}
                  onApprove={() => approveMutation.mutate({ milestoneId: milestone.id })}
                  onReject={(reason) => rejectMutation.mutate({ milestoneId: milestone.id, reason })}
                  onToggle={() => toggleExpanded(milestone.id)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

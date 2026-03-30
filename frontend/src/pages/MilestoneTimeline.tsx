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
import { type ViewerDocument } from "../api/documents";
import { DocumentViewerSheet } from "../components/DocumentViewerSheet";
import { MilestoneCard } from "../components/MilestoneCard";
import { Button } from "@/components/ui/button";
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
  if (!milestones) return milestones;
  return milestones.map((milestone) =>
    milestone.id === milestoneId ? updater(milestone) : milestone,
  );
}

function updateMilestoneDetail(
  detail: MilestoneDetail | undefined,
  updater: (milestone: MilestoneDetail) => MilestoneDetail,
): MilestoneDetail | undefined {
  if (!detail) return detail;
  return updater(detail);
}

export function MilestoneTimeline() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ViewerDocument | null>(null);

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
      const previousMilestones = queryClient.getQueryData<MilestoneSummary[]>(["contract-milestones", contract.id]);
      const previousDetail = queryClient.getQueryData<MilestoneDetail>(["milestone-detail", contract.id, milestoneId]);
      const today = new Date().toISOString().slice(0, 10);
      queryClient.setQueryData<MilestoneSummary[]>(
        ["contract-milestones", contract.id],
        (current) => updateMilestoneSummary(current, milestoneId, (m) => ({ ...m, actualDate: today, isOverdue: false, status: "COMPLETED" })),
      );
      queryClient.setQueryData<MilestoneDetail>(
        ["milestone-detail", contract.id, milestoneId],
        (current) => updateMilestoneDetail(current, (m) => ({ ...m, actualDate: today, isOverdue: false, status: "COMPLETED" })),
      );
      return { previousDetail, previousMilestones };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMilestones) queryClient.setQueryData(["contract-milestones", contract.id], context.previousMilestones);
      if (context?.previousDetail) queryClient.setQueryData(["milestone-detail", contract.id, variables.milestoneId], context.previousDetail);
    },
    onSettled: () => { void invalidateMilestoneViews(); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ milestoneId, reason }: { milestoneId: string; reason: string }) =>
      rejectMilestone(contract.id, milestoneId, reason),
    onMutate: async ({ milestoneId, reason }): Promise<MutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["contract-milestones", contract.id] }),
        queryClient.cancelQueries({ queryKey: ["milestone-detail", contract.id, milestoneId] }),
      ]);
      const previousMilestones = queryClient.getQueryData<MilestoneSummary[]>(["contract-milestones", contract.id]);
      const previousDetail = queryClient.getQueryData<MilestoneDetail>(["milestone-detail", contract.id, milestoneId]);
      queryClient.setQueryData<MilestoneSummary[]>(
        ["contract-milestones", contract.id],
        (current) => updateMilestoneSummary(current, milestoneId, (m) => ({ ...m, isOverdue: false, status: "REJECTED" })),
      );
      queryClient.setQueryData<MilestoneDetail>(
        ["milestone-detail", contract.id, milestoneId],
        (current) => updateMilestoneDetail(current, (m) => ({ ...m, evidence: [...(m.evidence ?? []), { reason, type: "REJECTION_REASON" }], isOverdue: false, status: "REJECTED" })),
      );
      return { previousDetail, previousMilestones };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMilestones) queryClient.setQueryData(["contract-milestones", contract.id], context.previousMilestones);
      if (context?.previousDetail) queryClient.setQueryData(["milestone-detail", contract.id, variables.milestoneId], context.previousDetail);
    },
    onSettled: () => { void invalidateMilestoneViews(); },
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
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Milestones</p>
          <h3 className="text-xl font-semibold text-stone-900 m-0">Delivery timeline</h3>
          <p className="text-sm text-stone-500 m-0">
            Follow what is complete, what is still planned, and any milestone awaiting your approval.
          </p>
        </div>

        {/* Loading */}
        {milestonesQuery.isPending && (
          <div className="flex flex-col gap-4" role="status" aria-label="Loading milestones">
            {[1, 2, 3].map((i) => (
              <div className="flex gap-3 animate-pulse" key={i}>
                <div className="size-9 shrink-0 rounded-full bg-stone-200" />
                <div className="flex-1 rounded-2xl bg-stone-100 h-24" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {milestonesQuery.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 flex flex-col gap-3">
            <div>
              <h3 className="text-base font-semibold text-rose-900 m-0 mb-1">Unable to load milestones</h3>
              <p className="text-sm text-rose-700 m-0">{milestonesQuery.error.message}</p>
            </div>
            <Button className="self-start" onClick={() => void milestonesQuery.refetch()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {milestonesQuery.isSuccess && milestonesQuery.data.length === 0 && (
          <p className="text-sm text-stone-400 italic m-0">No milestones are defined for this contract.</p>
        )}

        {/* Timeline */}
        {milestonesQuery.isSuccess && milestonesQuery.data.length > 0 && (
          <div className="milestone-timeline-list" role="list" aria-label="Milestone timeline">
            {milestonesQuery.data.map((milestone) => {
              const milestoneDetail = detailById.get(milestone.id);
              return (
                <MilestoneCard
                  detail={milestoneDetail?.data}
                  errorMessage={milestoneDetail?.error}
                  isApproving={approveMutation.isPending && approveMutation.variables?.milestoneId === milestone.id}
                  isDetailLoading={milestoneDetail?.isLoading ?? false}
                  isExpanded={expandedIds.includes(milestone.id)}
                  isRejecting={rejectMutation.isPending && rejectMutation.variables?.milestoneId === milestone.id}
                  key={milestone.id}
                  milestone={milestone}
                  onApprove={() => approveMutation.mutate({ milestoneId: milestone.id })}
                  onDocumentSelect={(document) => setSelectedDocument(document)}
                  onReject={(reason) => rejectMutation.mutate({ milestoneId: milestone.id, reason })}
                  onToggle={() => toggleExpanded(milestone.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <DocumentViewerSheet
        document={selectedDocument}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocument(null);
          }
        }}
      />
    </section>
  );
}

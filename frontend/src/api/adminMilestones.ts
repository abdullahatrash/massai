import { apiRequest } from "./client";

export type AdminMilestoneEvidence = Record<string, unknown> | string;

export type AdminMilestoneSummary = {
  actualDate: string | null;
  approvalRequired: boolean;
  id: string;
  isOverdue: boolean;
  milestoneRef: string | null;
  name: string | null;
  plannedDate: string | null;
  qualityGate?: number | null;
  status: string | null;
};

export type AdminMilestoneDetail = AdminMilestoneSummary & {
  evidence: AdminMilestoneEvidence[];
};

export async function listAdminMilestones(
  contractId: string,
  signal?: AbortSignal,
): Promise<AdminMilestoneSummary[]> {
  return apiRequest<AdminMilestoneSummary[]>(
    `/api/v2/admin/contracts/${contractId}/milestones`,
    { signal },
  );
}

export async function getAdminMilestone(
  contractId: string,
  milestoneId: string,
  signal?: AbortSignal,
): Promise<AdminMilestoneDetail> {
  return apiRequest<AdminMilestoneDetail>(
    `/api/v2/admin/contracts/${contractId}/milestones/${milestoneId}`,
    { signal },
  );
}

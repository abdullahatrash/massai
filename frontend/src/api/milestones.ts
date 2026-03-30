import type { ProviderDocumentReference } from "./documents";
import { apiClient, apiRequest } from "./client";

export type MilestoneEvidence = ProviderDocumentReference | Record<string, unknown> | string;

export type MilestoneSummary = {
  actualDate: string | null;
  approvalRequired: boolean;
  id: string;
  isOverdue: boolean;
  milestoneRef: string;
  name: string;
  plannedDate: string | null;
  qualityGate?: number | null;
  status: string;
};

export type MilestoneDetail = MilestoneSummary & {
  evidence: MilestoneEvidence[];
};

export type MilestoneDecision = {
  contractId: string;
  milestoneId: string;
  status: string;
};

export async function listMilestones(contractId: string): Promise<MilestoneSummary[]> {
  return apiRequest<MilestoneSummary[]>(`/api/v1/contracts/${contractId}/milestones`);
}

export async function getMilestone(
  contractId: string,
  milestoneId: string,
): Promise<MilestoneDetail> {
  return apiRequest<MilestoneDetail>(`/api/v1/contracts/${contractId}/milestones/${milestoneId}`);
}

export async function approveMilestone(
  contractId: string,
  milestoneId: string,
  notes?: string,
): Promise<MilestoneDecision> {
  const payload = notes ? { notes } : {};
  const response = await apiClient.post<MilestoneDecision>(
    `/api/v1/contracts/${contractId}/milestones/${milestoneId}/approve`,
    { body: payload },
  );
  return response.data;
}

export async function rejectMilestone(
  contractId: string,
  milestoneId: string,
  reason: string,
): Promise<MilestoneDecision> {
  const response = await apiClient.post<MilestoneDecision>(
    `/api/v1/contracts/${contractId}/milestones/${milestoneId}/reject`,
    { body: { reason } },
  );
  return response.data;
}

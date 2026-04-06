import { apiRequest } from "./client";

export type ContractHealthSummary = {
  activeAlertCount: number;
  contractId: string;
  lastUpdateAt: string | null;
  milestonesCompleted: number;
  milestonesTotal: number;
  overdueMilestoneCount: number;
  pilotType: string | null;
  processedCount: number;
  productName: string | null;
  staleSinceMinutes: number | null;
  status: string | null;
  totalUpdates: number;
  unprocessedCount: number;
};

export type ContractHealth = ContractHealthSummary & {
  ingestProfileKey: string | null;
  ingestProfileVersion: number | null;
  lastKnownState: Record<string, unknown>;
  updateFrequencyMinutes: number | null;
};

export async function fetchContractsHealthSummary(
  signal?: AbortSignal,
): Promise<ContractHealthSummary[]> {
  return apiRequest<ContractHealthSummary[]>(
    "/api/v2/admin/contracts/health-summary",
    { signal },
  );
}

export async function fetchContractHealth(
  contractId: string,
  signal?: AbortSignal,
): Promise<ContractHealth> {
  return apiRequest<ContractHealth>(
    `/api/v2/admin/contracts/${contractId}/health`,
    { signal },
  );
}

import { apiClient, apiRequest, type ApiResponse } from "./client";

export type DemoMilestonePayload = {
  approvalRequired: boolean;
  completionCriteria: Record<string, unknown>;
  milestoneRef: string;
  name: string;
  plannedDate: string; // ISO date YYYY-MM-DD
};

export type CreateDemoContractPayload = {
  agreementType: string;
  consumerId: string;
  contractId: string;
  deliveryDate: string; // ISO date YYYY-MM-DD
  factoryName: string;
  milestones: DemoMilestonePayload[];
  pilotType: string;
  productName: string;
  profileKey?: string;
  profileVersion?: number;
  providerId: string;
  quantityTotal: number;
};

export type CreateDemoContractResponse = {
  id: string;
  contractId: string;
  pilotType: string;
};

export type AdminContractListItem = {
  deliveryDate: string | null;
  id: string;
  milestonesCompleted: number;
  milestonesTotal: number;
  pilotType: string | null;
  productName: string | null;
  providerId: string | null;
  quantityTotal: number | null;
  status: string | null;
  statusBadge: string;
};

export type AdminNextMilestone = {
  daysRemaining: number;
  name: string;
  plannedDate: string;
};

export type AdminContractOverview = AdminContractListItem & {
  lastKnownState: Record<string, unknown>;
  nextMilestone: AdminNextMilestone | null;
  qualityTarget?: number | null;
};

export type AdminContractsListMeta = {
  pagination: {
    hasMore: boolean;
    page: number;
    pageSize: number;
  };
};

export async function createDemoContract(
  payload: CreateDemoContractPayload,
  signal?: AbortSignal,
): Promise<CreateDemoContractResponse> {
  return apiRequest<CreateDemoContractResponse>("/api/v2/admin/demo/contracts", {
    body: payload as unknown as Record<string, unknown>,
    method: "POST",
    signal,
  });
}

export async function listAdminContracts(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<AdminContractListItem[], AdminContractsListMeta>> {
  const query = new URLSearchParams();

  if (params?.page) {
    query.set("page", String(params.page));
  }
  if (params?.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiClient.get<AdminContractListItem[], AdminContractsListMeta>(
    `/api/v2/admin/contracts${suffix}`,
  );
}

export async function getAdminContractOverview(
  contractId: string,
  signal?: AbortSignal,
): Promise<AdminContractOverview> {
  return apiRequest<AdminContractOverview>(`/api/v2/admin/contracts/${contractId}`, {
    signal,
  });
}

export async function deleteDemoContract(
  contractId: string,
  signal?: AbortSignal,
): Promise<{ contractId: string; deleted: boolean }> {
  return apiRequest<{ contractId: string; deleted: boolean }>(
    `/api/v2/admin/contracts/${contractId}`,
    { method: "DELETE", signal },
  );
}

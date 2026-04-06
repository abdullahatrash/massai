import { apiRequest } from "./client";

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

export async function deleteDemoContract(
  contractId: string,
  signal?: AbortSignal,
): Promise<{ contractId: string; deleted: boolean }> {
  return apiRequest<{ contractId: string; deleted: boolean }>(
    `/api/v2/admin/contracts/${contractId}`,
    { method: "DELETE", signal },
  );
}

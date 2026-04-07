import { apiClient, apiRequest } from "./client";

export type AdminAlert = {
  acknowledgedAt: string | null;
  blockchainVerified: boolean;
  description: string;
  id: string;
  resolvedAt: string | null;
  severity: string | null;
  triggeredAt: string | null;
  verifiedAt: string | null;
};

export async function listAdminActiveAlerts(
  contractId: string,
  signal?: AbortSignal,
): Promise<AdminAlert[]> {
  return apiRequest<AdminAlert[]>(`/api/v2/admin/contracts/${contractId}/alerts`, {
    signal,
  });
}

export async function listAdminAlertHistory(
  contractId: string,
  signal?: AbortSignal,
): Promise<AdminAlert[]> {
  return apiRequest<AdminAlert[]>(
    `/api/v2/admin/contracts/${contractId}/alerts/history`,
    { signal },
  );
}

export async function acknowledgeAdminAlert(
  contractId: string,
  alertId: string,
  signal?: AbortSignal,
): Promise<AdminAlert> {
  const response = await apiClient.post<AdminAlert>(
    `/api/v2/admin/contracts/${contractId}/alerts/${alertId}/acknowledge`,
    { signal },
  );
  return response.data;
}

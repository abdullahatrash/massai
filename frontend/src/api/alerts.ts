import { apiClient, apiRequest } from "./client";

export type AlertSeverity = "CRITICAL" | "HIGH" | "LOW" | "MEDIUM" | "PENDING";

export type ContractAlert = {
  acknowledgedAt: string | null;
  blockchainVerified: boolean;
  description: string;
  id: string;
  resolvedAt: string | null;
  severity: AlertSeverity | string;
  triggeredAt: string;
  verifiedAt: string | null;
};

export async function listActiveAlerts(contractId: string): Promise<ContractAlert[]> {
  return apiRequest<ContractAlert[]>(`/api/v1/contracts/${contractId}/alerts`);
}

export async function listAlertHistory(
  contractId: string,
  filters?: {
    from?: string;
    severity?: AlertSeverity;
    to?: string;
  },
): Promise<ContractAlert[]> {
  const query = new URLSearchParams();

  if (filters?.severity) {
    query.set("severity", filters.severity);
  }
  if (filters?.from) {
    query.set("from", filters.from);
  }
  if (filters?.to) {
    query.set("to", filters.to);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiRequest<ContractAlert[]>(`/api/v1/contracts/${contractId}/alerts/history${suffix}`);
}

export async function acknowledgeAlert(
  contractId: string,
  alertId: string,
): Promise<ContractAlert> {
  const response = await apiClient.post<ContractAlert>(
    `/api/v1/contracts/${contractId}/alerts/${alertId}/acknowledge`,
  );
  return response.data;
}

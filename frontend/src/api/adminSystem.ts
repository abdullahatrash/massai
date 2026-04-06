import { apiClient, apiRequest } from "./client";

export type SystemHealth = {
  activeAlertCount: number;
  auth: string;
  contractCount: number;
  db: string;
  environment: string;
  status: string;
  unprocessedUpdateCount: number;
};

export type EndpointTestResult = {
  endpoint: string;
  error?: string;
  latencyMs: number;
  ok: boolean;
  statusCode: number;
};

export async function fetchSystemHealth(
  signal?: AbortSignal,
): Promise<SystemHealth> {
  return apiRequest<SystemHealth>("/api/v2/admin/system/health", { signal });
}

export async function testEndpoint(
  endpoint: string,
  signal?: AbortSignal,
): Promise<EndpointTestResult> {
  const response = await apiClient.post<EndpointTestResult>(
    "/api/v2/admin/system/endpoint-test",
    {
      body: { endpoint },
      signal,
    },
  );
  return response.data;
}

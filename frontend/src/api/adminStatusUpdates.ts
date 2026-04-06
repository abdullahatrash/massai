import { apiClient, apiRequest } from "./client";

export type StatusUpdateItem = {
  evidenceCount: number;
  id: string;
  payload: Record<string, unknown> | null;
  processed: boolean | null;
  sensorId: string | null;
  sourceId: string | null;
  timestamp: string | null;
  updateType: string | null;
};

export type StatusUpdateDetail = StatusUpdateItem & {
  evidence: unknown[];
  ingestProfileVersion: number | null;
  ingestSchemaVersion: string | null;
};

export type StatusUpdateListParams = {
  page?: number;
  pageSize?: number;
  processed?: boolean;
  updateType?: string;
};

export type StatusUpdatePagination = {
  hasMore: boolean;
  page: number;
  pageSize: number;
  total: number;
};

export type StatusUpdateListResponse = {
  data: StatusUpdateItem[];
  pagination: StatusUpdatePagination;
};

export async function fetchStatusUpdates(
  contractId: string,
  params?: StatusUpdateListParams,
  signal?: AbortSignal,
): Promise<StatusUpdateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.updateType) searchParams.set("updateType", params.updateType);
  if (params?.processed !== undefined) searchParams.set("processed", String(params.processed));
  const query = searchParams.toString();
  const url = `/api/v2/admin/contracts/${contractId}/status-updates${query ? `?${query}` : ""}`;

  const response = await apiClient.get<StatusUpdateItem[], { pagination: StatusUpdatePagination }>(url, { signal });
  return {
    data: response.data,
    pagination: response.meta?.pagination ?? { page: 1, pageSize: 20, total: 0, hasMore: false },
  };
}

export async function fetchStatusUpdateDetail(
  contractId: string,
  updateId: string,
  signal?: AbortSignal,
): Promise<StatusUpdateDetail> {
  return apiRequest<StatusUpdateDetail>(
    `/api/v2/admin/contracts/${contractId}/status-updates/${updateId}`,
    { signal },
  );
}

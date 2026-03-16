const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type AccessTokenProvider = () => string | null;
type JsonBody = Record<string, unknown> | unknown[];
type ApiEnvelope<T, TMeta = Record<string, unknown>> = {
  data: T;
  meta?: TMeta;
};
type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonBody | null;
};

let accessTokenProvider: AccessTokenProvider = () => null;

export class ApiError extends Error {
  code: string | null;
  payload: unknown;
  status: number;

  constructor(message: string, status: number, payload: unknown, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

export type ApiResponse<T, TMeta = Record<string, unknown>> = ApiEnvelope<T, TMeta>;

function isJsonBody(value: ApiRequestInit["body"]): value is JsonBody {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return false;
  }

  return !(value instanceof Blob || value instanceof FormData || value instanceof URLSearchParams);
}

function buildRequestBody(
  headers: Headers,
  body: ApiRequestInit["body"],
): BodyInit | undefined {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (isJsonBody(body)) {
    headers.set("Content-Type", "application/json");
    return JSON.stringify(body);
  }

  return body;
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if ("error" in payload) {
      const errorPayload = payload.error;
      if (
        errorPayload &&
        typeof errorPayload === "object" &&
        "message" in errorPayload &&
        typeof errorPayload.message === "string"
      ) {
        return errorPayload.message;
      }
    }

    if ("detail" in payload && typeof payload.detail === "string") {
      return payload.detail;
    }
  }

  return "API request failed.";
}

function getErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return null;
  }

  const errorPayload = payload.error;
  if (
    errorPayload &&
    typeof errorPayload === "object" &&
    "code" in errorPayload &&
    typeof errorPayload.code === "string"
  ) {
    return errorPayload.code;
  }

  return null;
}

function isApiEnvelope<T, TMeta>(payload: unknown): payload is ApiEnvelope<T, TMeta> {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload);
}

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider;
}

async function request<T, TMeta = Record<string, unknown>>(
  path: string,
  init: ApiRequestInit = {},
): Promise<ApiResponse<T, TMeta>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const token = accessTokenProvider();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body: buildRequestBody(headers, init.body),
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload),
      response.status,
      payload,
      getErrorCode(payload),
    );
  }

  if (isApiEnvelope<T, TMeta>(payload)) {
    return payload;
  }

  return {
    data: payload as T,
  };
}

export const apiClient = {
  get<T, TMeta = Record<string, unknown>>(path: string, init?: ApiRequestInit) {
    return request<T, TMeta>(path, {
      ...init,
      method: init?.method ?? "GET",
    });
  },
  post<T, TMeta = Record<string, unknown>>(path: string, init?: ApiRequestInit) {
    return request<T, TMeta>(path, {
      ...init,
      method: init?.method ?? "POST",
    });
  },
};

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const response = await request<T>(path, init);
  return response.data;
}

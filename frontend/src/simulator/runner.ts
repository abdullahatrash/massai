import { apiRequest, ApiError } from "../api/client";

export type ScenarioStep = {
  delayMs: number;
  description: string;
  evidence?: string[];
  id: string;
  payload: Record<string, unknown>;
  title: string;
  updateType: "MILESTONE_COMPLETE" | "PHASE_CHANGE" | "PRODUCTION_UPDATE" | "QUALITY_EVENT";
};

export type ScenarioDefinition = {
  id: string;
  initialPayload: Record<string, unknown>;
  name: string;
  steps: ScenarioStep[];
  summary: string;
};

export type SimulatorAlert = {
  acknowledgedAt: string | null;
  blockchainVerified: boolean;
  description: string;
  id: string;
  resolvedAt: string | null;
  severity: string | null;
  triggeredAt: string | null;
  verifiedAt: string | null;
};

export type IngestSuccessPayload = {
  contractId: string;
  processed: boolean;
  updateId: string;
};

export type ScenarioStepResult = {
  alertDetails: SimulatorAlert[];
  currentStep: number;
  delayUntilNextStepMs: number;
  payload: Record<string, unknown>;
  response: IngestSuccessPayload;
  step: ScenarioStep;
  totalSteps: number;
};

export type ProviderClientConfig = {
  clientId: string;
  clientSecret: string;
};

export type SimulatorMilestoneSummary = {
  actualDate: string | null;
  approvalRequired: boolean;
  id: string;
  isOverdue: boolean;
  milestoneRef: string | null;
  name: string | null;
  plannedDate: string | null;
  status: string | null;
};

export type SubmitSimulatorUpdateResult = {
  response: IngestSuccessPayload;
  status: number;
};

type RunnerOptions = {
  contractId: string;
  pauseController?: PauseController;
  profileVersion?: number;
  providerClient: ProviderClientConfig;
  quantityOverride?: number;
  scenario: ScenarioDefinition;
  signal: AbortSignal;
  speedMultiplier: number;
  onStepStart: (stepState: {
    currentStep: number;
    payload: Record<string, unknown>;
    step: ScenarioStep;
    totalSteps: number;
  }) => void;
  onStepSuccess: (result: ScenarioStepResult) => void;
};

class ProviderTokenProvider {
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(private readonly providerClient: ProviderClientConfig) {}

  async getAccessToken(signal: AbortSignal): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.expiresAt - 30_000) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.providerClient.clientId,
      client_secret: this.providerClient.clientSecret,
      grant_type: "client_credentials",
    });
    const response = await fetch(buildTokenUrl(), {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      signal,
    });
    const payload = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
      expires_in?: number;
    };

    if (!response.ok || typeof payload.access_token !== "string") {
      const message =
        payload.error_description ??
        payload.error ??
        "Unable to authenticate the simulator service account.";
      throw new Error(message);
    }

    this.accessToken = payload.access_token;
    this.expiresAt = now + (payload.expires_in ?? 60) * 1000;
    return this.accessToken;
  }
}

const PROVIDER_CLIENTS = {
  E4M: {
    clientId: "provider-e4m-sa",
    clientSecret: import.meta.env.VITE_PROVIDER_E4M_CLIENT_SECRET ?? "provider-e4m-sa-secret",
  },
  FACTOR: {
    clientId: "provider-factor-sa",
    clientSecret:
      import.meta.env.VITE_PROVIDER_FACTOR_CLIENT_SECRET ?? "provider-factor-sa-secret",
  },
  TASOWHEEL: {
    clientId: "provider-tasowheel-sa",
    clientSecret:
      import.meta.env.VITE_PROVIDER_TASOWHEEL_CLIENT_SECRET ??
      "provider-tasowheel-sa-secret",
  },
} as const;

const providerTokenProviders = new Map<string, ProviderTokenProvider>();

function buildTokenUrl() {
  const realm = import.meta.env.VITE_KEYCLOAK_REALM ?? "massai";
  // In dev, use relative URL so Vite proxy forwards /realms/* to Keycloak.
  const keycloakBaseUrl = import.meta.env.DEV
    ? ""
    : import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080";
  return `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/token`;
}

function buildIngestUrlV2(contractId: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
  return `${apiBaseUrl}/api/v2/ingest/${contractId}`;
}

export class PauseController {
  private _paused = false;
  private _resumeResolve: (() => void) | null = null;

  get isPaused() {
    return this._paused;
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
    if (this._resumeResolve) {
      this._resumeResolve();
      this._resumeResolve = null;
    }
  }

  waitIfPaused(signal: AbortSignal): Promise<void> {
    if (!this._paused) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Playback stopped.", "AbortError"));
        return;
      }

      this._resumeResolve = resolve;

      const handleAbort = () => {
        this._resumeResolve = null;
        reject(new DOMException("Playback stopped.", "AbortError"));
      };
      signal.addEventListener("abort", handleAbort, { once: true });
    });
  }
}

function delay(durationMs: number, signal: AbortSignal, pauseController?: PauseController) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Playback stopped.", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      cleanup();
      if (pauseController) {
        try {
          await pauseController.waitIfPaused(signal);
        } catch (err) {
          reject(err);
          return;
        }
      }
      resolve();
    }, Math.max(0, durationMs));

    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Playback stopped.", "AbortError"));
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", handleAbort);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Uses the current user's token. Token expiry during long playbacks may cause 401. */
async function fetchAlerts(contractId: string, signal: AbortSignal) {
  return apiRequest<SimulatorAlert[]>(`/api/v2/admin/contracts/${contractId}/alerts`, {
    signal,
  });
}

function diffAlerts(previousAlerts: SimulatorAlert[], nextAlerts: SimulatorAlert[]) {
  const previousIds = new Set(previousAlerts.map((alert) => alert.id));
  return nextAlerts.filter((alert) => !previousIds.has(alert.id));
}

function buildStepPayload(
  scenario: ScenarioDefinition,
  stepIndex: number,
  contractId: string,
  profileVersion?: number,
  quantityOverride?: number,
) {
  const state = { ...scenario.initialPayload };
  for (let currentIndex = 0; currentIndex <= stepIndex; currentIndex += 1) {
    Object.assign(state, scenario.steps[currentIndex]?.payload ?? {});
  }

  // Override quantityPlanned with the contract's actual quantity_total
  if (quantityOverride != null && "quantityPlanned" in state) {
    state.quantityPlanned = quantityOverride;
  }

  const rawEvidence = scenario.steps[stepIndex]?.evidence ?? [];
  const evidence = rawEvidence.filter((url): url is string => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });

  return {
    evidence,
    payload: state,
    sourceId: `${contractId}-simulator`,
    timestamp: new Date().toISOString(),
    updateType: scenario.steps[stepIndex]?.updateType,
    ...(profileVersion != null ? { profileVersion } : {}),
  };
}

async function postScenarioUpdateV2(
  contractId: string,
  accessToken: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<SubmitSimulatorUpdateResult> {
  const response = await fetch(buildIngestUrlV2(contractId), {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  const payload = (await response.json()) as
    | { data?: IngestSuccessPayload; detail?: string; error?: { message?: string } }
    | string;

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload.error?.message ?? payload.detail ?? "Scenario step failed.";
    throw new ApiError(message, response.status, payload);
  }

  if (!payload || typeof payload !== "object" || !payload.data) {
    throw new Error("Ingest response was missing its data payload.");
  }

  return {
    response: payload.data,
    status: response.status,
  };
}

export async function runScenarioPlayback({
  contractId,
  onStepStart,
  onStepSuccess,
  pauseController,
  profileVersion,
  providerClient,
  quantityOverride,
  scenario,
  signal,
  speedMultiplier,
}: RunnerOptions) {
  const tokenProvider = getProviderTokenProvider(providerClient);
  let knownAlerts = await fetchAlerts(contractId, signal);

  for (let index = 0; index < scenario.steps.length; index += 1) {
    if (signal.aborted) {
      throw new DOMException("Playback stopped.", "AbortError");
    }
    if (pauseController) {
      await pauseController.waitIfPaused(signal);
    }

    const step = scenario.steps[index];
    const payload = buildStepPayload(scenario, index, contractId, profileVersion, quantityOverride);
    onStepStart({
      currentStep: index + 1,
      payload,
      step,
      totalSteps: scenario.steps.length,
    });

    const accessToken = await tokenProvider.getAccessToken(signal);
    const { response } = await postScenarioUpdateV2(contractId, accessToken, payload, signal);
    const currentAlerts = await fetchAlerts(contractId, signal);
    const alertDetails = diffAlerts(knownAlerts, currentAlerts);
    knownAlerts = currentAlerts;

    onStepSuccess({
      alertDetails,
      currentStep: index + 1,
      delayUntilNextStepMs:
        index === scenario.steps.length - 1
          ? 0
          : Math.round(step.delayMs / Math.max(speedMultiplier, 1)),
      payload,
      response,
      step,
      totalSteps: scenario.steps.length,
    });

    if (index < scenario.steps.length - 1) {
      await delay(step.delayMs / Math.max(speedMultiplier, 1), signal, pauseController);
    }
  }
}

type ContinuousRunnerOptions = RunnerOptions & {
  onCycleComplete: (cycleNumber: number) => void;
};

export async function runContinuousPlayback({
  onCycleComplete,
  ...options
}: ContinuousRunnerOptions) {
  let cycle = 0;

  while (!options.signal.aborted) {
    await runScenarioPlayback(options);
    cycle += 1;
    onCycleComplete(cycle);

    // Brief pause between cycles
    if (!options.signal.aborted) {
      await delay(1000 / Math.max(options.speedMultiplier, 1), options.signal);
    }
  }
}

export function getProviderClientConfig(pilotType: string | null): ProviderClientConfig | null {
  return PROVIDER_CLIENTS[(pilotType ?? "").toUpperCase() as keyof typeof PROVIDER_CLIENTS] ?? null;
}

function getProviderTokenProvider(providerClient: ProviderClientConfig) {
  const cacheKey = `${providerClient.clientId}:${providerClient.clientSecret}`;
  const existingProvider = providerTokenProviders.get(cacheKey);
  if (existingProvider) {
    return existingProvider;
  }

  const nextProvider = new ProviderTokenProvider(providerClient);
  providerTokenProviders.set(cacheKey, nextProvider);
  return nextProvider;
}

export async function submitSimulatorUpdateV2(
  contractId: string,
  providerClient: ProviderClientConfig,
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  const tokenProvider = getProviderTokenProvider(providerClient);
  const accessToken = await tokenProvider.getAccessToken(signal);
  return postScenarioUpdateV2(contractId, accessToken, body, signal);
}

export async function fetchSimulatorAlerts(contractId: string, signal: AbortSignal) {
  return fetchAlerts(contractId, signal);
}

export async function fetchSimulatorMilestones(contractId: string, signal: AbortSignal) {
  return apiRequest<SimulatorMilestoneSummary[]>(
    `/api/v2/admin/contracts/${contractId}/milestones`,
    { signal },
  );
}

export function deriveAlertRuleId(alert: SimulatorAlert) {
  const normalizedDescription = alert.description.trim();

  if (normalizedDescription.startsWith("Quality pass rate")) {
    return "QUALITY_THRESHOLD";
  }
  if (normalizedDescription.startsWith("Test failure detected")) {
    return "TEST_FAILURE";
  }
  if (normalizedDescription.startsWith("Production progress is")) {
    return "DELAY";
  }
  if (normalizedDescription.startsWith("Milestone '")) {
    return "MILESTONE_OVERDUE";
  }

  return normalizedDescription || "UNKNOWN_ALERT";
}

export function formatRunnerError(error: unknown) {
  if (isAbortError(error)) {
    return "Playback stopped.";
  }
  if (error instanceof ApiError) {
    return `${error.status}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Playback failed.";
}

export function isPlaybackAbort(error: unknown) {
  return isAbortError(error);
}

import { apiClient, apiRequest, type ApiResponse } from "./client";

export type ContractStatusBadge =
  | "ACTION_REQUIRED"
  | "COMPLETED"
  | "DELAYED"
  | "DISPUTED"
  | "ON_TRACK";

export type PilotPresentation = {
  className: string;
  icon: string;
  label: string;
};

export type ContractListItem = {
  deliveryDate: string | null;
  id: string;
  milestonesCompleted: number;
  milestonesTotal: number;
  pilotType: string | null;
  productName: string | null;
  providerId: string | null;
  status: string | null;
  statusBadge: ContractStatusBadge;
};

export type NextMilestone = {
  daysRemaining: number;
  name: string;
  plannedDate: string;
};

export type ContractOverview = ContractListItem & {
  lastKnownState: Record<string, unknown>;
  nextMilestone: NextMilestone | null;
};

export type ContractsListMeta = {
  pagination: {
    hasMore: boolean;
    page: number;
    pageSize: number;
  };
  unreadNotifications: number;
};

const PILOT_PRESENTATIONS: Record<string, PilotPresentation> = {
  E4M: {
    className: "e4m",
    icon: "plug",
    label: "E4M",
  },
  FACTOR: {
    className: "factor",
    icon: "gear",
    label: "Factor",
  },
  TASOWHEEL: {
    className: "tasowheel",
    icon: "bolt",
    label: "Tasowheel",
  },
};

const PILOT_ICON_GLYPHS: Record<PilotPresentation["icon"], string> = {
  bolt: "⚡",
  gear: "⚙️",
  plug: "🔌",
};

export function getPilotPresentation(pilotType: string | null): PilotPresentation {
  return (
    (pilotType ? PILOT_PRESENTATIONS[pilotType.toUpperCase()] : null) ?? {
      className: "default",
      icon: "gear",
      label: pilotType ?? "Contract",
    }
  );
}

export function getPilotIconGlyph(pilotType: string | null): string {
  const presentation = getPilotPresentation(pilotType);
  return PILOT_ICON_GLYPHS[presentation.icon] ?? "⚙️";
}

export function formatProviderName(providerId: string | null): string {
  if (!providerId) {
    return "Provider unavailable";
  }

  const localPart = providerId.split("@")[0] ?? providerId;
  return localPart
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export async function listContracts(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<ContractListItem[], ContractsListMeta>> {
  const query = new URLSearchParams();

  if (params?.page) {
    query.set("page", String(params.page));
  }
  if (params?.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiClient.get<ContractListItem[], ContractsListMeta>(`/api/v1/contracts${suffix}`);
}

export async function getContractOverview(contractId: string): Promise<ContractOverview> {
  return apiRequest<ContractOverview>(`/api/v1/contracts/${contractId}`);
}

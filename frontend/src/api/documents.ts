import { apiRequest } from "./client";

export type ProviderDocumentReference = {
  format?: string | null;
  name: string;
  uploadedAt?: string | null;
  url: string;
};

export type ContractDocument = {
  format: string | null;
  id: string;
  milestoneId: string;
  milestoneName: string;
  name: string;
  uploadedAt: string | null;
  url: string;
};

export type ViewerDocument = {
  format?: string | null;
  id?: string;
  milestoneId?: string;
  milestoneName?: string;
  name: string;
  uploadedAt?: string | null;
  url: string;
};

export type DocumentPreviewKind = "image" | "other" | "pdf";

function extractFileExtension(value: string): string | null {
  const sanitizedValue = value.split("#")[0]?.split("?")[0] ?? value;
  const basename = sanitizedValue.split("/").pop() ?? sanitizedValue;
  const extension = basename.split(".").pop();

  if (!extension || extension === basename) {
    return null;
  }

  return extension.toLowerCase();
}

export function toViewerDocumentFromEvidence(
  evidence: unknown,
  fallbackName: string,
): ViewerDocument | null {
  if (typeof evidence === "string") {
    return {
      name: fallbackName,
      url: evidence,
    };
  }

  if (!evidence || typeof evidence !== "object") {
    return null;
  }

  const candidate = evidence as Record<string, unknown>;
  const url = typeof candidate.url === "string" ? candidate.url : null;
  if (!url) {
    return null;
  }

  const name =
    typeof candidate.name === "string" && candidate.name.trim().length > 0
      ? candidate.name.trim()
      : typeof candidate.title === "string" && candidate.title.trim().length > 0
        ? candidate.title.trim()
        : typeof candidate.type === "string" && candidate.type.trim().length > 0
          ? candidate.type.trim()
          : fallbackName;
  const format =
    typeof candidate.format === "string" && candidate.format.trim().length > 0
      ? candidate.format.trim()
      : null;
  const uploadedAt =
    typeof candidate.uploadedAt === "string" && candidate.uploadedAt.length > 0
      ? candidate.uploadedAt
      : null;

  return {
    format,
    name,
    uploadedAt,
    url,
  };
}

export function getDocumentPreviewKind(
  document: Pick<ViewerDocument, "format" | "name" | "url">,
): DocumentPreviewKind {
  const format = document.format?.trim().toLowerCase() ?? null;
  const urlExtension = extractFileExtension(document.url);
  const nameExtension = extractFileExtension(document.name);
  const extension = urlExtension ?? nameExtension;

  if (format === "pdf" || extension === "pdf") {
    return "pdf";
  }

  if (
    format?.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(extension ?? "")
  ) {
    return "image";
  }

  return "other";
}

export async function listContractDocuments(
  contractId: string,
  milestoneRef?: string,
): Promise<ContractDocument[]> {
  const query = milestoneRef
    ? `?milestoneId=${encodeURIComponent(milestoneRef)}`
    : "";
  return apiRequest<ContractDocument[]>(`/api/v1/contracts/${contractId}/documents${query}`);
}

export async function listMilestoneDocuments(
  contractId: string,
  milestoneId: string,
): Promise<ContractDocument[]> {
  return apiRequest<ContractDocument[]>(
    `/api/v1/contracts/${contractId}/milestones/${milestoneId}/documents`,
  );
}

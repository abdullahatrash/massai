import { apiRequest } from "./client";

export type JsonSchema = {
  additionalProperties?: boolean;
  enum?: string[];
  format?: string;
  items?: JsonSchema;
  maximum?: number;
  minimum?: number;
  pattern?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
};

export type UiFieldSchema = {
  displayAs?: string;
  helpText?: string;
  itemFields?: Record<string, UiFieldSchema>;
  itemLabel?: string;
  label?: string;
  placeholder?: string;
  widget?: string;
};

export type UpdateTypeUiSchema = {
  fieldOrder?: string[];
  fields?: Record<string, UiFieldSchema>;
  groups?: Array<{
    fields: string[];
    id: string;
    title: string;
  }>;
};

export type ContractUpdateTypeSpec = {
  defaults: Record<string, unknown>;
  initialPayload: Record<string, unknown>;
  jsonSchema: JsonSchema;
  uiSchema: UpdateTypeUiSchema;
};

export type ContractIngestSpec = {
  allowedUpdateTypes: string[];
  contractContext: Record<string, unknown>;
  contractId: string;
  pilotType: string | null;
  profileKey: string;
  profileVersion: number;
  schemaVersion: string;
  updateTypes: Record<string, ContractUpdateTypeSpec>;
};

export function fetchContractIngestSpec(contractId: string, signal?: AbortSignal) {
  return apiRequest<ContractIngestSpec>(
    `/api/v2/admin/contracts/${contractId}/ingest-spec`,
    {
      signal,
    },
  );
}

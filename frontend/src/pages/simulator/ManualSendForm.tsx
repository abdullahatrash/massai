import { startTransition, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Send } from "lucide-react";

import { fetchContractIngestSpec, type ContractIngestSpec } from "@/api/ingestSpec";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DocumentReferenceEditor,
  createDocumentReferenceDraft,
  serializeDocumentReferenceDrafts,
  type DocumentReferenceDraft,
  type DocumentReferenceDraftErrors,
} from "@/components/DocumentReferenceEditor";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ApiError } from "../../api/client";
import {
  deriveAlertRuleId,
  fetchSimulatorAlerts,
  fetchSimulatorMilestones,
  formatRunnerError,
  getProviderClientConfig,
  submitSimulatorUpdateV2,
  type SimulatorAlert,
  type SimulatorMilestoneSummary,
} from "../../simulator/runner";
import {
  SchemaDrivenForm,
  buildDraftFromSpec,
  buildPayloadFromDraft,
} from "./forms/SchemaDrivenForm";
import { getPilotMeta, getPilotTheme, type SimulatorContract } from "./simulatorShared";

type ManualSendFormProps = {
  contract: SimulatorContract;
  onSubmitSettled: () => void;
};

type ResponsePanelState = {
  alertsTriggered: string[];
  httpStatus: number;
  milestoneUpdated: string | null;
  response: Record<string, unknown>;
};

function compareMilestones(
  previousMilestones: SimulatorMilestoneSummary[],
  nextMilestones: SimulatorMilestoneSummary[],
) {
  const previousIndex = new Map(
    previousMilestones.map((milestone) => [milestone.id, milestone.status ?? "UNKNOWN"]),
  );
  const changedMilestone = nextMilestones.find(
    (milestone) => previousIndex.get(milestone.id) !== (milestone.status ?? "UNKNOWN"),
  );

  if (!changedMilestone) {
    return null;
  }

  return `${changedMilestone.milestoneRef ?? changedMilestone.name ?? changedMilestone.id}: ${changedMilestone.status ?? "UNKNOWN"}`;
}

function deriveAlertRules(alerts: SimulatorAlert[]) {
  return Array.from(new Set(alerts.map((alert) => deriveAlertRuleId(alert))));
}

function mapApiValidationErrors(error: ApiError) {
  const payload = error.payload;
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return {};
  }
  const errorPayload = payload.error;
  if (!errorPayload || typeof errorPayload !== "object" || !("details" in errorPayload)) {
    return {};
  }
  const details = Array.isArray(errorPayload.details) ? errorPayload.details : [];
  return details.reduce<Record<string, string>>((accumulator, item) => {
    if (!item || typeof item !== "object") {
      return accumulator;
    }
    const field = typeof item.field === "string" ? item.field : null;
    const message = typeof item.message === "string" ? item.message : null;
    if (!field || !message) {
      return accumulator;
    }
    const normalizedField = field.startsWith("payload.") ? field.slice("payload.".length) : field;
    if (normalizedField !== "payload") {
      accumulator[normalizedField] = message;
    }
    return accumulator;
  }, {});
}

export function ManualSendForm({ contract, onSubmitSettled }: ManualSendFormProps) {
  const [ingestSpec, setIngestSpec] = useState<ContractIngestSpec | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateType, setUpdateType] = useState<string>("");
  const [formDraft, setFormDraft] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [responsePanel, setResponsePanel] = useState<ResponsePanelState | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [documentDrafts, setDocumentDrafts] = useState<DocumentReferenceDraft[]>([]);
  const [documentDraftErrors, setDocumentDraftErrors] = useState<DocumentReferenceDraftErrors>({});

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadSpec() {
      setIsLoading(true);
      setRequestError(null);

      try {
        const nextSpec = await fetchContractIngestSpec(contract.id, controller.signal);
        if (!isActive) {
          return;
        }

        const nextUpdateType =
          nextSpec.allowedUpdateTypes[0] ??
          Object.keys(nextSpec.updateTypes)[0] ??
          "";
        const nextDraft = nextUpdateType
          ? buildDraftFromSpec(nextSpec.updateTypes[nextUpdateType])
          : {};

        startTransition(() => {
          setIngestSpec(nextSpec);
          setUpdateType(nextUpdateType);
          setFormDraft(nextDraft);
          setErrors({});
          setDocumentDrafts([]);
          setDocumentDraftErrors({});
          setResponsePanel(null);
          setIsLoading(false);
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        startTransition(() => {
          setRequestError(
            error instanceof ApiError
              ? error.message
              : "Unable to load the ingest specification for this contract.",
          );
          setIsLoading(false);
        });
      }
    }

    void loadSpec();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [contract.id]);

  const activeUpdateSpec = useMemo(
    () => (ingestSpec && updateType ? ingestSpec.updateTypes[updateType] : null),
    [ingestSpec, updateType],
  );

  const providerClient = getProviderClientConfig(contract.pilotType);

  const handleUpdateTypeChange = (nextUpdateType: string | null) => {
    if (!nextUpdateType) {
      return;
    }
    setUpdateType(nextUpdateType);
    if (!ingestSpec) {
      setFormDraft({});
      return;
    }
    const nextSpec = ingestSpec.updateTypes[nextUpdateType];
    if (!nextSpec) {
      setFormDraft({});
      return;
    }
    setErrors({});
    setDocumentDraftErrors({});
    setFormDraft(buildDraftFromSpec(nextSpec));
  };

  const handleSubmit = async () => {
    if (!activeUpdateSpec) {
      return;
    }

    const validationResult = buildPayloadFromDraft(activeUpdateSpec, formDraft);
    if (!validationResult.payload) {
      startTransition(() => {
        setErrors(validationResult.errors);
        setResponsePanel(null);
      });
      return;
    }

    const serializedEvidence =
      updateType === "MILESTONE_COMPLETE"
        ? serializeDocumentReferenceDrafts(documentDrafts)
        : { documents: [], errorsById: {}, hasErrors: false };
    if (serializedEvidence.hasErrors) {
      startTransition(() => {
        setDocumentDraftErrors(serializedEvidence.errorsById);
      });
      return;
    }

    if (!providerClient || !ingestSpec) {
      startTransition(() => {
        setRequestError("No provider service account is configured for this pilot.");
      });
      return;
    }

    const controller = new AbortController();
    setIsSubmitting(true);
    setRequestError(null);
    setDocumentDraftErrors({});

    try {
      const [beforeAlerts, beforeMilestones] = await Promise.all([
        fetchSimulatorAlerts(contract.id, controller.signal),
        fetchSimulatorMilestones(contract.id, controller.signal),
      ]);

      const body = {
        evidence: serializedEvidence.documents,
        payload: validationResult.payload,
        profileVersion: ingestSpec.profileVersion,
        sourceId: `${contract.id}-manual-send`,
        timestamp: new Date().toISOString(),
        updateType,
      };

      const result = await submitSimulatorUpdateV2(
        contract.id,
        providerClient,
        body,
        controller.signal,
      );

      const [afterAlerts, afterMilestones, refreshedSpec] = await Promise.all([
        fetchSimulatorAlerts(contract.id, controller.signal),
        fetchSimulatorMilestones(contract.id, controller.signal),
        fetchContractIngestSpec(contract.id, controller.signal),
      ]);

      startTransition(() => {
        setIngestSpec(refreshedSpec);
        setDocumentDrafts([]);
        setDocumentDraftErrors({});
        setErrors({});
        const nextUpdateSpec = refreshedSpec.updateTypes[updateType] ?? refreshedSpec.updateTypes[refreshedSpec.allowedUpdateTypes[0] ?? ""];
        if (nextUpdateSpec) {
          setFormDraft(buildDraftFromSpec(nextUpdateSpec));
        }
        setResponsePanel({
          alertsTriggered: deriveAlertRules(
            afterAlerts.filter((alert) => !beforeAlerts.some((existing) => existing.id === alert.id)),
          ),
          httpStatus: result.status,
          milestoneUpdated: compareMilestones(beforeMilestones, afterMilestones),
          response: {
            alertsTriggered: deriveAlertRules(
              afterAlerts.filter((alert) => !beforeAlerts.some((existing) => existing.id === alert.id)),
            ),
            milestoneUpdated: compareMilestones(beforeMilestones, afterMilestones),
            ...result.response,
          },
        });
      });
      onSubmitSettled();
    } catch (error) {
      startTransition(() => {
        if (error instanceof ApiError) {
          const nextErrors = mapApiValidationErrors(error);
          if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
          }
        }
        setRequestError(formatRunnerError(error));
      });
      onSubmitSettled();
    } finally {
      setIsSubmitting(false);
    }
  };

  const pilotMeta = getPilotMeta(contract.pilotType);
  const pilotTheme = getPilotTheme(contract.pilotType);

  return (
    <div className="space-y-4">
      <div className="sim-panel">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-[0.58rem]", pilotTheme.badgeClassName)}>
              {pilotMeta.label}
            </Badge>
            <h3 className="text-[0.82rem] font-semibold text-white">Manual Send</h3>
          </div>
          <div className="w-56">
            <Select onValueChange={handleUpdateTypeChange} value={updateType || undefined}>
              <SelectTrigger className="h-8 border-white/[0.08] bg-white/[0.03] text-[0.72rem] text-white">
                <SelectValue placeholder="Update type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(ingestSpec?.allowedUpdateTypes ?? []).map((allowedUpdateType) => (
                    <SelectItem key={allowedUpdateType} value={allowedUpdateType}>
                      {allowedUpdateType}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {isLoading ? (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[0.72rem] text-slate-500">
              Loading ingest specification...
            </div>
          ) : null}

          {!isLoading && activeUpdateSpec ? (
            <SchemaDrivenForm
              errors={errors}
              onChange={setFormDraft}
              spec={activeUpdateSpec}
              value={formDraft}
            />
          ) : null}

          {!isLoading && !activeUpdateSpec ? (
            <div
              className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-3 text-[0.72rem] text-rose-300"
              role="alert"
            >
              No ingest spec is available for this contract.
            </div>
          ) : null}

          {!isLoading && updateType === "MILESTONE_COMPLETE" ? (
            <DocumentReferenceEditor
              description="Attach hosted document URLs for this milestone-complete update."
              errorsById={documentDraftErrors}
              onAddRow={() =>
                setDocumentDrafts((currentDrafts) => [
                  ...currentDrafts,
                  createDocumentReferenceDraft(),
                ])
              }
              onChangeRow={(id, patch) => {
                setDocumentDraftErrors({});
                setDocumentDrafts((currentDrafts) =>
                  currentDrafts.map((draft) =>
                    draft.id === id ? { ...draft, ...patch } : draft,
                  ),
                );
              }}
              onRemoveRow={(id) => {
                setDocumentDraftErrors({});
                setDocumentDrafts((currentDrafts) =>
                  currentDrafts.filter((draft) => draft.id !== id),
                );
              }}
              rows={documentDrafts}
              title="Evidence attachments"
            />
          ) : null}

          {requestError ? (
            <div
              className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-[0.72rem] text-rose-300"
              role="alert"
            >
              {requestError}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              disabled={isLoading || isSubmitting || !activeUpdateSpec}
              onClick={() => void handleSubmit()}
              size="sm"
              type="button"
            >
              <Send data-icon="inline-start" />
              {isSubmitting ? "Sending..." : "Submit update"}
            </Button>
            <Button
              onClick={() =>
                window.open(
                  `${window.location.origin}/contracts/${encodeURIComponent(contract.id)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <ArrowUpRight data-icon="inline-start" />
              Consumer view
            </Button>
          </div>
        </div>
      </div>

      <div className="sim-panel">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[0.82rem] font-semibold text-white">Submit Result</h3>
        </div>

        <div className="p-4">
          {responsePanel ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    HTTP status
                  </p>
                  <p className="mt-1.5 text-[1.1rem] font-semibold tabular-nums text-white">
                    {responsePanel.httpStatus}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Alerts
                  </p>
                  <p className="mt-1.5 text-[0.72rem] text-slate-300">
                    {responsePanel.alertsTriggered.length > 0
                      ? responsePanel.alertsTriggered.join(", ")
                      : "None"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Milestone
                  </p>
                  <p className="mt-1.5 text-[0.72rem] text-slate-300">
                    {responsePanel.milestoneUpdated ?? "None"}
                  </p>
                </div>
              </div>

              <ScrollArea className="h-[24rem] pr-2">
                <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[0.62rem] leading-relaxed text-slate-400">
                  {JSON.stringify(responsePanel.response, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-[0.78rem] font-medium text-slate-400">No response yet</p>
              <p className="mt-1 text-[0.68rem] text-slate-600">
                Submit an update to inspect the response envelope.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

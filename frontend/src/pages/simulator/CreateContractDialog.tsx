import { startTransition, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  createDemoContract,
  type CreateDemoContractPayload,
  type DemoMilestonePayload,
} from "../../api/adminContracts";
import {
  CONTRACT_TEMPLATES,
  type ContractTemplate,
} from "../../simulator/contractTemplates";
import { getPilotTheme } from "./simulatorShared";

type CreateContractDialogProps = {
  onClose: () => void;
  onCreated: () => void;
  open: boolean;
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function generateContractId(template: ContractTemplate): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `demo-${template.key}-${suffix}`;
}

function buildInitialForm(template: ContractTemplate) {
  return {
    contractId: generateContractId(template),
    productName: template.productName,
    quantityTotal: template.quantityTotal,
    deliveryDate: offsetDate(template.deliveryDateOffset),
    milestones: template.milestones.map((m) => ({
      milestoneRef: m.milestoneRef,
      name: m.name,
      plannedDate: offsetDate(m.plannedDateOffset),
      approvalRequired: m.approvalRequired,
      completionCriteria: m.completionCriteria,
    })),
  };
}

export function CreateContractDialog({
  onClose,
  onCreated,
  open,
}: CreateContractDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(
    null,
  );
  const [form, setForm] = useState(
    buildInitialForm(CONTRACT_TEMPLATES[0]),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSelectTemplate = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setForm(buildInitialForm(template));
    setError(null);
  };

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateMilestone = (
    index: number,
    patch: Partial<DemoMilestonePayload>,
  ) => {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      ),
    }));
  };

  const removeMilestone = (index: number) => {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  const addMilestone = () => {
    setForm((prev) => ({
      ...prev,
      milestones: [
        ...prev.milestones,
        {
          milestoneRef: `M${prev.milestones.length + 1}`,
          name: `Milestone ${prev.milestones.length + 1}`,
          plannedDate: offsetDate(30),
          approvalRequired: false,
          completionCriteria: {},
        },
      ],
    }));
  };

  const handleSubmit = async () => {
    const template = selectedTemplate ?? CONTRACT_TEMPLATES[0];
    if (!template || form.milestones.length === 0) {
      setError("At least one milestone is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: CreateDemoContractPayload = {
      agreementType: template.agreementType,
      consumerId: template.consumerId,
      contractId: form.contractId,
      deliveryDate: form.deliveryDate,
      factoryName: form.productName,
      milestones: form.milestones,
      pilotType: template.pilotType,
      productName: form.productName,
      profileKey: template.profileKey,
      profileVersion: template.profileVersion,
      providerId: template.providerId,
      quantityTotal: form.quantityTotal,
    };

    try {
      await createDemoContract(payload);
      startTransition(() => {
        onCreated();
        onClose();
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create contract.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTemplate = selectedTemplate ?? CONTRACT_TEMPLATES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0d1117] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0d1117] px-6 py-4">
          <h2 className="text-[1rem] font-semibold text-white">
            Create Demo Contract
          </h2>
          <button
            className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Template selector */}
          <div className="space-y-2">
            <Label className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
              Pilot Template
            </Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {CONTRACT_TEMPLATES.map((template) => {
                const theme = getPilotTheme(template.pilotType);
                const isSelected = activeTemplate.key === template.key;
                return (
                  <button
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      isSelected
                        ? "border-white/15 bg-white/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/10",
                    )}
                    key={template.key}
                    onClick={() => handleSelectTemplate(template)}
                    type="button"
                  >
                    <Badge
                      className={cn("text-[0.58rem]", theme.badgeClassName)}
                    >
                      {template.pilotType}
                    </Badge>
                    <p className="mt-2 text-[0.78rem] font-medium text-white">
                      {template.label}
                    </p>
                    <p className="mt-1 text-[0.65rem] text-slate-500">
                      {template.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contract fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                className="text-[0.7rem] text-slate-400"
                htmlFor="contractId"
              >
                Contract ID
              </Label>
              <Input
                className="bg-white/[0.03] text-[0.8rem]"
                id="contractId"
                onChange={(e) => updateField("contractId", e.target.value)}
                value={form.contractId}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-[0.7rem] text-slate-400"
                htmlFor="productName"
              >
                Product Name
              </Label>
              <Input
                className="bg-white/[0.03] text-[0.8rem]"
                id="productName"
                onChange={(e) => updateField("productName", e.target.value)}
                value={form.productName}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-[0.7rem] text-slate-400"
                htmlFor="quantityTotal"
              >
                Quantity Total
              </Label>
              <Input
                className="bg-white/[0.03] text-[0.8rem]"
                id="quantityTotal"
                min={1}
                onChange={(e) =>
                  updateField("quantityTotal", Number(e.target.value) || 1)
                }
                type="number"
                value={form.quantityTotal}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-[0.7rem] text-slate-400"
                htmlFor="deliveryDate"
              >
                Delivery Date
              </Label>
              <Input
                className="bg-white/[0.03] text-[0.8rem]"
                id="deliveryDate"
                onChange={(e) => updateField("deliveryDate", e.target.value)}
                type="date"
                value={form.deliveryDate}
              />
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                Milestones
              </Label>
              <Button
                onClick={addMilestone}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Plus className="size-3" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {form.milestones.map((milestone, index) => (
                <div
                  className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  key={index}
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <Input
                      className="bg-white/[0.03] text-[0.75rem]"
                      onChange={(e) =>
                        updateMilestone(index, {
                          milestoneRef: e.target.value,
                        })
                      }
                      placeholder="Ref (e.g. M1)"
                      value={milestone.milestoneRef}
                    />
                    <Input
                      className="bg-white/[0.03] text-[0.75rem]"
                      onChange={(e) =>
                        updateMilestone(index, { name: e.target.value })
                      }
                      placeholder="Name"
                      value={milestone.name}
                    />
                    <Input
                      className="bg-white/[0.03] text-[0.75rem]"
                      onChange={(e) =>
                        updateMilestone(index, {
                          plannedDate: e.target.value,
                        })
                      }
                      type="date"
                      value={milestone.plannedDate}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[0.65rem] text-slate-400">
                      <input
                        checked={milestone.approvalRequired}
                        className="accent-white"
                        onChange={(e) =>
                          updateMilestone(index, {
                            approvalRequired: e.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Approval
                    </label>
                    <button
                      className="rounded p-1 text-slate-600 hover:bg-white/[0.06] hover:text-rose-400"
                      onClick={() => removeMilestone(index)}
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2 text-[0.72rem] text-rose-300">
              {error}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button onClick={onClose} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || form.milestones.length === 0}
              onClick={() => void handleSubmit()}
              size="sm"
              type="button"
            >
              {isSubmitting ? "Creating..." : "Create Contract"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

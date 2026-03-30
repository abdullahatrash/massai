import { Input } from "@/components/ui/input";
import { formatQualityPercent } from "@/lib/quality";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FormField } from "./FormField";

type FactorFormValues = {
  currentStage: string;
  machineUtilization: string;
  milestoneRef: string;
  qualityPassRate: string;
  qualityRejectCount: string;
  quantityPlanned: string;
  quantityProduced: string;
  shiftsCompleted: string;
};

type FactorFormProps = {
  errors: Record<string, string>;
  onChange: (patch: Partial<FactorFormValues>) => void;
  qualityTarget?: number | null;
  values: FactorFormValues;
};

export function FactorForm({ errors, onChange, qualityTarget, values }: FactorFormProps) {
  const contractTargetLabel =
    qualityTarget !== null && qualityTarget !== undefined
      ? formatQualityPercent(qualityTarget)
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField error={errors.quantityProduced} label="Quantity produced">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ quantityProduced: event.target.value })}
          placeholder="0"
          type="number"
          value={values.quantityProduced}
        />
      </FormField>

      <FormField error={errors.quantityPlanned} label="Quantity planned">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ quantityPlanned: event.target.value })}
          placeholder="0"
          type="number"
          value={values.quantityPlanned}
        />
      </FormField>

      <FormField error={errors.qualityPassRate} label="Quality pass rate (%)">
        <>
          <Input
            className="bg-white/[0.03]"
            max="100"
            min="0"
            onChange={(event) => onChange({ qualityPassRate: event.target.value })}
            placeholder="98.5"
            step="0.1"
            type="number"
            value={values.qualityPassRate}
          />
          <p className="text-[0.68rem] text-slate-400">
            Enter the percentage value, for example 98.5.
            {contractTargetLabel ? ` Contract target: ${contractTargetLabel}.` : ""}
          </p>
        </>
      </FormField>

      <FormField error={errors.currentStage} label="Current stage">
        <Select
          onValueChange={(value) => onChange({ currentStage: value ?? "" })}
          value={values.currentStage || undefined}
        >
          <SelectTrigger className="w-full bg-white/[0.03]">
            <SelectValue placeholder="Select a stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="TURNING">TURNING</SelectItem>
              <SelectItem value="HEAT_TREATMENT">HEAT_TREATMENT</SelectItem>
              <SelectItem value="GRINDING">GRINDING</SelectItem>
              <SelectItem value="INSPECTION">INSPECTION</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FormField>

      <FormField error={errors.machineUtilization} label="Machine utilization">
        <Input
          className="bg-white/[0.03]"
          max="1"
          min="0"
          onChange={(event) => onChange({ machineUtilization: event.target.value })}
          placeholder="0.80"
          step="0.01"
          type="number"
          value={values.machineUtilization}
        />
      </FormField>

      <FormField error={errors.qualityRejectCount} label="Reject count">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ qualityRejectCount: event.target.value })}
          placeholder="0"
          type="number"
          value={values.qualityRejectCount}
        />
      </FormField>

      <FormField error={errors.shiftsCompleted} label="Shifts completed">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ shiftsCompleted: event.target.value })}
          placeholder="0"
          type="number"
          value={values.shiftsCompleted}
        />
      </FormField>

      <FormField error={errors.milestoneRef} label="Milestone ref">
        <Input
          className="bg-white/[0.03]"
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. TURNING"
          type="text"
          value={values.milestoneRef}
        />
      </FormField>
    </div>
  );
}

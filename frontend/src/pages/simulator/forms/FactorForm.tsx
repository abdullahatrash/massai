import { Input } from "@/components/ui/input";
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
  values: FactorFormValues;
};

export function FactorForm({ errors, onChange, values }: FactorFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField error={errors.quantityProduced} label="Quantity produced">
        <Input
          min="0"
          onChange={(event) => onChange({ quantityProduced: event.target.value })}
          type="number"
          value={values.quantityProduced}
        />
      </FormField>

      <FormField error={errors.quantityPlanned} label="Quantity planned">
        <Input
          min="0"
          onChange={(event) => onChange({ quantityPlanned: event.target.value })}
          type="number"
          value={values.quantityPlanned}
        />
      </FormField>

      <FormField error={errors.qualityPassRate} label="Quality pass rate">
        <Input
          max="1"
          min="0"
          onChange={(event) => onChange({ qualityPassRate: event.target.value })}
          step="0.01"
          type="number"
          value={values.qualityPassRate}
        />
      </FormField>

      <FormField error={errors.currentStage} label="Current stage">
        <Select
          onValueChange={(value) => onChange({ currentStage: value ?? "" })}
          value={values.currentStage || undefined}
        >
          <SelectTrigger className="w-full">
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
          max="1"
          min="0"
          onChange={(event) => onChange({ machineUtilization: event.target.value })}
          step="0.01"
          type="number"
          value={values.machineUtilization}
        />
      </FormField>

      <FormField error={errors.qualityRejectCount} label="Reject count">
        <Input
          min="0"
          onChange={(event) => onChange({ qualityRejectCount: event.target.value })}
          type="number"
          value={values.qualityRejectCount}
        />
      </FormField>

      <FormField error={errors.shiftsCompleted} label="Shifts completed">
        <Input
          min="0"
          onChange={(event) => onChange({ shiftsCompleted: event.target.value })}
          type="number"
          value={values.shiftsCompleted}
        />
      </FormField>

      <FormField error={errors.milestoneRef} label="Milestone ref">
        <Input
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. TURNING"
          type="text"
          value={values.milestoneRef}
        />
      </FormField>
    </div>
  );
}

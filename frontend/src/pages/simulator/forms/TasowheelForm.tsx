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

type TasowheelFormValues = {
  carbonKgCo2e: string;
  cycleTimeActualSec: string;
  downtimeMinutes: string;
  energyKwh: string;
  milestoneRef: string;
  routingStep: string;
  setupTimeActualMin: string;
  stepName: string;
  stepStatus: string;
};

type TasowheelFormProps = {
  errors: Record<string, string>;
  onChange: (patch: Partial<TasowheelFormValues>) => void;
  values: TasowheelFormValues;
};

export function TasowheelForm({ errors, onChange, values }: TasowheelFormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField error={errors.routingStep} label="Routing step">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ routingStep: event.target.value })}
          placeholder="10"
          type="number"
          value={values.routingStep}
        />
      </FormField>

      <FormField error={errors.stepName} label="Step name">
        <Input
          className="bg-white/[0.03]"
          onChange={(event) => onChange({ stepName: event.target.value })}
          placeholder="Blank Preparation"
          type="text"
          value={values.stepName}
        />
      </FormField>

      <FormField error={errors.stepStatus} label="Step status">
        <Select
          onValueChange={(value) => onChange({ stepStatus: value ?? "" })}
          value={values.stepStatus || undefined}
        >
          <SelectTrigger className="w-full bg-white/[0.03]">
            <SelectValue placeholder="Select step status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
              <SelectItem value="COMPLETE">COMPLETE</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FormField>

      <FormField error={errors.downtimeMinutes} label="Downtime minutes">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ downtimeMinutes: event.target.value })}
          placeholder="0"
          step="0.1"
          type="number"
          value={values.downtimeMinutes}
        />
      </FormField>

      <FormField error={errors.energyKwh} label="Energy kWh">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ energyKwh: event.target.value })}
          placeholder="0"
          step="0.1"
          type="number"
          value={values.energyKwh}
        />
      </FormField>

      <FormField error={errors.setupTimeActualMin} label="Setup time actual (min)">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ setupTimeActualMin: event.target.value })}
          placeholder="0"
          step="0.1"
          type="number"
          value={values.setupTimeActualMin}
        />
      </FormField>

      <FormField error={errors.cycleTimeActualSec} label="Cycle time actual (sec)">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ cycleTimeActualSec: event.target.value })}
          placeholder="0"
          step="0.1"
          type="number"
          value={values.cycleTimeActualSec}
        />
      </FormField>

      <FormField error={errors.carbonKgCo2e} label="Carbon kgCO2e">
        <Input
          className="bg-white/[0.03]"
          min="0"
          onChange={(event) => onChange({ carbonKgCo2e: event.target.value })}
          placeholder="0"
          step="0.1"
          type="number"
          value={values.carbonKgCo2e}
        />
      </FormField>

      <FormField error={errors.milestoneRef} label="Milestone ref">
        <Input
          className="bg-white/[0.03]"
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. STEP_20"
          type="text"
          value={values.milestoneRef}
        />
      </FormField>
    </div>
  );
}

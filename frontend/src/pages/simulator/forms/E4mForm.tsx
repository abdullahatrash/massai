import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { FormField, FormFieldError } from "./FormField";

type E4mTestResult = {
  defects: string;
  id: string;
  result: string;
  testName: string;
};

type E4mFormValues = {
  approvalRequired: boolean;
  completionPct: string;
  currentPhase: string;
  deliverables: string;
  milestoneRef: string;
  testResults: E4mTestResult[];
};

type E4mFormProps = {
  errors: Record<string, string>;
  onAddTestResult: () => void;
  onChange: (patch: Partial<E4mFormValues>) => void;
  onRemoveTestResult: (id: string) => void;
  onUpdateTestResult: (id: string, patch: Partial<E4mTestResult>) => void;
  values: E4mFormValues;
};

export function E4mForm({
  errors,
  onAddTestResult,
  onChange,
  onRemoveTestResult,
  onUpdateTestResult,
  values,
}: E4mFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField error={errors.currentPhase} label="Current phase">
        <Select
          onValueChange={(value) => onChange({ currentPhase: value ?? "" })}
          value={values.currentPhase || undefined}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select the current phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="M1">M1</SelectItem>
              <SelectItem value="M2">M2</SelectItem>
              <SelectItem value="M3">M3</SelectItem>
              <SelectItem value="M4">M4</SelectItem>
              <SelectItem value="M5">M5</SelectItem>
              <SelectItem value="M6">M6</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FormField>

      <FormField error={errors.completionPct} label={`Completion (${values.completionPct}%)`}>
        <Input
          max="100"
          min="0"
          onChange={(event) => onChange({ completionPct: event.target.value })}
          step="1"
          type="number"
          value={values.completionPct}
        />
      </FormField>

      <FormField label="Approval flow">
        <Button
          className="justify-start"
          onClick={() => onChange({ approvalRequired: !values.approvalRequired })}
          type="button"
          variant={values.approvalRequired ? "default" : "outline"}
        >
          {values.approvalRequired ? "Consumer approval required" : "Auto-verify milestone"}
        </Button>
      </FormField>

      <FormField error={errors.milestoneRef} label="Milestone ref">
        <Input
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. M1"
          type="text"
          value={values.milestoneRef}
        />
      </FormField>

      <FormField label="Deliverables" layout="wide">
        <Textarea
          onChange={(event) => onChange({ deliverables: event.target.value })}
          placeholder="One deliverable per line"
          rows={5}
          value={values.deliverables}
        />
      </FormField>

      <div className="grid gap-3 rounded-[28px] border border-white/10 bg-slate-950/45 p-4 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Test results
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Capture a compact validation package for the next ingest update.
            </p>
          </div>
          <Button onClick={onAddTestResult} type="button" variant="outline">
            Add test
          </Button>
        </div>
        <FormFieldError message={errors.testResults} />

        <div className="grid gap-3">
          {values.testResults.map((result, index) => (
            <div
              className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1.4fr)_180px_140px_auto]"
              key={result.id}
            >
              <FormField label="Test name">
                <Input
                  onChange={(event) =>
                    onUpdateTestResult(result.id, { testName: event.target.value })
                  }
                  type="text"
                  value={result.testName}
                />
              </FormField>

              <FormField label="Result">
                <Select
                  onValueChange={(value) =>
                    onUpdateTestResult(result.id, { result: value ?? "" })
                  }
                  value={result.result || undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="PASS">PASS</SelectItem>
                      <SelectItem value="FAIL">FAIL</SelectItem>
                      <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField error={errors[`testResults.${index}`]} label="Defects">
                <Input
                  min="0"
                  onChange={(event) =>
                    onUpdateTestResult(result.id, { defects: event.target.value })
                  }
                  type="number"
                  value={result.defects}
                />
              </FormField>

              <div className="flex items-end">
                <Button onClick={() => onRemoveTestResult(result.id)} type="button" variant="ghost">
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

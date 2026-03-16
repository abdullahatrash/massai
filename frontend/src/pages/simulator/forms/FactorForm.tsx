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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <span className="simulator-field-error">{message}</span>;
}

export function FactorForm({ errors, onChange, values }: FactorFormProps) {
  return (
    <div className="simulator-form-grid">
      <label className="simulator-field">
        <span>Quantity produced</span>
        <input
          min="0"
          onChange={(event) => onChange({ quantityProduced: event.target.value })}
          type="number"
          value={values.quantityProduced}
        />
        <FieldError message={errors.quantityProduced} />
      </label>

      <label className="simulator-field">
        <span>Quantity planned</span>
        <input
          min="0"
          onChange={(event) => onChange({ quantityPlanned: event.target.value })}
          type="number"
          value={values.quantityPlanned}
        />
        <FieldError message={errors.quantityPlanned} />
      </label>

      <label className="simulator-field">
        <span>Quality pass rate</span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ qualityPassRate: event.target.value })}
          step="0.01"
          type="number"
          value={values.qualityPassRate}
        />
        <FieldError message={errors.qualityPassRate} />
      </label>

      <label className="simulator-field">
        <span>Current stage</span>
        <select
          onChange={(event) => onChange({ currentStage: event.target.value })}
          value={values.currentStage}
        >
          <option value="TURNING">TURNING</option>
          <option value="HEAT_TREATMENT">HEAT_TREATMENT</option>
          <option value="GRINDING">GRINDING</option>
          <option value="INSPECTION">INSPECTION</option>
        </select>
        <FieldError message={errors.currentStage} />
      </label>

      <label className="simulator-field">
        <span>Machine utilization</span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ machineUtilization: event.target.value })}
          step="0.01"
          type="number"
          value={values.machineUtilization}
        />
        <FieldError message={errors.machineUtilization} />
      </label>

      <label className="simulator-field">
        <span>Reject count</span>
        <input
          min="0"
          onChange={(event) => onChange({ qualityRejectCount: event.target.value })}
          type="number"
          value={values.qualityRejectCount}
        />
        <FieldError message={errors.qualityRejectCount} />
      </label>

      <label className="simulator-field">
        <span>Shifts completed</span>
        <input
          min="0"
          onChange={(event) => onChange({ shiftsCompleted: event.target.value })}
          type="number"
          value={values.shiftsCompleted}
        />
        <FieldError message={errors.shiftsCompleted} />
      </label>

      <label className="simulator-field">
        <span>Milestone ref</span>
        <input
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. TURNING"
          type="text"
          value={values.milestoneRef}
        />
        <FieldError message={errors.milestoneRef} />
      </label>
    </div>
  );
}

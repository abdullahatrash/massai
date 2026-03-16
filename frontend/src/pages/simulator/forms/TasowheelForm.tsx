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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <span className="simulator-field-error">{message}</span>;
}

export function TasowheelForm({ errors, onChange, values }: TasowheelFormProps) {
  return (
    <div className="simulator-form-grid">
      <label className="simulator-field">
        <span>Routing step</span>
        <input
          min="0"
          onChange={(event) => onChange({ routingStep: event.target.value })}
          type="number"
          value={values.routingStep}
        />
        <FieldError message={errors.routingStep} />
      </label>

      <label className="simulator-field">
        <span>Step name</span>
        <input
          onChange={(event) => onChange({ stepName: event.target.value })}
          type="text"
          value={values.stepName}
        />
        <FieldError message={errors.stepName} />
      </label>

      <label className="simulator-field">
        <span>Step status</span>
        <select
          onChange={(event) => onChange({ stepStatus: event.target.value })}
          value={values.stepStatus}
        >
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETE">COMPLETE</option>
        </select>
        <FieldError message={errors.stepStatus} />
      </label>

      <label className="simulator-field">
        <span>Downtime minutes</span>
        <input
          min="0"
          onChange={(event) => onChange({ downtimeMinutes: event.target.value })}
          step="0.1"
          type="number"
          value={values.downtimeMinutes}
        />
        <FieldError message={errors.downtimeMinutes} />
      </label>

      <label className="simulator-field">
        <span>Energy kWh</span>
        <input
          min="0"
          onChange={(event) => onChange({ energyKwh: event.target.value })}
          step="0.1"
          type="number"
          value={values.energyKwh}
        />
        <FieldError message={errors.energyKwh} />
      </label>

      <label className="simulator-field">
        <span>Setup time actual (min)</span>
        <input
          min="0"
          onChange={(event) => onChange({ setupTimeActualMin: event.target.value })}
          step="0.1"
          type="number"
          value={values.setupTimeActualMin}
        />
        <FieldError message={errors.setupTimeActualMin} />
      </label>

      <label className="simulator-field">
        <span>Cycle time actual (sec)</span>
        <input
          min="0"
          onChange={(event) => onChange({ cycleTimeActualSec: event.target.value })}
          step="0.1"
          type="number"
          value={values.cycleTimeActualSec}
        />
        <FieldError message={errors.cycleTimeActualSec} />
      </label>

      <label className="simulator-field">
        <span>Carbon kgCO2e</span>
        <input
          min="0"
          onChange={(event) => onChange({ carbonKgCo2e: event.target.value })}
          step="0.1"
          type="number"
          value={values.carbonKgCo2e}
        />
        <FieldError message={errors.carbonKgCo2e} />
      </label>

      <label className="simulator-field">
        <span>Milestone ref</span>
        <input
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. STEP_20"
          type="text"
          value={values.milestoneRef}
        />
        <FieldError message={errors.milestoneRef} />
      </label>
    </div>
  );
}

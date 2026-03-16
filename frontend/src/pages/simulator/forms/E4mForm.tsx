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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <span className="simulator-field-error">{message}</span>;
}

export function E4mForm({
  errors,
  onAddTestResult,
  onChange,
  onRemoveTestResult,
  onUpdateTestResult,
  values,
}: E4mFormProps) {
  return (
    <div className="simulator-form-grid">
      <label className="simulator-field">
        <span>Current phase</span>
        <select
          onChange={(event) => onChange({ currentPhase: event.target.value })}
          value={values.currentPhase}
        >
          <option value="M1">M1</option>
          <option value="M2">M2</option>
          <option value="M3">M3</option>
          <option value="M4">M4</option>
          <option value="M5">M5</option>
          <option value="M6">M6</option>
        </select>
        <FieldError message={errors.currentPhase} />
      </label>

      <label className="simulator-field">
        <span>Completion %</span>
        <input
          max="100"
          min="0"
          onChange={(event) => onChange({ completionPct: event.target.value })}
          step="1"
          type="range"
          value={values.completionPct}
        />
        <strong className="simulator-inline-value">{values.completionPct}%</strong>
        <FieldError message={errors.completionPct} />
      </label>

      <label className="simulator-field simulator-toggle-field">
        <span>Approval required</span>
        <button
          aria-pressed={values.approvalRequired}
          className={values.approvalRequired ? "simulator-toggle active" : "simulator-toggle"}
          onClick={() => onChange({ approvalRequired: !values.approvalRequired })}
          type="button"
        >
          {values.approvalRequired ? "Enabled" : "Disabled"}
        </button>
      </label>

      <label className="simulator-field">
        <span>Milestone ref</span>
        <input
          onChange={(event) => onChange({ milestoneRef: event.target.value })}
          placeholder="Optional, e.g. M1"
          type="text"
          value={values.milestoneRef}
        />
        <FieldError message={errors.milestoneRef} />
      </label>

      <label className="simulator-field simulator-field-wide">
        <span>Deliverables</span>
        <textarea
          onChange={(event) => onChange({ deliverables: event.target.value })}
          placeholder="One deliverable per line"
          rows={4}
          value={values.deliverables}
        />
      </label>

      <div className="simulator-field simulator-field-wide">
        <div className="simulator-subsection-header">
          <span>Test results</span>
          <button className="ghost-button simulator-button" onClick={onAddTestResult} type="button">
            Add test
          </button>
        </div>
        <FieldError message={errors.testResults} />
        <div className="simulator-test-list">
          {values.testResults.map((result, index) => (
            <div className="simulator-test-card" key={result.id}>
              <label className="simulator-field">
                <span>Test name</span>
                <input
                  onChange={(event) =>
                    onUpdateTestResult(result.id, { testName: event.target.value })
                  }
                  type="text"
                  value={result.testName}
                />
              </label>

              <label className="simulator-field">
                <span>Result</span>
                <select
                  onChange={(event) =>
                    onUpdateTestResult(result.id, { result: event.target.value })
                  }
                  value={result.result}
                >
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </label>

              <label className="simulator-field">
                <span>Defects</span>
                <input
                  min="0"
                  onChange={(event) =>
                    onUpdateTestResult(result.id, { defects: event.target.value })
                  }
                  type="number"
                  value={result.defects}
                />
              </label>

              <button
                className="ghost-button simulator-button"
                onClick={() => onRemoveTestResult(result.id)}
                type="button"
              >
                Remove
              </button>
              <FieldError message={errors[`testResults.${index}`]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type E4mMetricsProps = {
  state: Record<string, unknown>;
};

type TestResult = {
  defects?: number;
  result?: string;
  testName?: string;
};

type Issue = {
  description?: string;
  severity?: string;
  status?: string;
  title?: string;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asTestResults(value: unknown): TestResult[] {
  return Array.isArray(value) ? value.filter((item): item is TestResult => typeof item === "object" && item !== null) : [];
}

function asIssues(value: unknown): Issue[] {
  return Array.isArray(value) ? value.filter((item): item is Issue => typeof item === "object" && item !== null) : [];
}

const phases = ["M1", "M2", "M3", "M4", "M5", "M6"];

export function E4mMetrics({ state }: E4mMetricsProps) {
  const currentPhase = asString(state.currentPhase);
  const completionPct = asNumber(state.completionPct);
  const testResults = asTestResults(state.testResults);
  const issues = asIssues(state.issues);

  const currentPhaseIndex = currentPhase ? phases.indexOf(currentPhase) : -1;

  return (
    <div className="pilot-metrics-stack" role="region" aria-label="E4M pilot metrics">
      <section className="content-card e4m-phase-card" aria-labelledby="e4m-phase-heading">
        <div className="section-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Phase pipeline</span>
            <h3 id="e4m-phase-heading">Programme progression</h3>
          </div>
        </div>

        <div className="phase-pipeline" role="list" aria-label="Phase progression">
          {phases.map((phase, index) => {
            const isActive = currentPhase === phase;
            const isCompleted = currentPhaseIndex > index;
            let statusLabel = "Upcoming";
            if (isActive) statusLabel = "Active";
            if (isCompleted) statusLabel = "Completed";

            return (
              <div
                className={`phase-pill${isActive ? " active" : ""}`}
                key={phase}
                role="listitem"
                aria-current={isActive ? "step" : undefined}
                aria-label={`${phase}: ${statusLabel}`}
              >
                {phase}
              </div>
            );
          })}
        </div>

        <div
          className="feed-inline-progress"
          role="progressbar"
          aria-valuenow={completionPct !== null ? Math.round(completionPct) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Programme completion: ${completionPct === null ? "unavailable" : `${Math.round(completionPct)}%`}`}
        >
          <div className="feed-inline-progress-track">
            <div
              className="feed-inline-progress-fill"
              style={{ width: `${Math.max(0, Math.min(completionPct ?? 0, 100))}%` }}
            />
          </div>
          <em>{completionPct === null ? "Unavailable" : `${Math.round(completionPct)}% complete`}</em>
        </div>
      </section>

      <section className="content-card e4m-table-card" aria-labelledby="e4m-tests-heading">
        <div className="section-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Tests</span>
            <h3 id="e4m-tests-heading">Latest results</h3>
          </div>
        </div>

        {testResults.length > 0 ? (
          <table className="feed-table" aria-label="Test results">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Result</th>
                <th scope="col">Defects</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((result, index) => (
                <tr key={`${result.testName ?? "test"}-${index}`}>
                  <td>{result.testName ?? `Test ${index + 1}`}</td>
                  <td>{result.result ?? "Pending"}</td>
                  <td>{result.defects ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No test results have been published for the current phase yet.</p>
        )}
      </section>

      <section className="content-card e4m-issues-card" aria-labelledby="e4m-issues-heading">
        <div className="section-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Issues</span>
            <h3 id="e4m-issues-heading">Open issue list</h3>
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="issue-list" role="list" aria-label={`${issues.length} open issues`}>
            {issues.map((issue, index) => (
              <article className="issue-card" key={`${issue.title ?? "issue"}-${index}`} role="listitem">
                <strong>{issue.title ?? "Untitled issue"}</strong>
                <p>{issue.description ?? "No description provided."}</p>
                <div className="issue-meta" aria-label="Issue details">
                  <span aria-label={`Severity: ${issue.severity ?? "unavailable"}`}>
                    {issue.severity ?? "Severity unavailable"}
                  </span>
                  <span aria-label={`Status: ${issue.status ?? "open"}`}>
                    {issue.status ?? "OPEN"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>No open issues are currently attached to this phase.</p>
        )}
      </section>
    </div>
  );
}

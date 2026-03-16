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

  return (
    <div className="pilot-metrics-stack">
      <section className="content-card e4m-phase-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Phase pipeline</span>
            <h3>Programme progression</h3>
          </div>
        </div>

        <div className="phase-pipeline">
          {phases.map((phase) => (
            <div
              className={`phase-pill${currentPhase === phase ? " active" : ""}`}
              key={phase}
            >
              {phase}
            </div>
          ))}
        </div>

        <div className="feed-inline-progress">
          <div className="feed-inline-progress-track">
            <div
              className="feed-inline-progress-fill"
              style={{ width: `${Math.max(0, Math.min(completionPct ?? 0, 100))}%` }}
            />
          </div>
          <em>{completionPct === null ? "Unavailable" : `${Math.round(completionPct)}% complete`}</em>
        </div>
      </section>

      <section className="content-card e4m-table-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Tests</span>
            <h3>Latest results</h3>
          </div>
        </div>

        {testResults.length > 0 ? (
          <table className="feed-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Result</th>
                <th>Defects</th>
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

      <section className="content-card e4m-issues-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Issues</span>
            <h3>Open issue list</h3>
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="issue-list">
            {issues.map((issue, index) => (
              <article className="issue-card" key={`${issue.title ?? "issue"}-${index}`}>
                <strong>{issue.title ?? "Untitled issue"}</strong>
                <p>{issue.description ?? "No description provided."}</p>
                <div className="issue-meta">
                  <span>{issue.severity ?? "Severity unavailable"}</span>
                  <span>{issue.status ?? "OPEN"}</span>
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

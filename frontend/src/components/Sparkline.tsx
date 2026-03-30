type SparklineProps = {
  label: string;
  points: number[];
};

function buildPolyline(points: number[]): string {
  if (points.length <= 1) {
    return "0,46 100,46";
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 46 - ((point - min) / range) * 40;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildAreaPath(points: number[]): string {
  if (points.length <= 1) {
    return "M0,46 L100,46 L100,48 L0,48 Z";
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 46 - ((point - min) / range) * 40;
    return `${x},${y}`;
  });

  return `M${coords[0]} L${coords.join(" L")} L100,48 L0,48 Z`;
}

function formatExtent(points: number[]): string {
  if (points.length === 0) {
    return "Awaiting live data";
  }

  const latest = points.at(-1) ?? 0;
  return `Latest ${Math.round(latest)}%`;
}

export function Sparkline({ label, points }: SparklineProps) {
  const latestValue = points.length > 0 ? Math.round(points.at(-1) ?? 0) : null;

  return (
    <article
      className="sparkline-card"
      aria-label={`${label}: ${latestValue !== null ? `${latestValue}%` : "no data yet"}`}
    >
      <div className="section-header">
        <div>
          <span className="eyebrow" aria-hidden="true">Trend</span>
          <h3>{label}</h3>
        </div>
        <span className="sparkline-caption" aria-hidden="true">{formatExtent(points)}</span>
      </div>

      <svg
        aria-hidden="true"
        className="sparkline-chart"
        viewBox="0 0 100 48"
        preserveAspectRatio="none"
        role="img"
      >
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="sparkline-area" d={buildAreaPath(points)} />
        <polyline className="sparkline-line" fill="none" points={buildPolyline(points)} />
      </svg>

      <p className="overview-supporting-copy">
        Showing the latest {Math.max(points.length, 1)} data points.
      </p>
    </article>
  );
}

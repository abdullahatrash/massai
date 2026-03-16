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

function formatExtent(points: number[]): string {
  if (points.length === 0) {
    return "Awaiting live data";
  }

  const latest = points.at(-1) ?? 0;
  return `Latest ${Math.round(latest)}%`;
}

export function Sparkline({ label, points }: SparklineProps) {
  return (
    <article className="sparkline-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Trend</span>
          <h3>{label}</h3>
        </div>
        <span className="sparkline-caption">{formatExtent(points)}</span>
      </div>

      <svg
        aria-hidden="true"
        className="sparkline-chart"
        viewBox="0 0 100 48"
        preserveAspectRatio="none"
      >
        <polyline className="sparkline-line" fill="none" points={buildPolyline(points)} />
      </svg>

      <p className="overview-supporting-copy">Showing the latest {Math.max(points.length, 1)} data points.</p>
    </article>
  );
}

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FactorQualityPoint, FactorVelocityPoint } from "../../api/analytics";

type QualityChartProps = {
  qualitySeries: FactorQualityPoint[];
  velocitySeries: FactorVelocityPoint[];
};

function chartLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function QualityChart({ qualitySeries, velocitySeries }: QualityChartProps) {
  const qualityData = qualitySeries.map((point) => ({
    ...point,
    label: chartLabel(point.timestamp),
  }));
  const velocityData = velocitySeries.map((point) => ({
    ...point,
    label: chartLabel(point.timestamp),
  }));

  return (
    <div className="chart-stack">
      <section className="content-card chart-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Quality</span>
            <h3>Quality pass rate over time</h3>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={260} width="100%">
            <LineChart data={qualityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 36, 38, 0.12)" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} />
              <Tooltip />
              <Legend />
              <Line dataKey="qualityPassRatePct" name="Quality %" stroke="#0f766e" strokeWidth={3} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="content-card chart-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Velocity</span>
            <h3>Production velocity</h3>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 36, 38, 0.12)" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantityDelta" fill="#14532d" name="Qty per update" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

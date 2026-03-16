import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TasowheelCarbonPoint, TasowheelEnergyPoint } from "../../api/analytics";

type EnergyChartProps = {
  carbonSeries: TasowheelCarbonPoint[];
  energySeries: TasowheelEnergyPoint[];
};

function carbonLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function EnergyChart({ carbonSeries, energySeries }: EnergyChartProps) {
  const carbonData = carbonSeries.map((point) => ({
    ...point,
    label: carbonLabel(point.timestamp),
  }));

  return (
    <div className="chart-stack">
      <section className="content-card chart-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Energy</span>
            <h3>Energy per routing step</h3>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={energySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 36, 38, 0.12)" />
              <XAxis dataKey="stepLabel" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="energyKwh" fill="#0f766e" name="Energy kWh" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="content-card chart-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Carbon</span>
            <h3>Cumulative carbon</h3>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={260} width="100%">
            <AreaChart data={carbonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 36, 38, 0.12)" />
              <XAxis dataKey="label" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend />
              <Area
                dataKey="cumulativeCarbonKgCo2e"
                fill="rgba(15, 118, 110, 0.18)"
                name="Cumulative carbon"
                stroke="#14532d"
                strokeWidth={3}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

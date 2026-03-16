import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { E4mPhasePoint, TestBreakdownPoint } from "../../api/analytics";

type PhaseChartProps = {
  phaseSeries: E4mPhasePoint[];
  testBreakdown: TestBreakdownPoint[];
};

const pieColors = ["#0f766e", "#f59e0b", "#dc2626", "#64748b"];

export function PhaseChart({ phaseSeries, testBreakdown }: PhaseChartProps) {
  return (
    <div className="chart-stack">
      <section className="content-card chart-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Phases</span>
            <h3>Phase duration vs planned</h3>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={phaseSeries}>
              <XAxis dataKey="phase" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="plannedDaysFromStart" fill="#94a3b8" name="Planned day" radius={[8, 8, 0, 0]} />
              <Bar dataKey="actualDaysFromStart" fill="#0f766e" name="Actual day" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="content-card chart-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Tests</span>
            <h3>Pass / fail breakdown</h3>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={260} width="100%">
            <PieChart>
              <Pie data={testBreakdown} dataKey="count" nameKey="result" outerRadius={90}>
                {testBreakdown.map((entry, index) => (
                  <Cell fill={pieColors[index % pieColors.length]} key={entry.result} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

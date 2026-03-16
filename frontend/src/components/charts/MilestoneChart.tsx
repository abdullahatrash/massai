import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MilestoneAnalyticsPoint } from "../../api/analytics";

type MilestoneChartProps = {
  milestones: MilestoneAnalyticsPoint[];
};

export function MilestoneChart({ milestones }: MilestoneChartProps) {
  return (
    <section className="content-card chart-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Timeline</span>
          <h3>Milestone plan vs actual</h3>
        </div>
      </div>

      <div className="chart-frame">
        <ResponsiveContainer height={280} width="100%">
          <BarChart data={milestones}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 36, 38, 0.12)" />
            <XAxis dataKey="label" tickLine={false} />
            <YAxis allowDecimals={false} tickLine={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="plannedDaysFromStart" fill="#94a3b8" name="Planned day" radius={[8, 8, 0, 0]} />
            <Bar dataKey="actualDaysFromStart" fill="#0f766e" name="Actual day" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

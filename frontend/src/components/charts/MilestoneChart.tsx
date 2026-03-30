import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import type { MilestoneAnalyticsPoint } from "../../api/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../ui/chart";

type MilestoneChartProps = {
  milestones: MilestoneAnalyticsPoint[];
};

const chartConfig = {
  plannedDaysFromStart: {
    label: "Planned day",
    color: "var(--chart-5)",
  },
  actualDaysFromStart: {
    label: "Actual day",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function MilestoneChart({ milestones }: MilestoneChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Timeline</CardDescription>
        <CardTitle>Milestone plan vs actual</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart accessibilityLayer data={milestones}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="plannedDaysFromStart"
              fill="var(--color-plannedDaysFromStart)"
              radius={4}
            />
            <Bar
              dataKey="actualDaysFromStart"
              fill="var(--color-actualDaysFromStart)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

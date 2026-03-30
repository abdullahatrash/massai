import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import type { FactorQualityPoint, FactorVelocityPoint } from "../../api/analytics";
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

const qualityConfig = {
  qualityPassRatePct: {
    label: "Quality %",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const velocityConfig = {
  quantityDelta: {
    label: "Qty per update",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

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
      <Card>
        <CardHeader>
          <CardDescription>Quality</CardDescription>
          <CardTitle>Quality pass rate over time</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={qualityConfig} className="h-[260px] w-full">
            <LineChart accessibilityLayer data={qualityData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                dataKey="qualityPassRatePct"
                type="monotone"
                stroke="var(--color-qualityPassRatePct)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Velocity</CardDescription>
          <CardTitle>Production velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={velocityConfig} className="h-[260px] w-full">
            <BarChart accessibilityLayer data={velocityData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="quantityDelta"
                fill="var(--color-quantityDelta)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

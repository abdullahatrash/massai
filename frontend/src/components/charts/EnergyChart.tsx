import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import type { TasowheelCarbonPoint, TasowheelEnergyPoint } from "../../api/analytics";
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

const energyConfig = {
  energyKwh: {
    label: "Energy kWh",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const carbonConfig = {
  cumulativeCarbonKgCo2e: {
    label: "Cumulative carbon",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function EnergyChart({ carbonSeries, energySeries }: EnergyChartProps) {
  const carbonData = carbonSeries.map((point) => ({
    ...point,
    label: carbonLabel(point.timestamp),
  }));

  return (
    <div className="chart-stack">
      <Card>
        <CardHeader>
          <CardDescription>Energy</CardDescription>
          <CardTitle>Energy per routing step</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={energyConfig} className="h-[260px] w-full">
            <BarChart accessibilityLayer data={energySeries}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="stepLabel"
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
                dataKey="energyKwh"
                fill="var(--color-energyKwh)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Carbon</CardDescription>
          <CardTitle>Cumulative carbon</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={carbonConfig} className="h-[260px] w-full">
            <AreaChart accessibilityLayer data={carbonData} margin={{ left: 12, right: 12 }}>
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
                content={<ChartTooltipContent indicator="line" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="cumulativeCarbonKgCo2e"
                type="monotone"
                fill="var(--color-cumulativeCarbonKgCo2e)"
                fillOpacity={0.3}
                stroke="var(--color-cumulativeCarbonKgCo2e)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

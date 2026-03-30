import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import type { E4mPhasePoint, TestBreakdownPoint } from "../../api/analytics";
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

type PhaseChartProps = {
  phaseSeries: E4mPhasePoint[];
  testBreakdown: TestBreakdownPoint[];
};

const phaseConfig = {
  plannedDaysFromStart: {
    label: "Planned day",
    color: "var(--chart-5)",
  },
  actualDaysFromStart: {
    label: "Actual day",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const testResultColors: Record<string, string> = {
  pass: "var(--chart-2)",
  fail: "var(--chart-1)",
  pending: "var(--chart-5)",
  skipped: "var(--chart-4)",
};

function buildTestConfig(breakdown: TestBreakdownPoint[]): ChartConfig {
  const config: ChartConfig = {
    count: { label: "Count" },
  };
  for (const point of breakdown) {
    const key = point.result.toLowerCase();
    config[key] = {
      label: point.result.charAt(0).toUpperCase() + point.result.slice(1).toLowerCase(),
      color: testResultColors[key] ?? "var(--chart-5)",
    };
  }
  return config;
}

export function PhaseChart({ phaseSeries, testBreakdown }: PhaseChartProps) {
  const testConfig = useMemo(() => buildTestConfig(testBreakdown), [testBreakdown]);

  const pieData = useMemo(
    () =>
      testBreakdown.map((point) => ({
        ...point,
        result: point.result.toLowerCase(),
        fill: `var(--color-${point.result.toLowerCase()})`,
      })),
    [testBreakdown],
  );

  const totalTests = useMemo(
    () => testBreakdown.reduce((sum, p) => sum + p.count, 0),
    [testBreakdown],
  );

  return (
    <div className="chart-stack">
      <Card>
        <CardHeader>
          <CardDescription>Phases</CardDescription>
          <CardTitle>Phase duration vs planned</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={phaseConfig} className="h-[260px] w-full">
            <BarChart accessibilityLayer data={phaseSeries}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="phase"
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

      <Card>
        <CardHeader>
          <CardDescription>Tests</CardDescription>
          <CardTitle>Pass / fail breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={testConfig} className="mx-auto aspect-square max-h-[280px]">
            <PieChart accessibilityLayer>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="result"
                innerRadius={60}
                strokeWidth={4}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {totalTests.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            Total tests
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="result" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

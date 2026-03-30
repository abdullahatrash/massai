import { startTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { DownloadIcon } from "lucide-react";

import { getContractAnalytics, type ContractAnalytics } from "../api/analytics";
import { useAuth } from "../auth/AuthProvider";
import { KpiCard } from "../components/KpiCard";
import { EnergyChart } from "../components/charts/EnergyChart";
import { MilestoneChart } from "../components/charts/MilestoneChart";
import { PhaseChart } from "../components/charts/PhaseChart";
import { QualityChart } from "../components/charts/QualityChart";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatQualityPercent, getQualityStatus } from "@/lib/quality";
import type { ContractOutletContext } from "./ContractRouteLayout";

type KpiStatus = "amber" | "green" | "neutral" | "red";

type KpiDefinition = {
  label: string;
  status: KpiStatus;
  value: string;
};

function formatPercent(value: number | undefined): string {
  if (value === undefined) {
    return "Unavailable";
  }
  return `${Math.round(value)}%`;
}

function formatNumber(value: number | undefined, suffix = ""): string {
  if (value === undefined) {
    return "Unavailable";
  }
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function targetStatus(value: number | undefined, target: number): KpiStatus {
  if (value === undefined) {
    return "neutral";
  }
  if (value >= target) {
    return "green";
  }
  if (value >= target * 0.9) {
    return "amber";
  }
  return "red";
}

function inverseTargetStatus(value: number | undefined, target: number): KpiStatus {
  if (value === undefined) {
    return "neutral";
  }
  if (value <= target) {
    return "green";
  }
  if (value <= target * 1.1) {
    return "amber";
  }
  return "red";
}

function buildKpis(
  pilotType: string | null,
  analytics: ContractAnalytics,
  qualityTarget?: number | null,
): KpiDefinition[] {
  const pilot = (pilotType ?? "").toUpperCase();
  const shared: KpiDefinition[] = [
    {
      label: "Overall progress",
      status: targetStatus(analytics.overallProgress, 100),
      value: formatPercent(analytics.overallProgress),
    },
    {
      label: "On track",
      status: analytics.isOnTrack ? "green" : "red",
      value: analytics.isOnTrack ? "Yes" : "Needs attention",
    },
  ];

  if (pilot === "FACTOR") {
    return [
      ...shared,
      {
        label: "Automated updates",
        status: targetStatus(analytics.automatedUpdatesPct, 100),
        value: formatPercent(analytics.automatedUpdatesPct),
      },
      {
        label: "Quality average",
        status: getQualityStatus(analytics.qualityPassRateAvg, qualityTarget),
        value: formatQualityPercent(analytics.qualityPassRateAvg),
      },
      {
        label: "Schedule adherence",
        status: targetStatus(analytics.scheduleAdherence, 95),
        value: formatPercent(analytics.scheduleAdherence),
      },
    ];
  }

  if (pilot === "TASOWHEEL") {
    return [
      ...shared,
      {
        label: "Cycle efficiency",
        status: targetStatus(analytics.avgCycleTimeEfficiency, 95),
        value: formatPercent(analytics.avgCycleTimeEfficiency),
      },
      {
        label: "Energy total",
        status: inverseTargetStatus(analytics.totalEnergyKwh, 50),
        value: formatNumber(analytics.totalEnergyKwh, " kWh"),
      },
      {
        label: "Resource utilisation",
        status: targetStatus(analytics.resourceUtilisationPct, 85),
        value: formatPercent(analytics.resourceUtilisationPct),
      },
    ];
  }

  if (pilot === "E4M") {
    return [
      ...shared,
      {
        label: "Phases completed",
        status: targetStatus(analytics.phasesCompleted, 6),
        value: formatNumber(analytics.phasesCompleted),
      },
      {
        label: "Test pass rate",
        status: targetStatus(analytics.testPassRate, 90),
        value: formatPercent(analytics.testPassRate),
      },
      {
        label: "Open issues",
        status: inverseTargetStatus(analytics.openIssueCount, 0),
        value: formatNumber(analytics.openIssueCount),
      },
    ];
  }

  return shared;
}

export function Analytics() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const analyticsQuery = useQuery({
    queryFn: () => getContractAnalytics(contract.id),
    queryKey: ["contract-analytics", contract.id],
  });

  useWebSocket({
    contractId: contract.id,
    onMessage: (message) => {
      if (["CONTRACT_STATE_CHANGED", "UPDATE_RECEIVED", "MILESTONE_CHANGED", "ALERT_TRIGGERED"].includes(message.type)) {
        void queryClient.invalidateQueries({ queryKey: ["contract-analytics", contract.id] });
      }
    },
  });

  const handleExport = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}/api/v1/contracts/${contract.id}/analytics/export`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );

      if (!response.ok) {
        throw new Error("Analytics export endpoint unavailable.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${contract.id}-analytics-export`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      window.print();
    }
  };

  const pilotType = (contract.pilotType ?? "").toUpperCase();

  return (
    <section className="page-stack" aria-label="Contract analytics">
      <div className="content-card analytics-shell">
        <header className="analytics-header">
          <div>
            <span className="eyebrow" aria-hidden="true">Analytics</span>
            <h3 id="analytics-heading">Contract performance against plan</h3>
            <p className="overview-supporting-copy">
              KPI cards and charts adapt to the pilot type while staying grounded in the contract analytics service.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => void handleExport()}
            type="button"
            aria-label="Export analytics data"
          >
            <DownloadIcon data-icon="inline-start" />
            Export
          </button>
        </header>

        {analyticsQuery.isPending ? (
          <p role="status" aria-live="polite">Loading analytics and chart data.</p>
        ) : null}

        {analyticsQuery.isError ? (
          <div className="content-card error-card" role="alert">
            <h3>Unable to load analytics</h3>
            <p>{analyticsQuery.error.message}</p>
          </div>
        ) : null}

        {analyticsQuery.isSuccess ? (
          <>
            <div
              className="kpi-grid"
              role="list"
              aria-label="Key performance indicators"
            >
              {buildKpis(contract.pilotType, analyticsQuery.data, contract.qualityTarget).map((kpi) => (
                <KpiCard key={kpi.label} label={kpi.label} status={kpi.status} value={kpi.value} />
              ))}
            </div>

            <div className="analytics-charts" role="region" aria-label="Performance charts">
              <MilestoneChart milestones={analyticsQuery.data.milestoneSeries} />

              {pilotType === "FACTOR" ? (
                <QualityChart
                  qualitySeries={analyticsQuery.data.factorQualitySeries}
                  velocitySeries={analyticsQuery.data.factorVelocitySeries}
                />
              ) : null}

              {pilotType === "TASOWHEEL" ? (
                <EnergyChart
                  carbonSeries={analyticsQuery.data.tasowheelCarbonSeries}
                  energySeries={analyticsQuery.data.tasowheelEnergySeries}
                />
              ) : null}

              {pilotType === "E4M" ? (
                <PhaseChart
                  phaseSeries={analyticsQuery.data.e4mPhaseSeries}
                  testBreakdown={analyticsQuery.data.e4mTestBreakdown}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

import { apiRequest } from "./client";

export type MilestoneAnalyticsPoint = {
  actualDate?: string | null;
  actualDaysFromStart?: number | null;
  label: string;
  milestoneRef?: string | null;
  plannedDate?: string | null;
  plannedDaysFromStart?: number | null;
};

export type FactorQualityPoint = {
  quantityProduced?: number | null;
  qualityPassRatePct?: number | null;
  timestamp: string;
};

export type FactorVelocityPoint = {
  quantityDelta: number;
  timestamp: string;
};

export type TasowheelEnergyPoint = {
  energyKwh: number;
  routingStep: number;
  stepLabel: string;
};

export type TasowheelCarbonPoint = {
  cumulativeCarbonKgCo2e: number;
  timestamp: string;
};

export type E4mPhasePoint = {
  actualDaysFromStart?: number | null;
  phase: string;
  plannedDaysFromStart?: number | null;
};

export type TestBreakdownPoint = {
  count: number;
  result: string;
};

export type ContractAnalytics = {
  automatedUpdatesPct?: number;
  avgCycleTimeEfficiency?: number;
  avgPhaseCompletionDays?: number;
  daysUntilDelivery?: number | null;
  e4mPhaseSeries: E4mPhasePoint[];
  e4mTestBreakdown: TestBreakdownPoint[];
  factorQualitySeries: FactorQualityPoint[];
  factorVelocitySeries: FactorVelocityPoint[];
  isOnTrack: boolean;
  milestoneSeries: MilestoneAnalyticsPoint[];
  openIssueCount?: number;
  overallProgress: number;
  phasesCompleted?: number;
  qualityPassRateAvg?: number;
  resourceUtilisationPct?: number;
  scheduleAdherence?: number;
  tasowheelCarbonSeries: TasowheelCarbonPoint[];
  tasowheelEnergySeries: TasowheelEnergyPoint[];
  testPassRate?: number;
  totalCarbonKgCo2e?: number;
  totalDowntimeMinutes?: number;
  totalEnergyKwh?: number;
};

export async function getContractAnalytics(contractId: string): Promise<ContractAnalytics> {
  return apiRequest<ContractAnalytics>(`/api/v1/contracts/${contractId}/analytics`);
}

export type MilestoneTemplate = {
  approvalRequired: boolean;
  completionCriteria: Record<string, unknown>;
  milestoneRef: string;
  name: string;
  plannedDateOffset: number; // days from now
};

export type ContractTemplate = {
  agreementType: string;
  consumerId: string;
  deliveryDateOffset: number; // days from now
  description: string;
  key: string;
  label: string;
  milestones: MilestoneTemplate[];
  pilotType: string;
  productName: string;
  profileKey: string;
  profileVersion: number;
  providerId: string;
  quantityTotal: number;
};

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    key: "factor",
    label: "Factor — Gear Machining Cell",
    description:
      "Discrete machining workflow focused on throughput, quality, and milestone completion.",
    pilotType: "FACTOR",
    agreementType: "PRODUCTION_MONITORING",
    productName: "Helical Gear Type A - Demo Batch",
    quantityTotal: 1200,
    deliveryDateOffset: 90,
    consumerId: "admin@test.com",
    providerId: "provider-factor-sa",
    profileKey: "FACTOR_DEFAULT",
    profileVersion: 1,
    milestones: [
      {
        milestoneRef: "TURNING",
        name: "Turning",
        plannedDateOffset: 14,
        approvalRequired: false,
        completionCriteria: { currentStage: "TURNING" },
      },
      {
        milestoneRef: "INSPECTION",
        name: "Inspection",
        plannedDateOffset: 45,
        approvalRequired: true,
        completionCriteria: { currentStage: "INSPECTION", qualityPassRate: 0.99 },
      },
    ],
  },
  {
    key: "tasowheel",
    label: "Tasowheel — Routing Cell",
    description:
      "Routing-centric pilot covering setup time, cycle time, and downtime monitoring.",
    pilotType: "TASOWHEEL",
    agreementType: "ROUTING_EXECUTION",
    productName: "CNC Routed Assembly - Demo Run",
    quantityTotal: 500,
    deliveryDateOffset: 60,
    consumerId: "admin@test.com",
    providerId: "provider-tasowheel-sa",
    profileKey: "TASOWHEEL_DEFAULT",
    profileVersion: 1,
    milestones: [
      {
        milestoneRef: "STEP_10",
        name: "Blank Preparation",
        plannedDateOffset: 14,
        approvalRequired: false,
        completionCriteria: { routingStep: 10, stepStatus: "COMPLETE" },
      },
      {
        milestoneRef: "STEP_40",
        name: "Final Dispatch Check",
        plannedDateOffset: 45,
        approvalRequired: true,
        completionCriteria: { routingStep: 40, stepStatus: "COMPLETE" },
      },
    ],
  },
  {
    key: "e4m",
    label: "E4M — Phase-Gated Program",
    description:
      "Program-style pilot tracking phases, test results, and approval gates.",
    pilotType: "E4M",
    agreementType: "PHASE_GATED_DELIVERY",
    productName: "Subsystem Integration - Demo Program",
    quantityTotal: 1,
    deliveryDateOffset: 120,
    consumerId: "admin@test.com",
    providerId: "provider-e4m-sa",
    profileKey: "E4M_DEFAULT",
    profileVersion: 1,
    milestones: [
      {
        milestoneRef: "M1",
        name: "Concept Freeze",
        plannedDateOffset: 30,
        approvalRequired: false,
        completionCriteria: { currentPhase: "M1", completionPct: 100 },
      },
      {
        milestoneRef: "M2",
        name: "Subsystem Review",
        plannedDateOffset: 60,
        approvalRequired: true,
        completionCriteria: { currentPhase: "M2", completionPct: 100 },
      },
    ],
  },
];

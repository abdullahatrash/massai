import type { ScenarioDefinition } from "../runner";

export const e4mScenarios: ScenarioDefinition[] = [
  {
    id: "e4m-normal-development",
    name: "Normal Development",
    summary: "The E4M pilot moves through M1 with steady completion progress and deliverables.",
    initialPayload: {
      approvalRequired: false,
      completionPct: 15,
      currentPhase: "M1",
      deliverables: ["Architecture brief"],
      issues: [],
      testResults: [],
    },
    steps: [
      {
        id: "e4m-normal-1",
        title: "Architecture package expands",
        description: "Progress climbs as the interface inventory is delivered.",
        delayMs: 4500,
        updateType: "PHASE_CHANGE",
        payload: {
          completionPct: 45,
          deliverables: ["Architecture brief", "Interface inventory"],
        },
      },
      {
        id: "e4m-normal-2",
        title: "Backlog gets locked",
        description: "A production update captures the next major planning increment.",
        delayMs: 5000,
        updateType: "PRODUCTION_UPDATE",
        payload: {
          completionPct: 80,
          deliverables: ["Architecture brief", "Interface inventory", "Initial backlog"],
        },
      },
    ],
  },
  {
    id: "e4m-test-failure-m5",
    name: "Test Failure at M5",
    summary: "A late-phase verification run fails during M5 readiness checks.",
    initialPayload: {
      approvalRequired: true,
      completionPct: 74,
      currentPhase: "M5",
      deliverables: ["Pilot readiness bundle"],
      issues: [],
      testResults: [
        {
          defects: 0,
          result: "PASS",
          testName: "Factory acceptance",
        },
      ],
    },
    steps: [
      {
        id: "e4m-failure-1",
        title: "Readiness push",
        description: "M5 nears completion before the failure appears.",
        delayMs: 4000,
        updateType: "PRODUCTION_UPDATE",
        payload: {
          completionPct: 90,
          deliverables: ["Pilot readiness bundle", "Regression plan"],
        },
      },
      {
        id: "e4m-failure-2",
        title: "Thermal endurance fails",
        description: "Push a quality event that should trigger the test failure alert path.",
        delayMs: 5000,
        updateType: "QUALITY_EVENT",
        payload: {
          completionPct: 92,
          issues: [
            {
              severity: "HIGH",
              status: "OPEN",
              title: "Thermal drift",
            },
          ],
          testResults: [
            {
              defects: 0,
              result: "PASS",
              testName: "Factory acceptance",
            },
            {
              defects: 2,
              result: "FAIL",
              testName: "Thermal endurance",
            },
          ],
        },
      },
    ],
  },
];

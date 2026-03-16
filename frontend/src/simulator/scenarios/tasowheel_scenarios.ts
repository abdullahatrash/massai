import type { ScenarioDefinition } from "../runner";

export const tasowheelScenarios: ScenarioDefinition[] = [
  {
    id: "tasowheel-normal-routing",
    name: "Normal Routing",
    summary: "The wheel progresses smoothly from blank prep into CNC machining.",
    initialPayload: {
      carbonKgCo2e: 7.4,
      cycleTimeActualSec: 152,
      downtimeMinutes: 4,
      energyKwh: 18.2,
      routingStep: 10,
      setupTimeActualMin: 40,
      stepName: "Blank Preparation",
      stepStatus: "IN_PROGRESS",
    },
    steps: [
      {
        id: "tasowheel-normal-1",
        title: "Blank preparation completes",
        description: "Close the first routing step with a healthy throughput reading.",
        delayMs: 4000,
        updateType: "PRODUCTION_UPDATE",
        payload: {
          downtimeMinutes: 5,
          energyKwh: 19.1,
          stepStatus: "COMPLETE",
        },
      },
      {
        id: "tasowheel-normal-2",
        title: "CNC machining starts",
        description: "Advance the routing plan into the machining station.",
        delayMs: 5000,
        updateType: "PRODUCTION_UPDATE",
        payload: {
          cycleTimeActualSec: 141,
          energyKwh: 23.7,
          routingStep: 20,
          setupTimeActualMin: 28,
          stepName: "CNC Machining",
          stepStatus: "IN_PROGRESS",
        },
      },
    ],
  },
  {
    id: "tasowheel-machine-downtime",
    name: "Machine Downtime",
    summary: "CNC machining remains active, but downtime spikes and cycle time stretches.",
    initialPayload: {
      carbonKgCo2e: 8.5,
      cycleTimeActualSec: 147,
      downtimeMinutes: 6,
      energyKwh: 22.4,
      routingStep: 20,
      setupTimeActualMin: 30,
      stepName: "CNC Machining",
      stepStatus: "IN_PROGRESS",
    },
    steps: [
      {
        id: "tasowheel-downtime-1",
        title: "First stoppage",
        description: "Downtime jumps sharply while the machine stays in progress.",
        delayMs: 4500,
        updateType: "PRODUCTION_UPDATE",
        payload: {
          cycleTimeActualSec: 188,
          downtimeMinutes: 48,
          energyKwh: 30.8,
        },
      },
      {
        id: "tasowheel-downtime-2",
        title: "Escalated downtime",
        description: "The second update confirms a prolonged machine interruption.",
        delayMs: 5000,
        updateType: "PRODUCTION_UPDATE",
        payload: {
          carbonKgCo2e: 11.7,
          cycleTimeActualSec: 205,
          downtimeMinutes: 64,
        },
      },
    ],
  },
];

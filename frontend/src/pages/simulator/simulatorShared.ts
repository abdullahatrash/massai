export type SimulatorContract = {
  id: string;
  pilotType: string | null;
  status: string | null;
  statusBadge: string;
  productName: string | null;
  providerId: string | null;
  deliveryDate: string | null;
  milestonesCompleted: number;
  milestonesTotal: number;
};

export type ContractsState =
  | { status: "loading" }
  | { status: "success"; contracts: SimulatorContract[] }
  | { status: "error"; message: string };

export type ConnectionState =
  | { status: "checking"; details: string }
  | { status: "connected"; details: string }
  | { status: "unavailable"; details: string };

export type SimulatorOutletContext = {
  connectionState: ConnectionState;
  contractsState: ContractsState;
  refreshSimulatorData: () => void;
};

type PilotMeta = {
  accentClass: string;
  icon: string;
  label: string;
  simulatorHeading: string;
};

const DEFAULT_META: PilotMeta = {
  accentClass: "neutral",
  icon: "S",
  label: "Sensor",
  simulatorHeading: "Sensor Simulator",
};

const PILOT_META: Record<string, PilotMeta> = {
  E4M: {
    accentClass: "e4m",
    icon: "E4",
    label: "E4M",
    simulatorHeading: "E4M Simulator",
  },
  FACTOR: {
    accentClass: "factor",
    icon: "F",
    label: "Factor",
    simulatorHeading: "Factor Simulator",
  },
  TASOWHEEL: {
    accentClass: "tasowheel",
    icon: "T",
    label: "Tasowheel",
    simulatorHeading: "Tasowheel Simulator",
  },
};

export function getPilotMeta(pilotType: string | null): PilotMeta {
  if (!pilotType) {
    return DEFAULT_META;
  }

  return PILOT_META[pilotType.toUpperCase()] ?? DEFAULT_META;
}

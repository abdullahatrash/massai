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

type PilotTheme = {
  badgeClassName: string;
  highlightClassName: string;
  iconClassName: string;
  panelClassName: string;
  progressClassName: string;
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

const DEFAULT_THEME: PilotTheme = {
  badgeClassName: "border-white/15 bg-white/8 text-white/80",
  highlightClassName: "from-white/10 via-white/5 to-transparent",
  iconClassName: "border-white/15 bg-white/10 text-white",
  panelClassName: "border-white/12 bg-white/[0.04]",
  progressClassName:
    "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-white/70 [&_[data-slot=progress-indicator]]:to-white",
};

const PILOT_THEMES: Record<string, PilotTheme> = {
  E4M: {
    badgeClassName: "border-sky-300/25 bg-sky-300/12 text-sky-100",
    highlightClassName: "from-sky-400/18 via-blue-500/8 to-transparent",
    iconClassName: "border-sky-300/20 bg-sky-400/14 text-sky-100",
    panelClassName: "border-sky-300/14 bg-sky-400/[0.05]",
    progressClassName:
      "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-sky-300 [&_[data-slot=progress-indicator]]:to-blue-400",
  },
  FACTOR: {
    badgeClassName: "border-amber-300/25 bg-amber-300/12 text-amber-50",
    highlightClassName: "from-amber-400/18 via-orange-500/10 to-transparent",
    iconClassName: "border-amber-300/20 bg-amber-400/14 text-amber-50",
    panelClassName: "border-amber-300/14 bg-amber-400/[0.05]",
    progressClassName:
      "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-amber-200 [&_[data-slot=progress-indicator]]:to-orange-400",
  },
  TASOWHEEL: {
    badgeClassName: "border-emerald-300/25 bg-emerald-300/12 text-emerald-50",
    highlightClassName: "from-emerald-400/18 via-cyan-500/10 to-transparent",
    iconClassName: "border-emerald-300/20 bg-emerald-400/14 text-emerald-50",
    panelClassName: "border-emerald-300/14 bg-emerald-400/[0.05]",
    progressClassName:
      "[&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-emerald-200 [&_[data-slot=progress-indicator]]:to-cyan-400",
  },
};

export function getPilotMeta(pilotType: string | null): PilotMeta {
  if (!pilotType) {
    return DEFAULT_META;
  }

  return PILOT_META[pilotType.toUpperCase()] ?? DEFAULT_META;
}

export function getPilotTheme(pilotType: string | null): PilotTheme {
  if (!pilotType) {
    return DEFAULT_THEME;
  }

  return PILOT_THEMES[pilotType.toUpperCase()] ?? DEFAULT_THEME;
}

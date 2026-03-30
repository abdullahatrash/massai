import { startTransition, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  ChevronLeft,
  LogOut,
  RefreshCcw,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { ApiError, apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import {
  type ConnectionState,
  type SimulatorContract,
  type SimulatorOutletContext,
  getPilotMeta,
  getPilotTheme,
} from "./simulatorShared";

type HealthcheckPayload = {
  auth: string;
  db: string;
  environment: string;
  status: string;
};

type ContractsState =
  | { status: "loading" }
  | { status: "success"; contracts: SimulatorContract[] }
  | { status: "error"; message: string };

function formatConnectionState(connectionState: ConnectionState) {
  if (connectionState.status === "connected") {
    return "Online";
  }

  if (connectionState.status === "unavailable") {
    return "Offline";
  }

  return "Checking";
}

function getConnectionDotClassName(connectionState: ConnectionState) {
  if (connectionState.status === "connected") {
    return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]";
  }

  if (connectionState.status === "unavailable") {
    return "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]";
  }

  return "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] animate-pulse";
}

export function SimulatorLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "checking",
    details: "Pinging backend API.",
  });
  const [contractsState, setContractsState] = useState<ContractsState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadSimulatorData() {
      startTransition(() => {
        setConnectionState({
          status: "checking",
          details: "Pinging backend API.",
        });
        setContractsState({ status: "loading" });
      });

      try {
        const [healthcheck, contracts] = await Promise.all([
          apiRequest<HealthcheckPayload>("/health"),
          apiRequest<SimulatorContract[]>("/api/v1/contracts"),
        ]);

        if (!isActive) {
          return;
        }

        startTransition(() => {
          setConnectionState({
            status: "connected",
            details:
              healthcheck.status === "ok"
                ? `Backend reachable in ${healthcheck.environment}.`
                : `Backend reachable with ${healthcheck.status} dependencies.`,
          });
          setContractsState({
            status: "success",
            contracts,
          });
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof ApiError
            ? error.message
            : "Unable to load the simulator control surface.";

        startTransition(() => {
          setConnectionState({
            status: "unavailable",
            details: "Backend API is not reachable right now.",
          });
          setContractsState({
            status: "error",
            message,
          });
        });
      }
    }

    void loadSimulatorData();

    return () => {
      isActive = false;
    };
  }, [requestVersion]);

  const context: SimulatorOutletContext = {
    connectionState,
    contractsState,
    refreshSimulatorData: () => {
      startTransition(() => {
        setRequestVersion((currentVersion) => currentVersion + 1);
      });
    },
  };

  const contracts = contractsState.status === "success" ? contractsState.contracts : [];
  const pilotCount = new Set(contracts.map((contract) => contract.pilotType ?? "UNKNOWN")).size;
  const averageCompletion =
    contracts.length > 0
      ? Math.round(
          contracts.reduce((total, contract) => {
            if (contract.milestonesTotal === 0) {
              return total;
            }

            return total + contract.milestonesCompleted / contract.milestonesTotal;
          }, 0) /
            contracts.length *
            100,
        )
      : 0;

  const isOnIndex = location.pathname === "/simulator" || location.pathname === "/simulator/";

  return (
    <div className={cn("sim-shell", sidebarCollapsed && "sim-shell--collapsed")}>
      {/* ── SIDEBAR ── */}
      <aside
        className={cn(
          "sim-sidebar",
          sidebarCollapsed && "sim-sidebar--collapsed",
        )}
      >
        {/* Brand */}
        <div className="sim-sidebar__brand">
          {!sidebarCollapsed && (
            <>
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400/20 to-emerald-400/20 ring-1 ring-white/10">
                  <Zap className="size-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-[0.8rem] font-semibold tracking-tight text-white">MASSAI</p>
                  <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">Simulator</p>
                </div>
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <Button
              className="size-8 bg-gradient-to-br from-amber-400/20 to-emerald-400/20 ring-1 ring-white/10 hover:ring-white/20"
              onClick={() => setSidebarCollapsed(false)}
              size="icon"
              title="Expand sidebar"
              variant="ghost"
            >
              <Zap className="size-4 text-amber-300" />
            </Button>
          )}
          {!sidebarCollapsed && (
            <Button
              className="sim-sidebar__toggle"
              onClick={() => setSidebarCollapsed(true)}
              size="icon-xs"
              variant="ghost"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Status */}
        {!sidebarCollapsed && (
          <div className="sim-sidebar__status">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", getConnectionDotClassName(connectionState))} />
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-slate-400">
                {formatConnectionState(connectionState)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[0.7rem] text-slate-500">
              <span>{contracts.length} contracts</span>
              <span className="text-slate-700">|</span>
              <span>{pilotCount} pilots</span>
              <span className="text-slate-700">|</span>
              <span>{averageCompletion}%</span>
            </div>
          </div>
        )}

        {/* Navigation Label */}
        {!sidebarCollapsed && (
          <div className="px-3 pb-1 pt-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-slate-600">
              Contracts
            </p>
          </div>
        )}

        {/* Contract List */}
        <ScrollArea className="sim-sidebar__nav">
          <nav aria-label="Simulator contracts" className="grid gap-1.5 px-2 py-1">
            {/* Home link */}
            <NavLink
              className={({ isActive }) =>
                cn(
                  "sim-nav-item",
                  isActive && "sim-nav-item--active",
                )
              }
              end
              to="/simulator"
            >
              {sidebarCollapsed ? (
                <div className="grid size-8 place-items-center rounded-md bg-white/[0.06] text-[0.65rem] font-bold text-slate-300">
                  <Activity className="size-3.5" />
                </div>
              ) : (
                <>
                  <div className="grid size-8 place-items-center rounded-md bg-white/[0.06]">
                    <Activity className="size-3.5 text-slate-400" />
                  </div>
                  <span className="text-[0.78rem] font-medium text-slate-300">Overview</span>
                </>
              )}
            </NavLink>

            {/* Contract items */}
            {contractsState.status === "loading" ? (
              !sidebarCollapsed ? (
                <div className="px-2 py-3 text-[0.72rem] text-slate-500">Loading contracts...</div>
              ) : null
            ) : null}

            {contractsState.status === "error" ? (
              !sidebarCollapsed ? (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2 py-2 text-[0.72rem] text-rose-300">
                  {contractsState.message}
                </div>
              ) : null
            ) : null}

            {contractsState.status === "success"
              ? contractsState.contracts.map((contract) => {
                  const pilotMeta = getPilotMeta(contract.pilotType);
                  const pilotTheme = getPilotTheme(contract.pilotType);
                  const progressPct =
                    contract.milestonesTotal > 0
                      ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
                      : 0;

                  return (
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          "sim-nav-item",
                          isActive && "sim-nav-item--active",
                        )
                      }
                      key={contract.id}
                      to={`/simulator/${contract.id}`}
                    >
                      {sidebarCollapsed ? (
                        <div
                          className={cn(
                            "grid size-8 place-items-center rounded-md text-[0.6rem] font-bold",
                            pilotTheme.iconClassName,
                          )}
                          title={contract.productName ?? contract.id}
                        >
                          {pilotMeta.icon}
                        </div>
                      ) : (
                        <>
                          <div
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-lg text-[0.65rem] font-bold tracking-wide",
                              pilotTheme.iconClassName,
                            )}
                          >
                            {pilotMeta.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.82rem] font-medium text-slate-200">
                              {contract.productName ?? contract.id}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    pilotTheme.iconClassName.includes("sky")
                                      ? "bg-sky-400/70"
                                      : pilotTheme.iconClassName.includes("amber")
                                        ? "bg-amber-400/70"
                                        : pilotTheme.iconClassName.includes("emerald")
                                          ? "bg-emerald-400/70"
                                          : "bg-white/40",
                                  )}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-[0.65rem] tabular-nums text-slate-500">
                                {progressPct}%
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </NavLink>
                  );
                })
              : null}
          </nav>
        </ScrollArea>

        {/* Sidebar Footer — User / Roles */}
        <div className="sim-sidebar__footer">
          <Popover>
            <PopoverTrigger
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg p-1.5 transition hover:bg-white/[0.06]",
                sidebarCollapsed && "justify-center",
              )}
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-700/60 to-slate-800/60 ring-1 ring-white/10">
                <span className="text-[0.65rem] font-bold uppercase text-slate-300">
                  {(user?.name ?? user?.email ?? "A").charAt(0)}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[0.76rem] font-medium text-slate-200">
                    {user?.name ?? user?.email ?? "Admin"}
                  </p>
                  <p className="truncate text-[0.62rem] text-slate-500">
                    {user?.roles.length ? `${user.roles.length} role${user.roles.length > 1 ? "s" : ""}` : "no roles"}
                  </p>
                </div>
              )}
            </PopoverTrigger>
            <PopoverContent
              className="w-64 border border-white/10 bg-[#0f1520] p-0 text-white shadow-xl ring-0"
              side={sidebarCollapsed ? "right" : "top"}
              sideOffset={8}
            >
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[0.78rem] font-semibold text-white">
                  {user?.name ?? "Unknown user"}
                </p>
                <p className="mt-0.5 truncate text-[0.68rem] text-slate-400">
                  {user?.email ?? "No email"}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Roles
                </p>
                {user?.roles.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Badge
                        className="border-white/10 bg-white/[0.05] text-[0.65rem] text-slate-300"
                        key={role}
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[0.7rem] text-slate-500">No roles assigned</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="sim-main">
        {/* ── TOPBAR ── */}
        <header className="sim-topbar">
          <div className="flex items-center gap-3">
            {isOnIndex ? (
              <h1 className="text-[0.82rem] font-semibold text-white">Operations Deck</h1>
            ) : (
              <nav className="flex items-center gap-1.5 text-[0.78rem]">
                <Button
                  className="h-auto p-0 text-[0.78rem] text-slate-400 hover:text-white"
                  onClick={() => void navigate("/simulator")}
                  variant="link"
                >
                  Simulator
                </Button>
                <span className="text-slate-600">/</span>
                <span className="font-medium text-white">Contract</span>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-1">
            <div className="mr-1 flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
              <span className={cn("size-1.5 rounded-full", getConnectionDotClassName(connectionState))} />
              <span className="text-[0.68rem] text-slate-400">{formatConnectionState(connectionState)}</span>
            </div>

            <Button
              className="size-8"
              onClick={context.refreshSimulatorData}
              size="icon"
              title="Refresh"
              variant="ghost"
            >
              <RefreshCcw className="size-3.5" />
            </Button>

            <Button
              onClick={() => void navigate("/contracts")}
              size="sm"
              variant="ghost"
            >
              <ArrowUpRight className="size-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>

            <Button
              onClick={() => void logout()}
              size="sm"
              variant="ghost"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="sim-content">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}

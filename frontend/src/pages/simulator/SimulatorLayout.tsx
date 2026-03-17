import { startTransition, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  LogOut,
  RadioTower,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    return "Connected";
  }

  if (connectionState.status === "unavailable") {
    return "Unavailable";
  }

  return "Checking";
}

function getConnectionBadgeClassName(connectionState: ConnectionState) {
  if (connectionState.status === "connected") {
    return "border-emerald-300/25 bg-emerald-300/12 text-emerald-50";
  }

  if (connectionState.status === "unavailable") {
    return "border-rose-300/25 bg-rose-300/12 text-rose-100";
  }

  return "border-amber-300/25 bg-amber-300/12 text-amber-50";
}

export function SimulatorLayout() {
  const { logout, user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "checking",
    details: "Pinging backend API.",
  });
  const [contractsState, setContractsState] = useState<ContractsState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08111b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(233,153,34,0.16),transparent_22%),radial-gradient(circle_at_80%_16%,rgba(37,186,153,0.16),transparent_24%),linear-gradient(160deg,#04090f_0%,#08111b_48%,#0f1d2b_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />

      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <header>
          <Card className="overflow-hidden border-white/10 bg-white/[0.045] shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <CardHeader className="relative gap-5 border-b border-white/8 pb-5">
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_56%)] opacity-50" />
              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <Badge className="border-amber-300/25 bg-amber-300/12 text-amber-50">
                      Factory simulator
                    </Badge>
                    <CardTitle className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                      Operations deck for seeded pilot contracts
                    </CardTitle>
                    <CardDescription className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                      Keep test sends, scenario playback, milestone triggers, and live socket
                      telemetry inside one controlled operator workspace.
                    </CardDescription>
                  </div>

                  <div className="grid gap-2 text-right text-sm text-slate-300">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Session mode
                    </span>
                    <span>Development-only factory-side tooling</span>
                  </div>
                </div>

                <div className="grid gap-3 rounded-[30px] border border-white/10 bg-slate-950/45 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          API status
                        </p>
                        <Badge className={getConnectionBadgeClassName(connectionState)}>
                          {formatConnectionState(connectionState)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {connectionState.details}
                      </p>
                    </section>

                    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Operator account
                        </p>
                        <ShieldCheck className="text-slate-500" />
                      </div>
                      <p className="mt-3 truncate text-sm font-semibold text-white">
                        {user?.name ?? user?.email ?? "Unknown admin"}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-300">
                        {user?.email ?? "No email available"}
                      </p>
                      <p className="mt-3 truncate rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                        Roles: {user?.roles.join(", ") || "none"}
                      </p>
                    </section>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={context.refreshSimulatorData} type="button" variant="outline">
                      <RefreshCcw data-icon="inline-start" />
                      Refresh
                    </Button>
                    <Link
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09]",
                      )}
                      to="/contracts"
                    >
                      <ArrowUpRight data-icon="inline-start" />
                      Consumer dashboard
                    </Link>
                    <Button onClick={() => void logout()} type="button" variant="ghost">
                      <LogOut data-icon="inline-start" />
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Contract deck
                  </span>
                  <Boxes className="text-slate-500" />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {contracts.length}
                </p>
                <p className="mt-2 text-sm text-slate-300">Seeded contracts currently available.</p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Pilot coverage
                  </span>
                  <RadioTower className="text-slate-500" />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {pilotCount}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Distinct pilot types ready for simulation.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Completion avg
                  </span>
                  <Activity className="text-slate-500" />
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {averageCompletion}%
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Snapshot across all seeded contract milestones.
                </p>
              </div>
            </CardContent>
          </Card>
        </header>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="min-h-[60vh]">
            <Card className="h-full border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              <CardHeader className="border-b border-white/8 pb-4">
                <Badge className="border-white/15 bg-white/8 text-white/70">Seeded contracts</Badge>
                <CardTitle className="text-2xl text-white">Pilot navigator</CardTitle>
                <CardDescription className="text-slate-300">
                  Jump between seeded contracts and keep each operator deck one click away.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {contractsState.status === "loading" ? (
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    Pulling the seeded contract index from the backend.
                  </div>
                ) : null}

                {contractsState.status === "error" ? (
                  <div className="rounded-[28px] border border-rose-300/15 bg-rose-950/25 p-4 text-sm text-rose-100">
                    {contractsState.message}
                  </div>
                ) : null}

                {contractsState.status === "success" ? (
                  <ScrollArea className="h-[calc(100vh-29rem)] min-h-[24rem] pr-3">
                    <nav aria-label="Simulator contracts" className="grid gap-3">
                      {contractsState.contracts.map((contract) => {
                        const pilotMeta = getPilotMeta(contract.pilotType);
                        const pilotTheme = getPilotTheme(contract.pilotType);
                        const progressText =
                          contract.milestonesTotal > 0
                            ? `${contract.milestonesCompleted}/${contract.milestonesTotal}`
                            : "No milestones";

                        return (
                          <NavLink
                            className={({ isActive }) =>
                              cn(
                                "group relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/45 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.08]",
                                pilotTheme.panelClassName,
                                isActive ? "border-white/20 bg-white/[0.12] shadow-[0_24px_50px_rgba(0,0,0,0.28)]" : null,
                              )
                            }
                            key={contract.id}
                            to={`/simulator/${contract.id}`}
                          >
                            <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", pilotTheme.highlightClassName)} />
                            <div className="relative flex items-start gap-3">
                              <span
                                className={cn(
                                  "grid size-12 shrink-0 place-items-center rounded-2xl border text-sm font-semibold tracking-[0.18em]",
                                  pilotTheme.iconClassName,
                                )}
                              >
                                {pilotMeta.icon}
                              </span>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {contract.productName ?? contract.id}
                                  </p>
                                  <Badge className={pilotTheme.badgeClassName}>{pilotMeta.label}</Badge>
                                </div>
                                <p className="truncate text-sm text-slate-300">{contract.id}</p>
                                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-slate-400">
                                  <span>{contract.statusBadge}</span>
                                  <span>{progressText}</span>
                                </div>
                              </div>
                            </div>
                          </NavLink>
                        );
                      })}
                    </nav>
                  </ScrollArea>
                ) : null}
              </CardContent>
            </Card>
          </aside>

          <main className="min-h-[60vh]">
            <Outlet context={context} />
          </main>
        </div>
      </div>
    </div>
  );
}

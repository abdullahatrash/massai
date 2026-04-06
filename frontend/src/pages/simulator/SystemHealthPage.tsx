import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Database,
  Play,
  RefreshCcw,
  Server,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  fetchSystemHealth,
  testEndpoint,
  type EndpointTestResult,
  type SystemHealth,
} from "../../api/adminSystem";

const REFRESH_INTERVAL_MS = 30_000;

const TESTABLE_ENDPOINTS = [
  { path: "/health", label: "Health Check" },
  { path: "/api/v1/", label: "API v1 Root" },
  { path: "/api/v2/", label: "API v2 Root" },
  { path: "/health/ready", label: "Readiness Probe" },
];

function DependencyDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        status === "ok"
          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
          : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]",
      )}
    />
  );
}

export function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_MS / 1000);
  const [endpointResults, setEndpointResults] = useState<Map<string, EndpointTestResult>>(new Map());
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const loadHealth = () => {
    setLoading(true);
    fetchSystemHealth()
      .then((data) => {
        setHealth(data);
        setLoading(false);
        setSecondsUntilRefresh(REFRESH_INTERVAL_MS / 1000);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadHealth();
    const interval = window.setInterval(loadHealth, REFRESH_INTERVAL_MS);
    refreshTimerRef.current = interval;
    return () => window.clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsUntilRefresh((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(countdown);
  }, []);

  const handleTestEndpoint = async (path: string) => {
    setTestingEndpoint(path);
    try {
      const result = await testEndpoint(path);
      setEndpointResults((prev) => new Map(prev).set(path, result));
    } catch {
      setEndpointResults((prev) =>
        new Map(prev).set(path, {
          endpoint: path,
          latencyMs: 0,
          ok: false,
          statusCode: 0,
          error: "Request failed",
        }),
      );
    } finally {
      setTestingEndpoint(null);
    }
  };

  const handleTestAll = async () => {
    for (const ep of TESTABLE_ENDPOINTS) {
      await handleTestEndpoint(ep.path);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="sim-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500" />
        <div className="relative flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-400/14 text-cyan-200 ring-1 ring-cyan-300/20">
              <Server className="size-5" />
            </div>
            <div>
              <h2 className="text-[1.2rem] font-semibold tracking-tight text-white">
                System Health
              </h2>
              <p className="mt-0.5 text-[0.75rem] text-slate-400">
                Backend dependencies, system counters, endpoint reachability
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.65rem] tabular-nums text-slate-500">
              Refresh in {secondsUntilRefresh}s
            </span>
            <Button onClick={loadHealth} size="sm" variant="outline">
              <RefreshCcw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {/* Dependencies */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Database</span>
            <Database className="size-4 text-slate-600" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {health ? <DependencyDot status={health.db} /> : null}
            <p className="sim-stat-card__value text-[1.1rem]">
              {loading ? "..." : health?.db ?? "unknown"}
            </p>
          </div>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Auth (Keycloak)</span>
            <ShieldAlert className="size-4 text-slate-600" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {health ? <DependencyDot status={health.auth} /> : null}
            <p className="sim-stat-card__value text-[1.1rem]">
              {loading ? "..." : health?.auth ?? "unknown"}
            </p>
          </div>
        </div>

        <div className="sim-stat-card">
          <div className="flex items-center justify-between">
            <span className="sim-stat-card__label">Overall</span>
            <Activity className="size-4 text-slate-600" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {health ? <DependencyDot status={health.status} /> : null}
            <p className="sim-stat-card__value text-[1.1rem]">
              {loading ? "..." : health?.status ?? "unknown"}
            </p>
          </div>
          {health?.environment && (
            <p className="sim-stat-card__sub">{health.environment}</p>
          )}
        </div>
      </div>

      {/* System counters */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sim-stat-card">
          <span className="sim-stat-card__label">Contracts</span>
          <p className="sim-stat-card__value text-[1.1rem]">
            {loading ? "..." : health?.contractCount ?? 0}
          </p>
          <p className="sim-stat-card__sub">Total in database</p>
        </div>

        <div className="sim-stat-card">
          <span className="sim-stat-card__label">Unprocessed Updates</span>
          <p className={cn(
            "sim-stat-card__value text-[1.1rem]",
            health && health.unprocessedUpdateCount > 0 && "text-amber-400",
          )}>
            {loading ? "..." : health?.unprocessedUpdateCount ?? 0}
          </p>
          <p className="sim-stat-card__sub">Status updates pending processing</p>
        </div>

        <div className="sim-stat-card">
          <span className="sim-stat-card__label">Active Alerts</span>
          <p className={cn(
            "sim-stat-card__value text-[1.1rem]",
            health && health.activeAlertCount > 0 && "text-rose-400",
          )}>
            {loading ? "..." : health?.activeAlertCount ?? 0}
          </p>
          <p className="sim-stat-card__sub">Unresolved across all contracts</p>
        </div>
      </div>

      {/* Endpoint tester */}
      <div className="sim-panel">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[0.82rem] font-semibold text-white">Endpoint Tester</h3>
          <Button onClick={() => void handleTestAll()} size="sm" variant="ghost">
            <Play className="size-3" />
            Test all
          </Button>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {TESTABLE_ENDPOINTS.map((ep) => {
            const result = endpointResults.get(ep.path);
            const isTesting = testingEndpoint === ep.path;
            return (
              <div className="flex items-center gap-3 px-4 py-3" key={ep.path}>
                {/* Status */}
                <div className="w-5">
                  {result ? (
                    result.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <XCircle className="size-4 text-rose-400" />
                    )
                  ) : (
                    <span className="size-4" />
                  )}
                </div>

                {/* Endpoint info */}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.78rem] font-medium text-white">{ep.label}</p>
                  <p className="text-[0.65rem] font-mono text-slate-500">{ep.path}</p>
                </div>

                {/* Result */}
                {result && (
                  <div className="flex items-center gap-2">
                    <Badge className={cn(
                      "text-[0.58rem]",
                      result.ok
                        ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-300"
                        : "border-rose-400/20 bg-rose-400/8 text-rose-300",
                    )}>
                      {result.statusCode || "ERR"}
                    </Badge>
                    <span className="text-[0.65rem] tabular-nums text-slate-500">
                      {result.latencyMs}ms
                    </span>
                  </div>
                )}

                {/* Test button */}
                <Button
                  disabled={isTesting}
                  onClick={() => void handleTestEndpoint(ep.path)}
                  size="sm"
                  variant="outline"
                >
                  {isTesting ? "..." : "Test"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

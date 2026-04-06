import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import {
  acknowledgeAlert,
  listAlertHistory,
  type ContractAlert,
} from "../../api/alerts";
import type { SimulatorContract } from "./simulatorShared";

type ContractAlertsPanelProps = {
  contract: SimulatorContract;
};

function getSeverityClass(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL": return "border-rose-400/20 bg-rose-400/8 text-rose-300";
    case "HIGH": return "border-orange-400/20 bg-orange-400/8 text-orange-300";
    case "MEDIUM": return "border-amber-400/20 bg-amber-400/8 text-amber-300";
    case "LOW": return "border-sky-400/20 bg-sky-400/8 text-sky-300";
    default: return "border-white/[0.06] bg-white/[0.04] text-slate-300";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function ContractAlertsPanel({ contract }: ContractAlertsPanelProps) {
  const [alerts, setAlerts] = useState<ContractAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAlertHistory(contract.id)
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contract.id]);

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      const updated = await acknowledgeAlert(contract.id, alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
    } catch {
      // ignore
    } finally {
      setAcknowledging(null);
    }
  };

  if (loading) {
    return (
      <div className="sim-panel p-6">
        <p className="text-[0.75rem] text-slate-500">Loading alerts...</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="sim-panel p-6 text-center">
        <ShieldAlert className="mx-auto size-8 text-slate-600" />
        <p className="mt-3 text-[0.78rem] text-slate-400">No alerts recorded</p>
        <p className="mt-1 text-[0.68rem] text-slate-600">
          Alerts are triggered when ingested data meets alert conditions.
        </p>
      </div>
    );
  }

  const active = alerts.filter((a) => !a.resolvedAt);
  const resolved = alerts.filter((a) => a.resolvedAt);

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="sim-panel">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-rose-400" />
              <h3 className="text-[0.82rem] font-semibold text-white">
                Active Alerts ({active.length})
              </h3>
            </div>
          </div>
          <ScrollArea className="max-h-[20rem]">
            <div className="divide-y divide-white/[0.04]">
              {active.map((alert) => (
                <div className="flex items-start gap-3 px-4 py-3" key={alert.id}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[0.58rem]", getSeverityClass(alert.severity))}>
                        {alert.severity}
                      </Badge>
                      <span className="text-[0.65rem] text-slate-500">
                        {formatDate(alert.triggeredAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-slate-300">{alert.description}</p>
                    {alert.acknowledgedAt && (
                      <p className="mt-1 text-[0.62rem] text-slate-500">
                        Acknowledged {formatDate(alert.acknowledgedAt)}
                      </p>
                    )}
                  </div>
                  {!alert.acknowledgedAt && (
                    <Button
                      disabled={acknowledging === alert.id}
                      onClick={() => void handleAcknowledge(alert.id)}
                      size="sm"
                      variant="outline"
                    >
                      {acknowledging === alert.id ? "..." : "Acknowledge"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="sim-panel">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <h3 className="text-[0.82rem] font-semibold text-white">
                Resolved ({resolved.length})
              </h3>
            </div>
          </div>
          <ScrollArea className="max-h-[16rem]">
            <div className="divide-y divide-white/[0.04]">
              {resolved.map((alert) => (
                <div className="px-4 py-2.5" key={alert.id}>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-[0.58rem] opacity-60", getSeverityClass(alert.severity))}>
                      {alert.severity}
                    </Badge>
                    <span className="text-[0.65rem] text-slate-600">
                      {formatDate(alert.triggeredAt)} → {formatDate(alert.resolvedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.72rem] text-slate-500">{alert.description}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

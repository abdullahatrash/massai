import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Milestone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import {
  listAdminMilestones,
  type AdminMilestoneSummary,
} from "../../api/adminMilestones";
import type { SimulatorContract } from "./simulatorShared";

type ContractMilestonesPanelProps = {
  contract: SimulatorContract;
};

function getStatusIcon(status: string | null, isOverdue: boolean) {
  if (status === "COMPLETED") return <CheckCircle2 className="size-4 text-emerald-400" />;
  if (status === "REJECTED") return <AlertTriangle className="size-4 text-rose-400" />;
  if (isOverdue) return <AlertTriangle className="size-4 text-amber-400" />;
  return <Clock className="size-4 text-slate-500" />;
}

function getStatusBadgeClass(status: string | null, isOverdue: boolean) {
  if (status === "COMPLETED") return "border-emerald-400/20 bg-emerald-400/8 text-emerald-300";
  if (status === "REJECTED") return "border-rose-400/20 bg-rose-400/8 text-rose-300";
  if (isOverdue) return "border-amber-400/20 bg-amber-400/8 text-amber-300";
  return "border-white/[0.06] bg-white/[0.04] text-slate-400";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ContractMilestonesPanel({ contract }: ContractMilestonesPanelProps) {
  const [milestones, setMilestones] = useState<AdminMilestoneSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listAdminMilestones(contract.id)
      .then(setMilestones)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contract.id]);

  if (loading) {
    return (
      <div className="sim-panel p-6">
        <p className="text-[0.75rem] text-slate-500">Loading milestones...</p>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="sim-panel p-6 text-center">
        <Milestone className="mx-auto size-8 text-slate-600" />
        <p className="mt-3 text-[0.78rem] text-slate-400">No milestones configured</p>
      </div>
    );
  }

  const completed = milestones.filter((m) => m.status === "COMPLETED").length;
  const overdue = milestones.filter((m) => m.isOverdue && m.status !== "COMPLETED" && m.status !== "REJECTED").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sim-stat-card">
          <span className="sim-stat-card__label">Total</span>
          <p className="sim-stat-card__value text-[1.1rem]">{milestones.length}</p>
        </div>
        <div className="sim-stat-card">
          <span className="sim-stat-card__label">Completed</span>
          <p className="sim-stat-card__value text-[1.1rem] text-emerald-400">{completed}</p>
        </div>
        <div className="sim-stat-card">
          <span className="sim-stat-card__label">Overdue</span>
          <p className={cn("sim-stat-card__value text-[1.1rem]", overdue > 0 ? "text-amber-400" : "text-slate-400")}>
            {overdue}
          </p>
        </div>
      </div>

      {/* Milestone list */}
      <div className="sim-panel">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[0.82rem] font-semibold text-white">Milestone Timeline</h3>
        </div>
        <ScrollArea className="max-h-[28rem]">
          <div className="divide-y divide-white/[0.04]">
            {milestones.map((milestone) => (
              <div className="flex items-center gap-3 px-4 py-3" key={milestone.id}>
                {getStatusIcon(milestone.status, milestone.isOverdue)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.78rem] font-medium text-white">
                      {milestone.name}
                    </span>
                    <Badge className={cn("text-[0.55rem]", getStatusBadgeClass(milestone.status, milestone.isOverdue))}>
                      {milestone.isOverdue && milestone.status !== "COMPLETED" && milestone.status !== "REJECTED"
                        ? "OVERDUE"
                        : milestone.status}
                    </Badge>
                    {milestone.approvalRequired && (
                      <Badge className="border-purple-400/20 bg-purple-400/8 text-[0.55rem] text-purple-300">
                        Approval required
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[0.65rem] text-slate-500">
                    <span>Planned: {formatDate(milestone.plannedDate)}</span>
                    {milestone.actualDate && (
                      <span>Actual: {formatDate(milestone.actualDate)}</span>
                    )}
                    <span className="text-slate-700">|</span>
                    <span className="font-mono text-slate-600">{milestone.milestoneRef}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

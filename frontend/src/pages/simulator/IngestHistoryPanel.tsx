import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import {
  fetchStatusUpdates,
  type StatusUpdateItem,
  type StatusUpdatePagination,
} from "../../api/adminStatusUpdates";
import type { SimulatorContract } from "./simulatorShared";

type IngestHistoryPanelProps = {
  contract: SimulatorContract;
};

const UPDATE_TYPES = ["PRODUCTION_UPDATE", "QUALITY_EVENT", "PHASE_CHANGE", "MILESTONE_COMPLETE"];

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
  });
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function IngestHistoryPanel({ contract }: IngestHistoryPanelProps) {
  const [items, setItems] = useState<StatusUpdateItem[]>([]);
  const [pagination, setPagination] = useState<StatusUpdatePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("");
  const [filterProcessed, setFilterProcessed] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchStatusUpdates(
      contract.id,
      {
        page,
        pageSize: 20,
        updateType: filterType || undefined,
        processed: filterProcessed === "" ? undefined : filterProcessed === "true",
      },
      controller.signal,
    )
      .then((response) => {
        setItems(response.data);
        setPagination(response.pagination);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [contract.id, page, filterType, filterProcessed]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="sim-panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Filter className="size-3.5 text-slate-500" />
          <select
            className="h-7 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[0.72rem] text-white"
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            value={filterType}
          >
            <option value="">All types</option>
            {UPDATE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="h-7 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[0.72rem] text-white"
            onChange={(e) => { setFilterProcessed(e.target.value); setPage(1); }}
            value={filterProcessed}
          >
            <option value="">All status</option>
            <option value="true">Processed</option>
            <option value="false">Unprocessed</option>
          </select>
          {pagination && (
            <span className="ml-auto text-[0.68rem] tabular-nums text-slate-500">
              {pagination.total} total updates
            </span>
          )}
        </div>

        {/* Table */}
        <ScrollArea className="max-h-[36rem]">
          {loading ? (
            <div className="p-6 text-center text-[0.75rem] text-slate-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[0.78rem] text-slate-400">No ingest events found</p>
              <p className="mt-1 text-[0.68rem] text-slate-600">
                Run a scenario or send a manual update to see data here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.02]",
                        isExpanded && "bg-white/[0.02]",
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      type="button"
                    >
                      {/* Processed indicator */}
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          item.processed
                            ? "bg-emerald-400"
                            : "bg-amber-400",
                        )}
                        title={item.processed ? "Processed" : "Unprocessed"}
                      />

                      {/* Timestamp */}
                      <span className="w-36 shrink-0 text-[0.7rem] tabular-nums text-slate-400">
                        {formatTimestamp(item.timestamp)}
                      </span>

                      {/* Update type */}
                      <Badge className="shrink-0 border-white/[0.06] bg-white/[0.04] text-[0.58rem] text-slate-300">
                        {item.updateType ?? "UNKNOWN"}
                      </Badge>

                      {/* Source */}
                      <span className="min-w-0 flex-1 truncate text-[0.68rem] text-slate-500">
                        {item.sourceId ?? item.sensorId ?? "—"}
                      </span>

                      {/* Evidence count */}
                      {item.evidenceCount > 0 && (
                        <Badge className="border-sky-400/20 bg-sky-400/8 text-[0.55rem] text-sky-300">
                          {item.evidenceCount} evidence
                        </Badge>
                      )}

                      {/* Expand icon */}
                      {isExpanded ? (
                        <ChevronUp className="size-3.5 shrink-0 text-slate-500" />
                      ) : (
                        <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
                      )}
                    </button>

                    {/* Expanded payload */}
                    {isExpanded && item.payload && (
                      <div className="border-t border-white/[0.04] bg-black/20 px-4 py-3">
                        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500">
                          Payload
                        </p>
                        <pre className="overflow-x-auto rounded-md border border-white/[0.06] bg-black/30 p-3 text-[0.62rem] leading-relaxed text-slate-400">
                          {prettyJson(item.payload)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {pagination && pagination.total > pagination.pageSize && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
            <span className="text-[0.68rem] tabular-nums text-slate-500">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <div className="flex gap-1">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                size="sm"
                variant="ghost"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                disabled={!pagination.hasMore}
                onClick={() => setPage((p) => p + 1)}
                size="sm"
                variant="ghost"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { format, isValid, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  FileText,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  toViewerDocumentFromEvidence,
  type ViewerDocument,
} from "@/api/documents";
import { formatQualityPercent } from "@/lib/quality";
import { cn } from "@/lib/utils";

import type { MilestoneDetail, MilestoneEvidence, MilestoneSummary } from "../api/milestones";
import { ApprovalAction } from "./ApprovalAction";

type MilestoneCardProps = {
  detail: MilestoneDetail | undefined;
  errorMessage?: string | null;
  isApproving: boolean;
  isDetailLoading: boolean;
  isExpanded: boolean;
  isRejecting: boolean;
  milestone: MilestoneSummary;
  onApprove: () => void;
  onDocumentSelect?: (document: ViewerDocument) => void;
  onReject: (reason: string) => void;
  onToggle: () => void;
};

type EvidenceSummary = {
  approvalNotes: string[];
  documents: ViewerDocument[];
  rejectionReason: string | null;
};

/* ── Utilities ── */

function formatDateLabel(value: string | null): string {
  if (!value) return "Not recorded";
  const d = parseISO(value);
  if (!isValid(d)) return value;
  return format(d, "d MMM yyyy");
}

function parseEvidence(evidence: MilestoneEvidence[] | undefined): EvidenceSummary {
  const summary: EvidenceSummary = { approvalNotes: [], documents: [], rejectionReason: null };
  for (let i = 0; i < (evidence ?? []).length; i++) {
    const item = evidence?.[i];
    const parsedDocument = toViewerDocumentFromEvidence(item, `Evidence ${i + 1}`);
    if (parsedDocument) {
      summary.documents.push(parsedDocument);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const t = typeof candidate.type === "string" ? candidate.type : null;
    if (t === "REJECTION_REASON" && typeof candidate.reason === "string") { summary.rejectionReason = candidate.reason; continue; }
    if (t === "APPROVAL_NOTE" && typeof candidate.notes === "string") { summary.approvalNotes.push(candidate.notes); continue; }
  }
  return summary;
}

type StatusTone = "approval" | "completed" | "overdue" | "pending" | "progress" | "rejected";

type StatusConfig = {
  /** Classes applied to the Badge only (bg + text + border via outline variant) */
  badgeClass: string;
  Icon: React.ElementType;
  /** Icon color inside the marker dot */
  iconClass: string;
  label: string;
};

// variant="outline" gives transparent bg + border-border + text-foreground.
// Our className adds bg-* and border-* which override cleanly since
// "emerald/amber/rose/stone" sort after "border" alphabetically in Tailwind.
const STATUS_CONFIG: Record<StatusTone, StatusConfig> = {
  approval: { badgeClass: "bg-amber-50 border-amber-200",  Icon: ShieldAlert,   iconClass: "text-amber-500",  label: "Awaiting approval" },
  completed: { badgeClass: "bg-emerald-50 border-emerald-200", Icon: CheckCircle2, iconClass: "text-emerald-500", label: "Completed" },
  overdue:   { badgeClass: "bg-rose-50 border-rose-200",    Icon: AlertTriangle, iconClass: "text-rose-500",    label: "Overdue" },
  pending:   { badgeClass: "bg-stone-100 border-stone-200", Icon: Clock,         iconClass: "text-stone-400",   label: "Pending" },
  progress:  { badgeClass: "bg-blue-50 border-blue-200",    Icon: CircleDot,     iconClass: "text-blue-500",    label: "In progress" },
  rejected:  { badgeClass: "bg-rose-50 border-rose-200",    Icon: XCircle,       iconClass: "text-rose-500",    label: "Rejected" },
};

function getStatusTone(milestone: MilestoneSummary): StatusTone {
  const s = (milestone.status ?? "").toUpperCase();
  if (s === "COMPLETED") return "completed";
  if (s === "REJECTED") return "rejected";
  if (s === "SUBMITTED" && milestone.approvalRequired) return "approval";
  if (s === "SUBMITTED") return "progress";
  if (milestone.isOverdue) return "overdue";
  return "pending";
}

/* ── Component ── */

export function MilestoneCard({
  detail,
  errorMessage,
  isApproving,
  isDetailLoading,
  isExpanded,
  isRejecting,
  milestone,
  onApprove,
  onDocumentSelect,
  onReject,
  onToggle,
}: MilestoneCardProps) {
  const tone = getStatusTone(milestone);
  const config = STATUS_CONFIG[tone];
  const { Icon } = config;
  const evidenceSummary = parseEvidence(detail?.evidence);
  const qualityGate = detail?.qualityGate ?? milestone.qualityGate ?? null;

  return (
    <article
      aria-label={`Milestone: ${milestone.name}`}
      className={cn(
        "milestone-card",
        `milestone-card-${tone}`,
        milestone.isOverdue && "overdue",
      )}
      role="listitem"
    >
      {/* ── Timeline dot — keeps original white background so the line blends through it ── */}
      <div aria-hidden="true" className="milestone-card-marker">
        <Icon aria-hidden className={cn("size-4", config.iconClass)} />
      </div>

      {/* ── Card body ── */}
      <div className="milestone-card-body">

        {/* Header */}
        <div className="milestone-card-header">
          <div className="flex flex-col gap-2 min-w-0">
            {/* Status badge — variant="outline" gives transparent bg so our bg-* class wins */}
            <Badge
              className={cn("self-start text-[0.72rem] font-semibold uppercase tracking-wide", config.badgeClass)}
              variant="outline"
            >
              <Icon aria-hidden className={cn("size-3", config.iconClass)} />
              {config.label}
            </Badge>

            <h3 className="text-base font-semibold text-stone-900 m-0 leading-snug">
              {milestone.name}
            </h3>

            {/* Ref shown only if meaningfully different from the name */}
            {milestone.milestoneRef && milestone.milestoneRef.toUpperCase().replace(/[_\s]/g, "") !== milestone.name.toUpperCase().replace(/[_\s]/g, "") && (
              <p className="text-[0.72rem] font-mono text-stone-400 m-0 leading-none tracking-wide">
                {milestone.milestoneRef}
              </p>
            )}
          </div>

          {/* Right-side actions */}
          <div className="flex flex-wrap items-start justify-end gap-2 shrink-0">
            {evidenceSummary.documents.length > 0 && (
              <Badge className="border-teal-200 bg-teal-50 text-[0.72rem] font-semibold" variant="outline">
                <FileText aria-hidden className="size-3 text-teal-500" />
                {evidenceSummary.documents.length} doc{evidenceSummary.documents.length === 1 ? "" : "s"}
              </Badge>
            )}

            <Button
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Hide details for ${milestone.name}` : `Show details for ${milestone.name}`}
              className="h-auto gap-1 py-1 px-2 text-xs text-stone-500 hover:text-stone-800"
              onClick={onToggle}
              size="xs"
              type="button"
              variant="ghost"
            >
              {isExpanded
                ? <><ChevronUp aria-hidden className="size-3" />Hide details</>
                : <><ChevronDown aria-hidden className="size-3" />Show details</>
              }
            </Button>
          </div>
        </div>

        {/* Date grid */}
        <dl className="milestone-meta-grid">
          <div>
            <dt>
              <span className="flex items-center gap-1">
                <CalendarDays aria-hidden className="size-3 text-stone-400" />
                Planned date
              </span>
            </dt>
            <dd>
              <time dateTime={milestone.plannedDate ?? undefined}>{formatDateLabel(milestone.plannedDate)}</time>
            </dd>
          </div>
          <div>
            <dt>
              <span className="flex items-center gap-1">
                <CheckCircle2 aria-hidden className="size-3 text-stone-400" />
                Completed date
              </span>
            </dt>
            <dd>
              <time dateTime={milestone.actualDate ?? undefined}>{formatDateLabel(milestone.actualDate)}</time>
            </dd>
          </div>
        </dl>

        {/* Approval action */}
        {milestone.status === "SUBMITTED" && milestone.approvalRequired && (
          <ApprovalAction
            isApproving={isApproving}
            isRejecting={isRejecting}
            onApprove={onApprove}
            onReject={onReject}
          />
        )}

        {/* Expanded detail panel */}
        {isExpanded && (
          <div className="milestone-detail-panel">
            {isDetailLoading && (
              <p className="text-sm text-stone-500 m-0" role="status">Loading evidence and notes…</p>
            )}
            {errorMessage && (
              <p className="text-sm font-medium text-rose-700 m-0" role="alert">{errorMessage}</p>
            )}

            {!isDetailLoading && (
              <>
                {evidenceSummary.rejectionReason && (
                  <div className="milestone-detail-block">
                    <h4>Rejection reason</h4>
                    <p className="text-sm text-stone-700 m-0">{evidenceSummary.rejectionReason}</p>
                  </div>
                )}

                {evidenceSummary.approvalNotes.length > 0 && (
                  <div className="milestone-detail-block">
                    <h4>Approval notes</h4>
                    <ul className="milestone-note-list">
                      {evidenceSummary.approvalNotes.map((note, i) => (
                        <li className="text-sm text-stone-700" key={`${milestone.id}-note-${i}`}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {qualityGate !== null && (
                  <div className="milestone-detail-block">
                    <h4>Stage verification gate</h4>
                    <p className="text-sm text-stone-700 m-0">
                      This stage requires a quality pass rate of at least {formatQualityPercent(qualityGate)}.
                    </p>
                    <p className="mt-1 text-sm text-stone-500 m-0">
                      This stage gate is separate from the contract-wide alert threshold.
                    </p>
                  </div>
                )}

                <div className="milestone-detail-block">
                  <h4>Evidence documents</h4>
                  {evidenceSummary.documents.length > 0 ? (
                    <ul className="milestone-document-list">
                      {evidenceSummary.documents.map((doc) => (
                        <li className="flex items-center gap-1.5" key={`${milestone.id}-${doc.url}`}>
                          <FileText aria-hidden className="size-3.5 shrink-0 text-stone-400" />
                          {onDocumentSelect ? (
                            <button
                              className="rounded text-sm text-teal-700 underline underline-offset-2 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-teal-600"
                              onClick={() => onDocumentSelect(doc)}
                              type="button"
                            >
                              {doc.name}
                            </button>
                          ) : (
                            <a
                              className="rounded text-sm text-teal-700 underline underline-offset-2 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-teal-600"
                              href={doc.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {doc.name}
                            </a>
                          )}
                          <a
                            aria-label={`Open ${doc.name} in a new tab`}
                            className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-teal-600"
                            href={doc.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ArrowUpRight aria-hidden className="size-3.5" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-stone-400 italic m-0">No evidence documents attached yet.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

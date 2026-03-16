import { format, isValid, parseISO } from "date-fns";

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
  onReject: (reason: string) => void;
  onToggle: () => void;
};

type EvidenceDocument = {
  label: string;
  url: string;
};

type EvidenceSummary = {
  approvalNotes: string[];
  documents: EvidenceDocument[];
  rejectionReason: string | null;
};

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const parsedDate = parseISO(value);
  if (!isValid(parsedDate)) {
    return value;
  }

  return format(parsedDate, "d MMM yyyy");
}

function parseEvidence(evidence: MilestoneEvidence[] | undefined): EvidenceSummary {
  const summary: EvidenceSummary = {
    approvalNotes: [],
    documents: [],
    rejectionReason: null,
  };

  for (let index = 0; index < (evidence ?? []).length; index += 1) {
    const item = evidence?.[index];
    if (typeof item === "string") {
      summary.documents.push({
        label: `Evidence ${index + 1}`,
        url: item,
      });
      continue;
    }
    if (!item || typeof item !== "object") {
      continue;
    }

    const itemType = typeof item.type === "string" ? item.type : null;
    if (itemType === "REJECTION_REASON" && typeof item.reason === "string") {
      summary.rejectionReason = item.reason;
      continue;
    }
    if (itemType === "APPROVAL_NOTE" && typeof item.notes === "string") {
      summary.approvalNotes.push(item.notes);
      continue;
    }

    if (typeof item.url === "string") {
      summary.documents.push({
        label:
          typeof item.name === "string"
            ? item.name
            : typeof item.title === "string"
              ? item.title
              : typeof item.type === "string"
                ? item.type
                : `Evidence ${index + 1}`,
        url: item.url,
      });
    }
  }

  return summary;
}

function getMilestoneStatusPresentation(milestone: MilestoneSummary): {
  icon: string;
  label: string;
  tone: "approval" | "completed" | "overdue" | "pending" | "progress" | "rejected";
} {
  const normalizedStatus = (milestone.status ?? "").toUpperCase();
  if (normalizedStatus === "COMPLETED") {
    return {
      icon: "✅",
      label: "Completed",
      tone: "completed",
    };
  }
  if (normalizedStatus === "REJECTED") {
    return {
      icon: "❌",
      label: "Rejected",
      tone: "rejected",
    };
  }
  if (normalizedStatus === "SUBMITTED" && milestone.approvalRequired) {
    return {
      icon: "🔶",
      label: "Awaiting approval",
      tone: "approval",
    };
  }
  if (normalizedStatus === "SUBMITTED") {
    return {
      icon: "🔵",
      label: "In progress",
      tone: "progress",
    };
  }
  if (milestone.isOverdue) {
    return {
      icon: "❌",
      label: "Overdue",
      tone: "overdue",
    };
  }
  return {
    icon: "⏳",
    label: "Pending",
    tone: "pending",
  };
}

export function MilestoneCard({
  detail,
  errorMessage,
  isApproving,
  isDetailLoading,
  isExpanded,
  isRejecting,
  milestone,
  onApprove,
  onReject,
  onToggle,
}: MilestoneCardProps) {
  const statusPresentation = getMilestoneStatusPresentation(milestone);
  const evidenceSummary = parseEvidence(detail?.evidence);

  return (
    <article
      className={`milestone-card milestone-card-${statusPresentation.tone}${milestone.isOverdue ? " overdue" : ""}`}
    >
      <div className="milestone-card-marker">
        <span>{statusPresentation.icon}</span>
      </div>

      <div className="milestone-card-body">
        <div className="milestone-card-header">
          <div>
            <span className={`milestone-status-pill ${statusPresentation.tone}`}>
              {statusPresentation.label}
            </span>
            <h3>{milestone.name}</h3>
            <p className="milestone-ref">{milestone.milestoneRef}</p>
          </div>

          <div className="milestone-card-badges">
            {evidenceSummary.documents.length > 0 ? (
              <span className="milestone-doc-badge">
                {evidenceSummary.documents.length} document
                {evidenceSummary.documents.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <button className="ghost-button" onClick={onToggle} type="button">
              {isExpanded ? "Hide details" : "Show details"}
            </button>
          </div>
        </div>

        <dl className="milestone-meta-grid">
          <div>
            <dt>Planned date</dt>
            <dd>{formatDateLabel(milestone.plannedDate)}</dd>
          </div>
          <div>
            <dt>Completed date</dt>
            <dd>{formatDateLabel(milestone.actualDate)}</dd>
          </div>
        </dl>

        {milestone.status === "SUBMITTED" && milestone.approvalRequired ? (
          <ApprovalAction
            isApproving={isApproving}
            isRejecting={isRejecting}
            onApprove={onApprove}
            onReject={onReject}
          />
        ) : null}

        {isExpanded ? (
          <div className="milestone-detail-panel">
            {isDetailLoading ? <p>Loading evidence and notes.</p> : null}
            {errorMessage ? <p className="approval-validation">{errorMessage}</p> : null}

            {!isDetailLoading ? (
              <>
                {evidenceSummary.rejectionReason ? (
                  <div className="milestone-detail-block">
                    <h4>Rejection reason</h4>
                    <p>{evidenceSummary.rejectionReason}</p>
                  </div>
                ) : null}

                {evidenceSummary.approvalNotes.length > 0 ? (
                  <div className="milestone-detail-block">
                    <h4>Approval notes</h4>
                    <ul className="milestone-note-list">
                      {evidenceSummary.approvalNotes.map((note, index) => (
                        <li key={`${milestone.id}-note-${index}`}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="milestone-detail-block">
                  <h4>Evidence documents</h4>
                  {evidenceSummary.documents.length > 0 ? (
                    <ul className="milestone-document-list">
                      {evidenceSummary.documents.map((document) => (
                        <li key={`${milestone.id}-${document.url}`}>
                          <a href={document.url} rel="noreferrer" target="_blank">
                            {document.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No evidence documents are attached to this milestone yet.</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

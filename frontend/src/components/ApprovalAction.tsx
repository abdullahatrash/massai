import { useState } from "react";

type ApprovalActionProps = {
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
};

export function ApprovalAction({
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: ApprovalActionProps) {
  const [reason, setReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const approveDisabled = isApproving || isRejecting;
  const rejectDisabled = isApproving || isRejecting;

  return (
    <div className="approval-action-card">
      <div className="approval-action-row">
        <button
          className="primary-button"
          disabled={approveDisabled}
          onClick={() => onApprove()}
          type="button"
        >
          {isApproving ? "Approving..." : "Approve"}
        </button>
        {!showRejectForm ? (
          <button
            className="ghost-button"
            disabled={rejectDisabled}
            onClick={() => {
              setShowRejectForm(true);
              setValidationMessage(null);
            }}
            type="button"
          >
            Reject
          </button>
        ) : (
          <button
            className="ghost-button"
            disabled={rejectDisabled}
            onClick={() => {
              setShowRejectForm(false);
              setReason("");
              setValidationMessage(null);
            }}
            type="button"
          >
            Cancel
          </button>
        )}
      </div>

      {showRejectForm ? (
        <div className="approval-reject-form">
          <label className="approval-label" htmlFor="reject-reason">
            Rejection reason
          </label>
          <textarea
            className="approval-textarea"
            id="reject-reason"
            onChange={(event) => {
              setReason(event.target.value);
              if (validationMessage) {
                setValidationMessage(null);
              }
            }}
            placeholder="Explain what evidence or deliverable is missing."
            rows={3}
            value={reason}
          />
          {validationMessage ? <p className="approval-validation">{validationMessage}</p> : null}
          <button
            className="primary-button danger-button"
            disabled={rejectDisabled}
            onClick={() => {
              const trimmedReason = reason.trim();
              if (!trimmedReason) {
                setValidationMessage("A rejection reason is required.");
                return;
              }
              onReject(trimmedReason);
            }}
            type="button"
          >
            {isRejecting ? "Rejecting..." : "Confirm rejection"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

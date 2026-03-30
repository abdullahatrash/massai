import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  const isBusy = isApproving || isRejecting;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button
          disabled={isBusy}
          onClick={() => onApprove()}
          size="sm"
          type="button"
          variant="default"
        >
          {isApproving ? "Approving…" : "Approve"}
        </Button>

        {!showRejectForm ? (
          <Button
            disabled={isBusy}
            onClick={() => {
              setShowRejectForm(true);
              setValidationMessage(null);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Reject
          </Button>
        ) : (
          <Button
            disabled={isBusy}
            onClick={() => {
              setShowRejectForm(false);
              setReason("");
              setValidationMessage(null);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        )}
      </div>

      {showRejectForm && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-stone-600" htmlFor="reject-reason">
              Rejection reason
            </Label>
            <Textarea
              aria-describedby={validationMessage ? "reject-reason-error" : undefined}
              aria-invalid={validationMessage ? true : undefined}
              className="min-h-20 resize-y bg-white/80 text-sm"
              id="reject-reason"
              onChange={(event) => {
                setReason(event.target.value);
                if (validationMessage) setValidationMessage(null);
              }}
              placeholder="Explain what evidence or deliverable is missing."
              value={reason}
            />
            {validationMessage && (
              <p className="text-xs font-medium text-rose-700" id="reject-reason-error" role="alert">
                {validationMessage}
              </p>
            )}
          </div>
          <Button
            className="self-start"
            disabled={isBusy}
            onClick={() => {
              const trimmed = reason.trim();
              if (!trimmed) {
                setValidationMessage("A rejection reason is required.");
                return;
              }
              onReject(trimmed);
            }}
            size="sm"
            type="button"
            variant="destructive"
          >
            {isRejecting ? "Rejecting…" : "Confirm rejection"}
          </Button>
        </div>
      )}
    </div>
  );
}

import { FilePlus2, Trash2 } from "lucide-react";

import type { ProviderDocumentReference } from "@/api/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DocumentReferenceDraft = {
  format: string;
  id: string;
  name: string;
  url: string;
};

export type DocumentReferenceDraftErrors = Record<
  string,
  {
    format?: string;
    name?: string;
    url?: string;
  }
>;

export function createDocumentReferenceDraft(): DocumentReferenceDraft {
  return {
    format: "",
    id: `document-${crypto.randomUUID()}`,
    name: "",
    url: "",
  };
}

export function serializeDocumentReferenceDrafts(
  drafts: DocumentReferenceDraft[],
): {
  documents: ProviderDocumentReference[];
  errorsById: DocumentReferenceDraftErrors;
  hasErrors: boolean;
} {
  const uploadedAt = new Date().toISOString();
  const documents: ProviderDocumentReference[] = [];
  const errorsById: DocumentReferenceDraftErrors = {};

  for (const draft of drafts) {
    const name = draft.name.trim();
    const url = draft.url.trim();
    const format = draft.format.trim();
    const hasAnyValue = Boolean(name || url || format);

    if (!hasAnyValue) {
      continue;
    }

    const nextErrors: DocumentReferenceDraftErrors[string] = {};
    if (!name) {
      nextErrors.name = "Document name is required.";
    }

    if (!url) {
      nextErrors.url = "Document URL is required.";
    } else {
      try {
        new URL(url);
      } catch {
        nextErrors.url = "Enter a valid absolute URL.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      errorsById[draft.id] = nextErrors;
      continue;
    }

    documents.push({
      ...(format ? { format } : {}),
      name,
      uploadedAt,
      url,
    });
  }

  return {
    documents,
    errorsById,
    hasErrors: Object.keys(errorsById).length > 0,
  };
}

type DocumentReferenceEditorProps = {
  description?: string;
  errorsById?: DocumentReferenceDraftErrors;
  onAddRow: () => void;
  onChangeRow: (
    id: string,
    patch: Partial<Omit<DocumentReferenceDraft, "id">>,
  ) => void;
  onRemoveRow: (id: string) => void;
  rows: DocumentReferenceDraft[];
  title?: string;
};

export function DocumentReferenceEditor({
  description = "Attach hosted document URLs for this submission. Empty rows are ignored.",
  errorsById = {},
  onAddRow,
  onChangeRow,
  onRemoveRow,
  rows,
  title = "Document references",
}: DocumentReferenceEditorProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-1 text-[0.7rem] text-slate-500">{description}</p>
        </div>
        <Button onClick={onAddRow} size="xs" type="button" variant="outline">
          <FilePlus2 data-icon="inline-start" />
          Add document
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-[0.72rem] text-slate-500">
          No document references added.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {rows.map((row, index) => {
            const rowErrors = errorsById[row.id] ?? {};

            return (
              <div
                className="rounded-xl border border-white/[0.06] bg-black/10 p-3"
                key={row.id}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Document {index + 1}
                  </p>
                  <Button
                    onClick={() => onRemoveRow(row.id)}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Remove document {index + 1}</span>
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,0.7fr)]">
                  <div className="grid gap-1.5">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Name
                    </label>
                    <Input
                      className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-slate-600"
                      onChange={(event) => onChangeRow(row.id, { name: event.target.value })}
                      placeholder="inspection-report.pdf"
                      value={row.name}
                    />
                    {rowErrors.name ? (
                      <p className="m-0 text-[0.68rem] text-rose-300">{rowErrors.name}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Hosted URL
                    </label>
                    <Input
                      className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-slate-600"
                      onChange={(event) => onChangeRow(row.id, { url: event.target.value })}
                      placeholder="https://example.com/docs/inspection-report.pdf"
                      value={row.url}
                    />
                    {rowErrors.url ? (
                      <p className="m-0 text-[0.68rem] text-rose-300">{rowErrors.url}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Format
                    </label>
                    <Input
                      className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-slate-600"
                      onChange={(event) => onChangeRow(row.id, { format: event.target.value })}
                      placeholder="PDF"
                      value={row.format}
                    />
                    {rowErrors.format ? (
                      <p className="m-0 text-[0.68rem] text-rose-300">{rowErrors.format}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

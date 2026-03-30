import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

import {
  getDocumentPreviewKind,
  type ViewerDocument,
} from "@/api/documents";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function formatUploadedAt(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedValue);
}

type DocumentViewerSheetProps = {
  document: ViewerDocument | null;
  onOpenChange: (open: boolean) => void;
};

export function DocumentViewerSheet({
  document,
  onOpenChange,
}: DocumentViewerSheetProps) {
  const previewKind = useMemo(
    () =>
      document
        ? getDocumentPreviewKind({
            format: document.format,
            name: document.name,
            url: document.url,
          })
        : "other",
    [document],
  );
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [document?.url]);

  return (
    <Sheet open={document !== null} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 overflow-hidden border-stone-200 bg-stone-50/98 sm:max-w-4xl"
        side="right"
      >
        {document ? (
          <>
            <SheetHeader className="border-b border-stone-200 bg-white/75 pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-stone-200 bg-stone-100 text-stone-600">
                  Document viewer
                </Badge>
                {document.format ? (
                  <Badge className="border-teal-200 bg-teal-50 text-teal-700">
                    {document.format}
                  </Badge>
                ) : null}
                {document.milestoneName ? (
                  <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                    {document.milestoneName}
                  </Badge>
                ) : null}
              </div>
              <SheetTitle className="mt-3 text-xl font-semibold text-stone-900">
                {document.name}
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-stone-500">
                Preview the attached evidence in place. If the host blocks embedding, use the
                direct open actions below.
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(244,244,245,0.75))]">
              <div className="flex flex-wrap items-center gap-4 border-b border-stone-200 px-4 py-3 text-xs text-stone-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  Uploaded: {formatUploadedAt(document.uploadedAt)}
                </span>
                <span className="truncate font-mono text-[0.68rem] text-stone-400">
                  {document.url}
                </span>
              </div>

              <div className="min-h-0 flex-1 p-4">
                <div className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[1.35rem] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(23,36,38,0.08)]">
                  {previewKind === "pdf" ? (
                    <>
                      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                        <FileText className="size-3.5" />
                        PDF preview
                      </div>
                      <iframe
                        className="min-h-0 flex-1 bg-white"
                        src={document.url}
                        title={document.name}
                      />
                    </>
                  ) : null}

                  {previewKind === "image" ? (
                    <>
                      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                        <ImageIcon className="size-3.5" />
                        Image preview
                      </div>
                      {imageFailed ? (
                        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
                          <div className="max-w-md space-y-2">
                            <p className="text-sm font-medium text-stone-800">
                              The host did not allow the image preview to load.
                            </p>
                            <p className="text-sm text-stone-500">
                              Use the direct open actions below to view the source file.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_38%),linear-gradient(180deg,rgba(250,250,249,0.9),rgba(244,244,245,0.8))] p-6">
                          <img
                            alt={document.name}
                            className="max-h-full max-w-full rounded-2xl border border-stone-200 object-contain shadow-[0_16px_32px_rgba(23,36,38,0.12)]"
                            onError={() => setImageFailed(true)}
                            src={document.url}
                          />
                        </div>
                      )}
                    </>
                  ) : null}

                  {previewKind === "other" ? (
                    <div className="grid min-h-0 flex-1 place-items-center bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.08),transparent_32%),linear-gradient(180deg,rgba(250,250,249,0.92),rgba(244,244,245,0.82))] px-6 text-center">
                      <div className="max-w-md space-y-3">
                        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-500 shadow-sm">
                          <FileText className="size-6" />
                        </div>
                        <p className="text-sm font-medium text-stone-800">
                          In-app preview is not available for this document type.
                        </p>
                        <p className="text-sm text-stone-500">
                          Open the original file in a new tab or try downloading it directly.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <SheetFooter className="border-t border-stone-200 bg-white/80 sm:flex-row sm:justify-end">
              <a
                className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                href={document.url}
                rel="noreferrer"
                target="_blank"
              >
                <ArrowUpRight data-icon="inline-start" />
                Open original
              </a>
              <a
                className={cn(buttonVariants({ size: "sm" }))}
                download
                href={document.url}
                rel="noreferrer"
                target="_blank"
              >
                <Download data-icon="inline-start" />
                Download
              </a>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

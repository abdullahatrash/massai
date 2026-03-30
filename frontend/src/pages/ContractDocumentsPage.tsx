import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Filter,
  RefreshCcw,
} from "lucide-react";

import {
  listContractDocuments,
  type ContractDocument,
} from "@/api/documents";
import { listMilestones } from "@/api/milestones";
import { DocumentViewerSheet } from "@/components/DocumentViewerSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ContractOutletContext } from "./ContractRouteLayout";

const ALL_MILESTONES = "__all__";

function formatUploadedAt(value: string | null): string {
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

export function ContractDocumentsPage() {
  const { contract } = useOutletContext<ContractOutletContext>();
  const [selectedMilestoneRef, setSelectedMilestoneRef] = useState(ALL_MILESTONES);
  const [selectedDocument, setSelectedDocument] = useState<ContractDocument | null>(null);

  const milestonesQuery = useQuery({
    queryFn: () => listMilestones(contract.id),
    queryKey: ["document-filter-milestones", contract.id],
    staleTime: 30_000,
  });
  const documentsQuery = useQuery({
    queryFn: () =>
      listContractDocuments(
        contract.id,
        selectedMilestoneRef === ALL_MILESTONES ? undefined : selectedMilestoneRef,
      ),
    queryKey: ["contract-documents", contract.id, selectedMilestoneRef],
  });

  return (
    <section className="space-y-5">
      <Card className="dash-card overflow-visible">
        <CardHeader className="gap-4 pb-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Documents
            </p>
            <CardTitle className="mt-1 text-xl font-semibold text-stone-900">
              Evidence library
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-stone-500">
              Browse structured evidence references attached across this contract&apos;s milestone
              submissions.
            </CardDescription>
          </div>

          <div className="w-full max-w-xs">
            <Select
              onValueChange={(value) => setSelectedMilestoneRef(value ?? ALL_MILESTONES)}
              value={selectedMilestoneRef}
            >
              <SelectTrigger className="h-9 bg-white/80 text-sm text-stone-700">
                <Filter className="mr-2 size-4 text-stone-400" />
                <SelectValue placeholder="Filter by milestone" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL_MILESTONES}>All milestones</SelectItem>
                  {(milestonesQuery.data ?? []).map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.milestoneRef}>
                      {milestone.name} ({milestone.milestoneRef})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {documentsQuery.isPending ? (
            <div className="grid gap-3" role="status" aria-label="Loading documents">
              {[1, 2, 3].map((index) => (
                <div className="dash-card animate-pulse rounded-2xl" key={index}>
                  <div className="h-20 rounded-2xl bg-stone-100" />
                </div>
              ))}
            </div>
          ) : null}

          {documentsQuery.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
              <h3 className="m-0 text-base font-semibold text-rose-900">
                Unable to load contract documents
              </h3>
              <p className="mt-1 text-sm text-rose-700">{documentsQuery.error.message}</p>
              <Button
                className="mt-3"
                onClick={() => void documentsQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCcw data-icon="inline-start" />
                Retry
              </Button>
            </div>
          ) : null}

          {documentsQuery.isSuccess && documentsQuery.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/65 px-6 py-10 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-stone-100 text-stone-500">
                <FileText className="size-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-stone-700">
                No structured document references are attached yet.
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Provider evidence added as named URL references will appear here automatically.
              </p>
            </div>
          ) : null}

          {documentsQuery.isSuccess && documentsQuery.data.length > 0 ? (
            <div className="grid gap-3">
              {documentsQuery.data.map((document) => (
                <Card
                  className="dash-card border border-stone-200/80 bg-white/80 transition hover:-translate-y-0.5 hover:shadow-md"
                  key={document.id}
                  size="sm"
                >
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedDocument(document)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="m-0 truncate text-sm font-semibold text-stone-900">
                              {document.name}
                            </p>
                            {document.format ? (
                              <Badge className="border-teal-200 bg-teal-50 text-teal-700">
                                {document.format}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-stone-500">
                            {document.milestoneName}
                          </p>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
                            <CalendarDays className="size-3.5" />
                            {formatUploadedAt(document.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setSelectedDocument(document)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        View
                      </Button>
                      <a
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                        href={document.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ArrowUpRight className="size-4" />
                        <span className="sr-only">Open document in new tab</span>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DocumentViewerSheet
        document={selectedDocument}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocument(null);
          }
        }}
      />
    </section>
  );
}

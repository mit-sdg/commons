"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "@/components/link";
import { GradeInput } from "@/components/lms/grade-input";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadGradebook } from "@/lib/lms";
import { cn } from "@/lib/utils";

function GradebookPageContent() {
  const { session } = useAuth();
  const [dirtyGrade, setDirtyGrade] = useState(false);
  const [grading, setGrading] = useState<{
    learner: string;
    learnerName: string;
    item: string;
    itemLabel: string;
  } | null>(null);

  const { data, loading, error, refetch } = useQuery(
    session ? () => loadGradebook() : null,
    [session],
  );

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading gradebook…" />
      </PageContainer>
    );
  if (error)
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );

  const gradebook = data?.gradebook;
  const learners = gradebook?.learners ?? [];
  const items = gradebook?.items ?? [];
  const selectedCell = grading
    ? learners
        .find((learner) => String(learner.learner) === grading.learner)
        ?.cells.find((cell) => String(cell.item) === grading.item)
    : null;

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Course staff"
        title="Gradebook"
        description="Enter, review, and release grades for every learner and assignment."
      />

      {learners.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No learners"
          description="Active learners appear here after their roster seats are connected."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No grade items"
          description="Publish an assignment that accepts submissions to create its grade item."
        />
      ) : (
        <div className="max-w-full overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-48 bg-card">
                  Learner
                </TableHead>
                {items.map((item) => (
                  <TableHead
                    key={String(item.item)}
                    className="min-w-32 text-center"
                  >
                    <span className="block text-xs font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="text-[0.7rem] font-normal text-muted-foreground">
                      {item.maxPoints} points
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {learners.map((learner) => (
                <TableRow key={String(learner.learner)}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <Link
                      href={`/staff/students/${learner.learner}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {learner.displayName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {learner.email}
                    </span>
                  </TableCell>
                  {items.map((item) => {
                    const cell = learner.cells.find(
                      (candidate) =>
                        String(candidate.item) === String(item.item),
                    );
                    const status = cell?.status;
                    const assigned = cell?.assigned === true;
                    return (
                      <TableCell
                        key={String(item.item)}
                        className="p-1 text-center"
                      >
                        <button
                          type="button"
                          className={cn(
                            "min-h-10 w-full rounded-md px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:bg-transparent",
                            status === "RELEASED" &&
                              "font-medium text-emerald-700 dark:text-emerald-300",
                            status === "DRAFT" &&
                              "text-amber-700 dark:text-amber-300",
                            status === "EXCUSED" &&
                              "text-purple-700 dark:text-purple-300",
                            !status && "text-muted-foreground",
                          )}
                          aria-label={
                            assigned
                              ? `Grade ${learner.displayName ?? learner.email} for ${item.label}`
                              : `${learner.displayName ?? learner.email} was not assigned ${item.label}`
                          }
                          disabled={!assigned}
                          onClick={() =>
                            assigned &&
                            setGrading({
                              learner: String(learner.learner),
                              learnerName: learner.displayName ?? learner.email,
                              item: String(item.item),
                              itemLabel: item.label,
                            })
                          }
                        >
                          {!assigned
                            ? "N/A — not assigned"
                            : status === "EXCUSED"
                              ? "Excused"
                              : cell?.score !== null &&
                                  cell?.score !== undefined
                                ? `${cell.score} / ${item.maxPoints}`
                                : "Add grade"}
                          {assigned && status ? (
                            <span className="block text-[0.65rem] uppercase opacity-70">
                              {status.toLowerCase()}
                            </span>
                          ) : null}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!grading}
        onOpenChange={(open) => {
          if (open) return;
          if (
            dirtyGrade &&
            !window.confirm("Discard your unsaved grade changes?")
          )
            return;
          setDirtyGrade(false);
          setGrading(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{grading?.itemLabel}</DialogTitle>
            <DialogDescription>
              Grade for {grading?.learnerName}
            </DialogDescription>
          </DialogHeader>
          {grading ? (
            <GradeInput
              learner={grading.learner}
              learnerLabel={grading.learnerName}
              item={grading.item}
              itemLabel={grading.itemLabel}
              currentScore={
                typeof selectedCell?.score === "number"
                  ? selectedCell.score
                  : undefined
              }
              currentFeedback={selectedCell?.feedback ?? undefined}
              currentStatus={selectedCell?.status ?? undefined}
              onDirtyChange={setDirtyGrade}
              onSaved={() => {
                setDirtyGrade(false);
                setGrading(null);
                refetch();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default function GradebookPage() {
  return (
    <RequireCapability capability="grade">
      <GradebookPageContent />
    </RequireCapability>
  );
}

"use client";

import { ArrowLeft, GraduationCap, Send } from "lucide-react";
import { use, useState } from "react";
import { toast } from "sonner";
import { Fact, Facts } from "@/components/facts";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { Link } from "@/components/link";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import {
  AssignmentDates,
  AssignmentInstructions,
  AssignmentSkills,
} from "@/components/lms/assignment-reading";
import { LateDayControls } from "@/components/lms/late-day-controls";
import { StatusBadge } from "@/components/lms/status-badge";
import { PageContainer } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { assignmentTypeLabel } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import {
  loadAssignmentDetail,
  loadAssignments,
  loadGradesForMe,
  loadLateDayBalance,
  loadLateDaysList,
  loadSubmissionAttempts,
  loadSubmissionLatest,
} from "@/lib/lms";
import { cn } from "@/lib/utils";

export default function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignment: string }>;
}) {
  const { assignment } = use(params);
  const { session, me } = useAuth();

  const {
    data: asgnData,
    loading,
    error,
    refetch,
  } = useQuery(session ? () => loadAssignmentDetail(assignment) : null, [
    session,
    assignment,
  ]);

  const { data: assignmentsData } = useQuery(
    session ? () => loadAssignments() : null,
    [session, assignment],
  );

  const { data: subData, refetch: refetchSub } = useQuery<{
    submission: {
      submission: string;
      artifacts: string[];
      submittedAt: string;
      number: number;
      status: string;
    } | null;
  }>(
    me && asgnData && !("error" in asgnData)
      ? () => loadSubmissionLatest(assignment, String(me.user))
      : null,
    [assignment, me, asgnData],
  );

  const { data: attemptsData, refetch: refetchAttempts } = useQuery<{
    attempts: {
      submission: string;
      artifacts: string[];
      submittedAt: string;
      number: number;
      status: string;
    }[];
  }>(
    me && asgnData && !("error" in asgnData)
      ? () => loadSubmissionAttempts(assignment, String(me.user))
      : null,
    [assignment, me, asgnData],
  );
  const attempts = attemptsData?.attempts ?? [];

  const { data: artifactData } = useQuery<Record<string, string>>(
    attempts.length > 0 && me
      ? async () => {
          const artifacts = [
            ...new Set(attempts.flatMap((item) => item.artifacts)),
          ];
          const entries = await Promise.all(
            artifacts.map(async (artifact) => {
              const result = await api.submissions.artifact({
                assignment,
                submitter: String(me.user),
                artifact,
              });
              return [
                artifact,
                "error" in result ? "" : (result.post?.rendered ?? ""),
              ] as const;
            }),
          );
          return Object.fromEntries(entries);
        }
      : null,
    [attemptsData, assignment, me],
  );

  const { data: lateBalance, refetch: refetchLate } = useQuery<{
    balance: { granted: number; used: number; remaining: number };
  }>(me ? () => loadLateDayBalance(String(me.user)) : null, [me]);

  const { data: lateUseData, refetch: refetchLateUse } = useQuery(
    me ? () => loadLateDaysList() : null,
    [me, assignment],
  );

  const { data: gradesData, refetch: refetchGrades } = useQuery(
    me && session ? () => loadGradesForMe() : null,
    [me, session],
  );

  const { data: gradeItemData } = useQuery(
    me && session ? () => api.grades.item({ item: assignment }) : null,
    [session, me, assignment],
  );
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const detail =
    asgnData?.assignment && !("error" in asgnData) ? asgnData.assignment : null;
  const latest = subData?.submission;
  const balance = lateBalance?.balance ?? null;

  const appliedLateUse = lateUseData?.uses.find(
    (use) => use.item === assignment && use.status === "APPLIED",
  );

  async function submit() {
    if (!session || !content.trim()) return;
    setSubmitting(true);
    const result = await api.assignments.submit({
      assignment,
      content: content.trim(),
    });
    setSubmitting(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Submitted!");
      setContent("");
      refetchSub();
      refetchAttempts();
    }
  }

  const handleUpdate = () => {
    refetchSub();
    refetchAttempts();
    refetchLate();
    refetchLateUse();
    refetchGrades();
  };

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading assignment..." />
      </PageContainer>
    );
  if (error)
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );
  if (!detail)
    return (
      <PageContainer>
        <ErrorState message="Assignment not found" />
      </PageContainer>
    );

  const baseDue =
    assignmentsData?.assignments.find(
      (release) => release.assignment === assignment,
    )?.dueOverride ?? detail.dueAt;
  const unitHours = lateUseData?.unitHours ?? 24;
  const extensionMs = (appliedLateUse?.days ?? 0) * unitHours * 3600000;
  const due = new Date(new Date(baseDue).getTime() + extensionMs).toISOString();
  const effectiveClose = detail.closeAt;
  const now = new Date();
  const isOverdue = new Date(due) < now;
  const isPastClose = effectiveClose ? new Date(effectiveClose) < now : false;
  const canSubmit =
    Boolean(asgnData && "canSubmit" in asgnData && asgnData.canSubmit) &&
    !isPastClose &&
    new Date(detail.availableAt) <= now;

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/assignments"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to assignments
        </Link>
      </div>

      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1 min-w-0 break-words font-display text-3xl font-semibold tracking-tight">
            {detail.title}
          </h1>
          <Facts className="text-muted-foreground text-sm">
            <Fact.Kind>{assignmentTypeLabel(detail.kind)}</Fact.Kind>
            <Fact.Status status={detail.status} />
          </Facts>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/grades">
            <GraduationCap className="size-4 mr-1" /> View assessments
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {detail.instructions && (
            <AssignmentInstructions instructions={detail.instructions} />
          )}

          {gradeItemData && !("error" in gradeItemData) && (
            <AssignmentSkills criteria={gradeItemData.criteria} />
          )}

          {canSubmit && (
            <Card density="compact">
              <CardHeader>
                <CardTitle className="text-base">
                  {latest
                    ? `Resubmit (Attempt #${latest.number + 1})`
                    : "Submit"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your submission..."
                  rows={8}
                  disabled={submitting}
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={submit}
                    disabled={submitting || !content.trim()}
                    className="gap-1.5"
                  >
                    <Send className="size-4" />
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                  {latest && (
                    <Fact.When
                      verb="Last submitted"
                      at={latest.submittedAt}
                      className="text-xs"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {attempts.length > 0 && (
            <Card density="compact">
              <CardHeader>
                <CardTitle className="text-base">Submission attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...attempts].reverse().map((attempt) => (
                    <details
                      key={attempt.submission}
                      id={`attempt-${attempt.submission}`}
                      className={cn(
                        "rounded-lg border border-border px-3 py-2 text-sm",
                        attempt.status === "WITHDRAWN" && "opacity-60",
                      )}
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-3">
                        <span>
                          <span className="font-medium">
                            Attempt #{attempt.number}
                          </span>
                          <Fact.When
                            form="absolute"
                            at={attempt.submittedAt}
                            className="ml-2 text-xs"
                          />
                        </span>
                        <StatusBadge status={attempt.status} />
                      </summary>
                      <div className="mt-3 border-t border-border pt-3">
                        {attempt.artifacts.map((artifact) =>
                          artifactData?.[artifact] ? (
                            <RenderedMarkdown
                              key={artifact}
                              html={artifactData[artifact]}
                            />
                          ) : (
                            <p key={artifact} className="text-muted-foreground">
                              Submission content is unavailable.
                            </p>
                          ),
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Assessments</h2>
            <AssessmentHistory
              assessments={(gradesData?.grades ?? []).filter(
                (g) => g.item === assignment,
              )}
              toggle={false}
            />
          </section>
        </div>

        <aside className="space-y-5">
          <AssignmentDates
            availableAt={detail.availableAt}
            dueAt={due}
            closeAt={effectiveClose}
            overdue={isOverdue}
          />

          {detail.status === "PUBLISHED" && (
            <LateDayControls
              assignment={assignment}
              balance={balance}
              appliedDays={appliedLateUse?.days ?? 0}
              dueAt={baseDue}
              closeAt={detail.closeAt}
              unitHours={unitHours}
              onUpdate={handleUpdate}
            />
          )}
        </aside>
      </div>
    </PageContainer>
  );
}

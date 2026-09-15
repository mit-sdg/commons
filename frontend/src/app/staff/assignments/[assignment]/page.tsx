"use client";

import { Archive, Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact, Facts } from "@/components/facts";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { AssignmentForm } from "@/components/lms/assignment-form";
import {
  AssignmentDates,
  AssignmentInstructions,
  AssignmentSkills,
} from "@/components/lms/assignment-reading";
import { AssessmentInput } from "@/components/lms/grade-input";
import { GradeSetup } from "@/components/lms/grade-setup";
import { GradingDataNotice } from "@/components/lms/grading-data-notice";
import { StatusBadge } from "@/components/lms/status-badge";
import { BackLink, PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { TaskMarkdown } from "@/components/tasks/task-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { assignmentTypeLabel } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import { dueTime, fromZonedInput, toZonedInput } from "@/lib/format";
import {
  type Assessment,
  assessmentForEvidence,
  type GradingSetup,
} from "@/lib/grading";
import {
  loadGradesForItem,
  loadLateDaysForAssignment,
  loadSubmissionsForAssignment,
} from "@/lib/lms";

/** The evidence menu needs a value for "no attempt"; a submission id never looks like this. */
const EXCUSAL = "excusal";

function DueDateOverride({
  assignment,
  assignee,
  learnerName,
  courseDueAt,
  currentDueAt,
  onUpdate,
}: {
  assignment: string;
  assignee: string;
  learnerName: string;
  courseDueAt: string;
  currentDueAt: string | null;
  onUpdate: () => void;
}) {
  const { timezone } = useCourse();
  const [dueAt, setDueAt] = useState(
    toZonedInput(currentDueAt ?? courseDueAt, timezone),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await api.assignments["set-due-override"]({
      assignment,
      assignee,
      dueAt: fromZonedInput(dueAt, timezone),
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Due date updated for ${learnerName}`);
      onUpdate();
    }
  }

  async function clear() {
    setBusy(true);
    const result = await api.assignments["clear-due-override"]({
      assignment,
      assignee,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Course due date restored for ${learnerName}`);
      setDueAt(toZonedInput(courseDueAt, timezone));
      onUpdate();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label
          htmlFor={`due-override-${assignee}`}
          className="text-xs text-muted-foreground"
        >
          Individual due date ({timezone})
        </Label>
        <Input
          id={`due-override-${assignee}`}
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="w-auto"
          disabled={busy}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={save}
        disabled={busy || !dueAt}
      >
        Save due date
      </Button>
      {currentDueAt ? (
        <Button size="sm" variant="ghost" onClick={clear} disabled={busy}>
          Use course date
        </Button>
      ) : null}
    </div>
  );
}

function StaffAssignmentDetailPageContent({
  params,
}: {
  params: Promise<{ assignment: string }>;
}) {
  const { assignment } = use(params);
  const router = useRouter();
  const { session, permissions } = useAuth();
  const canManage = permissions.can("course:manage");
  const canGrade = permissions.can("grade");
  const [editing, setEditing] = useState(false);
  const [gradingUser, setGradingUser] = useState<string | null>(null);
  const [gradingEvidence, setGradingEvidence] = useState<string | null>(null);
  const [gradingDirty, setGradingDirty] = useState(false);
  const [setupDirty, setSetupDirty] = useState(false);
  const [pendingGradingTarget, setPendingGradingTarget] = useState<{
    learner: string;
    evidence: string | null;
  } | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [pendingAttemptHash, setPendingAttemptHash] = useState<string | null>(
    null,
  );

  const {
    data: asgnData,
    loading,
    error,
    refetch,
  } = useQuery(
    session
      ? () => api.assignments["staff-summary"]({ assignment }).then(unwrap)
      : null,
    [session, assignment],
  );

  const { data: subsData, refetch: refetchSubmissions } = useQuery<{
    assigned: {
      assignee: string;
      displayName: string | null;
      release: string;
      dueOverride: string | null;
      status: string;
    }[];
    submissions: {
      submitter: string;
      submitterName: string | null;
      submission: string;
      artifacts: string[];
      submittedAt: string;
      number: number;
      status: string;
    }[];
  }>(
    session && canGrade ? () => loadSubmissionsForAssignment(assignment) : null,
    [session, assignment],
  );

  const submissions = subsData?.submissions ?? [];
  const { data: artifactData } = useQuery<Record<string, string>>(
    submissions.length > 0
      ? async () => {
          const artifacts = submissions.flatMap((submission) =>
            submission.artifacts.map((artifact) => ({
              artifact,
              submitter: submission.submitter,
            })),
          );
          const entries = await Promise.all(
            artifacts.map(async ({ artifact, submitter }) => {
              const result = await api.submissions.artifact({
                assignment,
                submitter,
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
    [subsData],
  );

  const gradesQuery = useQuery(
    session && canGrade ? () => loadGradesForItem(assignment) : null,
    [session, assignment],
    { retainOnTransportError: true },
  );
  const { refetch: refetchGrades } = gradesQuery;

  const { data: lateData } = useQuery<{
    users: { learner: string; days: number }[];
  }>(session && canGrade ? () => loadLateDaysForAssignment(assignment) : null, [
    session,
    assignment,
  ]);

  const gradingSetup = useQuery(
    session && canGrade
      ? () => api.grades.item({ item: assignment }).then(unwrap)
      : null,
    [session, assignment],
    { retainOnTransportError: true },
  );
  const detail = asgnData?.summary;
  const assigned = subsData?.assigned ?? [];
  const grades = (gradesQuery.data?.grades ?? []) as Assessment[];
  const currentSetup = gradingSetup.data as GradingSetup | null;
  const gradingDataReady = Boolean(currentSetup && gradesQuery.data);
  const gradingDataLoading = gradingSetup.loading || gradesQuery.loading;
  const gradingDataError = gradingSetup.error ?? gradesQuery.error ?? null;
  const gradingDataRefused = !gradingSetup.data
    ? gradingSetup.refused
    : gradesQuery.refused;
  const gradingDataUnavailable =
    !gradingDataReady || gradingDataLoading || Boolean(gradingDataError);
  const lateUsers = lateData?.users ?? [];
  const draftCount = gradingDataReady
    ? grades.filter((record) => record.status === "DRAFT").length
    : 0;

  function refetchGradingData() {
    gradingSetup.refetch();
    refetchGrades();
  }

  function openAssessment(learner: string, evidence: string | null) {
    if (
      gradingDirty &&
      (gradingUser !== learner || gradingEvidence !== evidence)
    ) {
      setPendingGradingTarget({ learner, evidence });
      return;
    }
    setGradingUser(learner);
    setGradingEvidence(evidence);
  }

  useEffect(() => {
    function queueAttempt() {
      setPendingAttemptHash(
        canGrade && window.location.hash.startsWith("#attempt-")
          ? window.location.hash.slice(1)
          : null,
      );
    }
    queueAttempt();
    window.addEventListener("hashchange", queueAttempt);
    return () => {
      window.removeEventListener("hashchange", queueAttempt);
    };
  }, [canGrade]);

  useEffect(() => {
    if (!canGrade || !pendingAttemptHash) return;
    let scrollFrame = 0;
    const revealFrame = requestAnimationFrame(() => {
      const target = document.getElementById(pendingAttemptHash);
      if (!(target instanceof HTMLDetailsElement)) return;
      setTab("submissions");
      target.open = true;
      scrollFrame = requestAnimationFrame(() => {
        target.scrollIntoView();
        setPendingAttemptHash(null);
      });
    });
    return () => {
      cancelAnimationFrame(revealFrame);
      cancelAnimationFrame(scrollFrame);
    };
  }, [canGrade, pendingAttemptHash, loading, subsData, gradingDataReady]);

  const submittedIds = new Set(submissions.map((s) => s.submitter));

  const lateMap = new Map(lateUsers.map((u) => [u.learner, u.days]));

  async function publish() {
    if (!session) return;
    const result = await api.assignments.publish({ assignment });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      await Promise.all([refetch(), refetchSubmissions(), refetchGrades()]);
      toast.success("Assignment published");
    }
  }

  async function archive() {
    if (!session) return;
    const result = await api.assignments.archive({ assignment });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Assignment archived");
      refetch();
    }
  }

  async function releaseAll() {
    if (!session) return;
    if (!currentSetup || gradingDataUnavailable) return;
    try {
      const result = await api.grades["release-item"]({ item: assignment });
      if ("error" in result) toast.error(publicErrorMessage(result.error));
      else {
        const summary = `${result.released.length} assessments released; ${result.skipped.length} skipped (incomplete or changed).`;
        if (result.unconfirmed.length)
          toast.error(
            `${summary} ${result.unconfirmed.length} outcomes could not be confirmed. Review the refreshed grades before retrying.`,
          );
        else toast.success(summary);
      }
    } catch {
      toast.error(
        "Release outcomes could not be confirmed. Grades were refreshed before retrying.",
      );
    } finally {
      refetchGrades();
    }
  }

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading assignment…" />
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

  const totalAssigned = assigned.length;
  const totalSubmitted = submittedIds.size;
  const totalMissing = Math.max(0, totalAssigned - totalSubmitted);

  if (editing && canManage)
    return (
      <PageContainer>
        <div className="mb-6">
          <h1 className="mb-6 font-display text-3xl font-semibold">
            Edit assignment
          </h1>
          <AssignmentForm
            existing={detail}
            onSaved={() => {
              setEditing(false);
              refetch();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </PageContainer>
    );

  return (
    <PageContainer>
      <BackLink
        href={canManage ? "/staff/assignments" : "/staff/gradebook"}
        onClick={(event) => {
          if (!setupDirty && !gradingDirty) return;
          event.preventDefault();
          setPendingLeave(
            canManage ? "/staff/assignments" : "/staff/gradebook",
          );
        }}
      >
        {canManage ? "Back to assignments" : "Back to assessment book"}
      </BackLink>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {detail.title}
            </h1>
            <StatusBadge status={detail.status} />
          </div>
          <Facts className="text-muted-foreground text-sm">
            <Fact.Kind>{assignmentTypeLabel(detail.kind)}</Fact.Kind>
            <Fact.Due verb="Due" at={detail.dueAt} />
          </Facts>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {detail.status !== "ARCHIVED" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (setupDirty || gradingDirty) setPendingEdit(true);
                  else setEditing(true);
                }}
              >
                Edit
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Archived assignments are read-only
              </span>
            )}
            {detail.status === "DRAFT" && (
              <ConfirmAction
                title="Publish this assignment?"
                description={`${detail.audience === "EVERYONE" ? "All active students" : `${detail.targets.length} targeted section${detail.targets.length === 1 ? "" : "s"}`} will receive this assignment. It is available ${dueTime(detail.availableAt)}, due ${dueTime(detail.dueAt)}${detail.closeAt ? `, and closes ${dueTime(detail.closeAt)}` : ""}.`}
                confirmLabel="Publish assignment"
                onConfirm={publish}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600"
                  >
                    <Eye className="size-4 mr-1" /> Publish
                  </Button>
                }
              />
            )}
            {detail.status !== "ARCHIVED" ? (
              <ConfirmAction
                title="Archive this assignment?"
                description="Learners will no longer see it in their active assignment list."
                confirmLabel="Archive assignment"
                destructive
                onConfirm={archive}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                  >
                    <Archive className="size-4 mr-1" /> Archive
                  </Button>
                }
              />
            ) : null}
          </div>
        )}
      </div>

      <Tabs
        value={tab}
        className="gap-6"
        onValueChange={(value) => {
          setPendingAttemptHash(null);
          setTab(value);
          if (value === "preview") gradingSetup.refetch();
        }}
      >
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canGrade && detail.status !== "DRAFT" && (
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          )}
          <TabsTrigger value="preview">Student preview</TabsTrigger>
        </TabsList>
        <TabsContent
          value="overview"
          forceMount
          hidden={tab !== "overview"}
          className="space-y-8"
        >
          <section className="space-y-3">
            <h2 className="font-medium">Instructions</h2>
            {detail.instructions ? (
              <TaskMarkdown content={detail.instructions} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No instructions yet.
              </p>
            )}
          </section>
          <section className="space-y-3 border-t pt-6">
            <h2 className="font-medium">Schedule and recipients</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Available from</dt>
                <dd>{dueTime(detail.availableAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due date</dt>
                <dd>{dueTime(detail.dueAt)}</dd>
              </div>
              {detail.closeAt && (
                <div>
                  <dt className="text-muted-foreground">Closes</dt>
                  <dd>{dueTime(detail.closeAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Assigned to</dt>
                <dd>
                  {detail.audience === "EVERYONE"
                    ? "all students"
                    : `${detail.targets.length} selected sections`}
                </dd>
              </div>
            </dl>
          </section>
          {canGrade && detail.acceptsSubmissions && (
            <GradeSetup
              item={assignment}
              title={detail.title}
              published={detail.status === "PUBLISHED"}
              readOnly={detail.status === "ARCHIVED"}
              onMethodChange={() => {
                refetchGradingData();
              }}
              onDirtyChange={setSetupDirty}
            />
          )}
        </TabsContent>
        <TabsContent
          value="preview"
          forceMount
          hidden={tab !== "preview"}
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            Assignment content as shown to students. Personal history, late
            days, and deadline overrides are omitted; submission controls are
            inactive.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              {detail.instructions && (
                <AssignmentInstructions instructions={detail.instructions} />
              )}
              {canGrade && gradingSetup.loading && !gradingSetup.data ? (
                <LoadingState label="Loading grading setup…" />
              ) : canGrade && gradingSetup.error && !gradingSetup.data ? (
                <ErrorState
                  message={gradingSetup.error}
                  refused={gradingSetup.refused}
                  onRetry={gradingSetup.refetch}
                />
              ) : (
                <>
                  {canGrade && gradingSetup.data ? (
                    <GradingDataNotice
                      loading={gradingSetup.loading}
                      error={gradingSetup.error}
                      onRetry={gradingSetup.refetch}
                    />
                  ) : null}
                  {currentSetup ? (
                    <AssignmentSkills criteria={currentSetup.criteria} />
                  ) : null}
                </>
              )}
              {detail.acceptsSubmissions && (
                <Card density="compact">
                  <CardHeader>
                    <CardTitle className="text-base">Submit</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      disabled
                      aria-label="Submission preview"
                      placeholder="Write your submission…"
                      rows={8}
                    />
                    <Button disabled>
                      <Send className="size-4" /> Submit
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
            <aside>
              <AssignmentDates
                availableAt={detail.availableAt}
                dueAt={detail.dueAt}
                closeAt={detail.closeAt}
              />
            </aside>
          </div>
        </TabsContent>
        {canGrade && (
          <TabsContent
            value="submissions"
            forceMount
            hidden={tab !== "submissions"}
            className="space-y-6"
          >
            <Facts className="text-sm">
              <Fact.Count n={totalAssigned} noun="assigned" plural="assigned" />
              <Fact.Count
                n={totalSubmitted}
                noun="submitted"
                plural="submitted"
              />
              <Fact.Count n={totalMissing} noun="missing" plural="missing" />
            </Facts>
            {canGrade && (
              <Card>
                <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Learner work and grades
                    </CardTitle>
                  </div>
                  <ConfirmAction
                    title="Release complete draft grades?"
                    description="Complete drafts will become visible to learners. Incomplete or concurrently changed drafts will be skipped and reported."
                    confirmLabel="Release grades"
                    confirmDisabled={gradingDataUnavailable || draftCount === 0}
                    onConfirm={releaseAll}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={gradingDataUnavailable || draftCount === 0}
                      >
                        <Send className="size-4" /> Release drafts
                        {gradingDataReady ? ` (${draftCount})` : ""}
                      </Button>
                    }
                  />
                </CardHeader>
                <CardContent>
                  {!gradingDataReady ? (
                    gradingDataLoading ? (
                      <LoadingState label="Loading grading data…" />
                    ) : (
                      <ErrorState
                        message={
                          gradingDataError ?? "Grading data is unavailable."
                        }
                        refused={gradingDataRefused}
                        onRetry={refetchGradingData}
                      />
                    )
                  ) : assigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No learners are assigned yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <GradingDataNotice
                        loading={gradingDataLoading}
                        error={gradingDataError}
                        onRetry={refetchGradingData}
                      />
                      {assigned.map((learner) => {
                        const learnerId = String(learner.assignee);
                        const attempts = submissions
                          .filter(
                            (submission) => submission.submitter === learnerId,
                          )
                          .sort((left, right) => left.number - right.number);
                        const latest = attempts
                          .filter((a) => a.status === "SUBMITTED")
                          .at(-1);
                        const learnerGrades = grades.filter(
                          (grade) =>
                            grade.learner === learnerId &&
                            grade.item === assignment,
                        );
                        const visibleAssessment = assessmentForEvidence(
                          grades,
                          learnerId,
                          assignment,
                          latest?.submission ?? "",
                        );
                        const newAttemptNeedsReview = Boolean(
                          latest && !visibleAssessment,
                        );
                        const lateDays = lateMap.get(learnerId) ?? 0;
                        const isGrading = gradingUser === learnerId;
                        const selectedAssessment = learnerGrades.find(
                          (grade) => grade.evidence === (gradingEvidence ?? ""),
                        );

                        return (
                          <div
                            key={learnerId}
                            className="space-y-3 rounded-lg border border-border p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {learner.displayName}
                                </p>
                                <Facts className="text-muted-foreground text-xs">
                                  {latest ? (
                                    <Fact.Count
                                      n={attempts.length}
                                      noun="attempt"
                                    />
                                  ) : (
                                    <span>No submission yet</span>
                                  )}
                                  {lateDays > 0 ? (
                                    <Fact.Count n={lateDays} noun="late day" />
                                  ) : null}
                                  {latest ? (
                                    <Fact.When
                                      verb="Latest"
                                      at={latest.submittedAt}
                                    />
                                  ) : null}
                                </Facts>
                                {attempts.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {attempts.map((attempt) => (
                                      <details
                                        key={attempt.submission}
                                        id={`attempt-${attempt.submission}`}
                                        className="rounded-md border border-border px-2 py-1.5 text-xs"
                                      >
                                        <summary className="cursor-pointer font-medium">
                                          <Facts
                                            as="span"
                                            className="inline-flex"
                                          >
                                            <span>
                                              Attempt #{attempt.number}
                                            </span>
                                            <Fact.When
                                              form="absolute"
                                              at={attempt.submittedAt}
                                            />
                                            <Fact.Status
                                              status={attempt.status.toUpperCase()}
                                            />
                                          </Facts>
                                        </summary>
                                        <div className="mt-2 space-y-2 border-t border-border pt-2 text-sm">
                                          {attempt.artifacts.map((artifact) =>
                                            artifactData?.[artifact] ? (
                                              <RenderedMarkdown
                                                key={artifact}
                                                html={artifactData[artifact]}
                                              />
                                            ) : (
                                              <p
                                                key={artifact}
                                                className="text-muted-foreground"
                                              >
                                                Submission content is
                                                unavailable.
                                              </p>
                                            ),
                                          )}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                              gradingDataUnavailable ||
                                              (attempt.status !== "SUBMITTED" &&
                                                !learnerGrades.some(
                                                  (g) =>
                                                    g.evidence ===
                                                    attempt.submission,
                                                ))
                                            }
                                            onClick={() =>
                                              openAssessment(
                                                learnerId,
                                                attempt.submission,
                                              )
                                            }
                                          >
                                            Assess this attempt
                                          </Button>
                                        </div>
                                      </details>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="space-y-1 text-right text-sm">
                                <div className="flex items-center justify-end gap-2">
                                  {visibleAssessment ? (
                                    <StatusBadge
                                      status={visibleAssessment.status}
                                    />
                                  ) : null}
                                  <span className="text-muted-foreground tabular-nums">
                                    {!visibleAssessment
                                      ? "Not assessed"
                                      : visibleAssessment.status === "EXCUSED"
                                        ? visibleAssessment.evidence
                                          ? "Attempt excused"
                                          : "Assignment excused"
                                        : visibleAssessment.method ===
                                              "POINTS" &&
                                            visibleAssessment.scored
                                          ? `${visibleAssessment.score} / ${visibleAssessment.outOf}`
                                          : `${learnerGrades.length} assessment${learnerGrades.length === 1 ? "" : "s"}`}
                                  </span>
                                </div>
                                {visibleAssessment?.attempt ? (
                                  <p className="text-xs text-muted-foreground">
                                    Assessed attempt #
                                    {visibleAssessment.attempt}
                                  </p>
                                ) : null}
                                {newAttemptNeedsReview ? (
                                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                    New attempt needs review
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {canManage && (
                              <details className="text-sm">
                                <summary className="cursor-pointer text-muted-foreground">
                                  Adjust deadline
                                </summary>
                                <div className="pt-3">
                                  <DueDateOverride
                                    assignment={assignment}
                                    assignee={learnerId}
                                    learnerName={
                                      learner.displayName ?? learner.assignee
                                    }
                                    courseDueAt={detail.dueAt}
                                    currentDueAt={learner.dueOverride}
                                    onUpdate={refetchSubmissions}
                                  />
                                </div>
                              </details>
                            )}

                            {isGrading && (
                              <div className="space-y-2">
                                <Label htmlFor={`evidence-${learnerId}`}>
                                  Evidence being assessed
                                </Label>
                                <Select
                                  value={gradingEvidence ?? EXCUSAL}
                                  disabled={gradingDataUnavailable}
                                  onValueChange={(value) =>
                                    openAssessment(
                                      learnerId,
                                      value === EXCUSAL ? null : value,
                                    )
                                  }
                                >
                                  <SelectTrigger
                                    id={`evidence-${learnerId}`}
                                    className="w-full"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={EXCUSAL}>
                                      Assignment excusal (no attempt)
                                    </SelectItem>
                                    {attempts
                                      .filter(
                                        (a) =>
                                          a.status === "SUBMITTED" ||
                                          learnerGrades.some(
                                            (g) => g.evidence === a.submission,
                                          ),
                                      )
                                      .map((a) => (
                                        <SelectItem
                                          key={a.submission}
                                          value={a.submission}
                                        >
                                          Attempt {a.number} (
                                          {a.status.toLowerCase()})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {isGrading && currentSetup ? (
                              <AssessmentInput
                                key={`${learnerId}-${gradingEvidence ?? "assignment"}`}
                                learner={learnerId}
                                learnerLabel={
                                  learner.displayName ?? learner.assignee
                                }
                                item={assignment}
                                itemLabel={detail.title}
                                evidence={gradingEvidence ?? ""}
                                recordVersion={selectedAssessment?.version}
                                disabled={gradingDataUnavailable}
                                onDirtyChange={setGradingDirty}
                                onSaved={refetchGrades}
                              />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={gradingDataUnavailable}
                                onClick={() =>
                                  openAssessment(
                                    learnerId,
                                    latest?.submission ?? null,
                                  )
                                }
                              >
                                Review assessments
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
      <ConfirmAction
        open={pendingGradingTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPendingGradingTarget(null);
        }}
        title="Switch assessments?"
        description="This discards only the unsaved scores or feedback in the open editor. Saved assessments and correction history are unchanged."
        confirmLabel="Discard draft and switch"
        onConfirm={() => {
          if (!pendingGradingTarget) return;
          setGradingDirty(false);
          setGradingUser(pendingGradingTarget.learner);
          setGradingEvidence(pendingGradingTarget.evidence);
          setPendingGradingTarget(null);
        }}
      />
      <ConfirmAction
        open={pendingEdit}
        onOpenChange={setPendingEdit}
        title="Leave the grading setup?"
        description="This discards only unsaved setup or assessment input on this page. Existing assessments, released grades, and correction history are unchanged."
        confirmLabel="Discard draft and edit assignment"
        onConfirm={() => {
          setSetupDirty(false);
          setGradingDirty(false);
          setPendingEdit(false);
          setEditing(true);
        }}
      />
      <ConfirmAction
        open={pendingLeave !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLeave(null);
        }}
        title="Leave this assignment?"
        description="This discards only unsaved setup or assessment input on this page. Existing assessments, released grades, and correction history are unchanged."
        confirmLabel="Discard draft and leave"
        onConfirm={() => {
          if (!pendingLeave) return;
          const destination = pendingLeave;
          setSetupDirty(false);
          setGradingDirty(false);
          setPendingLeave(null);
          router.push(destination);
        }}
      />
    </PageContainer>
  );
}

export default function StaffAssignmentDetailPage(props: {
  params: Promise<{ assignment: string }>;
}) {
  return (
    <RequireCapability capability={["course:manage", "grade"]}>
      <StaffAssignmentDetailPageContent {...props} />
    </RequireCapability>
  );
}

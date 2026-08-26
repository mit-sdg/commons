"use client";

import { Archive, ArrowLeft, Eye, Send } from "lucide-react";
import { use, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { AssignmentForm } from "@/components/lms/assignment-form";
import { GradeInput } from "@/components/lms/grade-input";
import { GradeSetup } from "@/components/lms/grade-setup";
import { StatusBadge } from "@/components/lms/status-badge";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { TaskMarkdown } from "@/components/tasks/task-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count, fullTime, relativeTime } from "@/lib/format";
import {
  loadGradesForItem,
  loadLateDaysForAssignment,
  loadSubmissionsForAssignment,
} from "@/lib/lms";

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
  const [dueAt, setDueAt] = useState(
    new Date(currentDueAt ?? courseDueAt).toISOString().slice(0, 16),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await api.assignments["set-due-override"]({
      assignment,
      assignee,
      dueAt: new Date(dueAt).toISOString(),
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
      setDueAt(new Date(courseDueAt).toISOString().slice(0, 16));
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
          Individual due date
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
  const { session } = useAuth();
  const [editing, setEditing] = useState(false);
  const [gradingUser, setGradingUser] = useState<string | null>(null);

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
      submittedAt: string;
      number: number;
      status: string;
    }[];
  }>(session ? () => loadSubmissionsForAssignment(assignment) : null, [
    session,
    assignment,
  ]);

  const { data: gradesData, refetch: refetchGrades } = useQuery<{
    grades: { learner: string; grade: string; score: number; status: string }[];
  }>(session ? () => loadGradesForItem(assignment) : null, [
    session,
    assignment,
  ]);

  const { data: lateData } = useQuery<{
    users: { learner: string; days: number }[];
  }>(session ? () => loadLateDaysForAssignment(assignment) : null, [
    session,
    assignment,
  ]);

  const detail = asgnData?.summary;
  const assigned = subsData?.assigned ?? [];
  const submissions = subsData?.submissions ?? [];
  const grades = gradesData?.grades ?? [];
  const lateUsers = lateData?.users ?? [];

  const submittedIds = new Set(submissions.map((s) => s.submitter));
  const gradeMap = new Map(grades.map((g) => [g.learner, g]));
  const lateMap = new Map(lateUsers.map((u) => [u.learner, u.days]));

  async function publish() {
    if (!session) return;
    const result = await api.assignments.publish({ assignment });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Assignment published!");
      refetch();
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
    const result = await api.grades["release-item"]({
      item: assignment,
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("All grades released");
      refetchGrades();
    }
  }

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

  const totalAssigned = assigned.length;
  const totalSubmitted = submittedIds.size;
  const totalMissing = Math.max(0, totalAssigned - totalSubmitted);

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/staff/assignments"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to assignments
        </Link>
      </div>

      {editing ? (
        <div className="mb-6">
          <AssignmentForm
            existing={detail}
            onSaved={() => {
              setEditing(false);
              refetch();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {detail.title}
              </h1>
              <StatusBadge status={detail.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.kind} · Due: {fullTime(detail.dueAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {detail.status !== "ARCHIVED" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Archived assignments are read-only
              </span>
            )}
            {detail.status === "DRAFT" && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600"
                onClick={publish}
              >
                <Eye className="size-4 mr-1" /> Publish
              </Button>
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
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Assigned</p>
            <p className="text-2xl font-semibold">{totalAssigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-2xl font-semibold">{totalSubmitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Missing</p>
            <p className="text-2xl font-semibold">{totalMissing}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {detail.acceptsSubmissions && detail.status === "PUBLISHED" ? (
          <GradeSetup item={assignment} />
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Learner progress and grades
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                One grade per learner, with every submission attempt kept as
                evidence.
              </p>
            </div>
            <ConfirmAction
              title="Release all draft grades?"
              description="Every draft grade for this assignment will become visible to its learner."
              confirmLabel="Release grades"
              onConfirm={releaseAll}
              trigger={
                <Button size="sm" variant="outline">
                  <Send className="size-4" /> Release drafts
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No learners are assigned yet.
              </p>
            ) : (
              <div className="space-y-3">
                {assigned.map((learner) => {
                  const learnerId = String(learner.assignee);
                  const attempts = submissions
                    .filter((submission) => submission.submitter === learnerId)
                    .sort((left, right) => left.number - right.number);
                  const latest = attempts.at(-1);
                  const grade = gradeMap.get(learnerId);
                  const lateDays = lateMap.get(learnerId) ?? 0;
                  const isGrading = gradingUser === learnerId;

                  return (
                    <div
                      key={learnerId}
                      className="space-y-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{learner.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {latest
                              ? `${count(attempts.length, "attempt")} · Latest ${relativeTime(latest.submittedAt)}`
                              : "No submission yet"}
                            {lateDays > 0 ? (
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                {count(lateDays, "late day")}
                              </Badge>
                            ) : null}
                          </p>
                          {attempts.length > 1 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Attempts{" "}
                              {attempts
                                .map((attempt) => `#${attempt.number}`)
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                        {grade ? (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={grade.status} />
                            <span className="font-mono text-sm">
                              {grade.score}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline">Not graded</Badge>
                        )}
                      </div>

                      <DueDateOverride
                        assignment={assignment}
                        assignee={learnerId}
                        learnerName={learner.displayName ?? learner.assignee}
                        courseDueAt={detail.dueAt}
                        currentDueAt={learner.dueOverride}
                        onUpdate={refetchSubmissions}
                      />

                      {isGrading ? (
                        <GradeInput
                          learner={learnerId}
                          item={assignment}
                          currentScore={grade?.score}
                          currentStatus={grade?.status}
                          onSaved={() => {
                            setGradingUser(null);
                            refetchGrades();
                          }}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setGradingUser(learnerId)}
                        >
                          {grade ? "Review grade" : "Add grade"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {detail.instructions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskMarkdown content={detail.instructions} />
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

export default function StaffAssignmentDetailPage(props: {
  params: Promise<{ assignment: string }>;
}) {
  return (
    <RequireCapability capability="course:manage">
      <StaffAssignmentDetailPageContent {...props} />
    </RequireCapability>
  );
}

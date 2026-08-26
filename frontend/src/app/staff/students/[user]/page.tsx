"use client";

import { ArrowLeft, BookOpen, Clock, GraduationCap, User } from "lucide-react";
import { use } from "react";
import { Link } from "@/components/link";
import { StatusBadge } from "@/components/lms/status-badge";
import { StudentNotes } from "@/components/lms/student-notes";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import {
  loadGradesForStudent,
  loadLateDayBalance,
  loadStaffNotes,
  loadStudentDetail,
  loadSubmissionsForStudent,
} from "@/lib/lms";

function StudentDetailPageContent({
  params,
}: {
  params: Promise<{ user: string }>;
}) {
  const { user } = use(params);
  const { session } = useAuth();

  const {
    data: detailData,
    loading,
    error,
    refetch,
  } = useQuery(session ? () => loadStudentDetail(user) : null, [session, user]);

  const { data: submissionsData } = useQuery<{
    submissions: {
      assignment: string;
      submission: string;
      submittedAt: string;
      number: number;
      status: string;
    }[];
  }>(() => loadSubmissionsForStudent(user), [user]);

  const { data: assignmentTitles } = useQuery<Record<string, string>>(
    submissionsData?.submissions
      ? async () => {
          const assignments = [
            ...new Set(
              submissionsData.submissions.map(
                (submission) => submission.assignment,
              ),
            ),
          ];
          const entries = await Promise.all(
            assignments.map(async (assignment) => {
              const result = await api.assignments["staff-summary"]({
                assignment,
              });
              return [
                assignment,
                "error" in result
                  ? assignment.slice(0, 8)
                  : (result.summary?.title ?? assignment.slice(0, 8)),
              ] as const;
            }),
          );
          return Object.fromEntries(entries);
        }
      : null,
    [submissionsData],
  );

  const { data: gradesData } = useQuery(
    session ? () => loadGradesForStudent(user) : null,
    [session, user],
  );

  const { data: lateBalance } = useQuery<{
    balance: { granted: number; used: number; remaining: number };
  }>(() => loadLateDayBalance(user), [user]);

  useQuery<{
    uses: { item: string; days: number; status: string; appliedAt: string }[];
  }>(
    () =>
      loadLateDayBalance(user).then(() => {
        return {
          uses: [] as {
            item: string;
            days: number;
            status: string;
            appliedAt: string;
          }[],
        };
      }),
    [user],
  );

  const { data: notesData, refetch: refetchNotes } = useQuery(
    session ? () => loadStaffNotes(user) : null,
    [session, user],
  );

  const seat = detailData?.detail ?? undefined;
  const submissions = submissionsData?.submissions ?? [];
  const grades = gradesData?.grades ?? [];
  const notes = (notesData?.notes ?? []).map((n) => ({ ...n, learner: user }));
  const balance = lateBalance?.balance;

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading student..." />
      </PageContainer>
    );
  if (error)
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/staff/roster"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to roster
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {detailData?.displayName ?? seat?.email ?? user}
        </h1>
        {seat ? (
          <p className="mt-1 text-sm text-muted-foreground">{seat.email}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/u/${user}`}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <User className="size-3.5" /> Profile
          </Link>
          {seat && (
            <>
              <span>·</span>
              <StatusBadge status={seat.kind} />
              <span>·</span>
              <StatusBadge status={seat.status} />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="size-4" /> Submissions (
                {submissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No submissions yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((s) => (
                    <Link
                      key={s.submission}
                      href={`/staff/assignments/${s.assignment}`}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">
                          {assignmentTitles?.[s.assignment] ??
                            s.assignment.slice(0, 8)}{" "}
                          · Attempt #{s.number}
                        </span>
                        <span className="ml-2 block text-xs text-muted-foreground sm:inline">
                          {relativeTime(s.submittedAt)} · Open evidence
                        </span>
                      </div>
                      <StatusBadge status={s.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="size-4" /> Grades ({grades.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {grades.length === 0 ? (
                <p className="text-sm text-muted-foreground">No grades yet.</p>
              ) : (
                <div className="space-y-2">
                  {grades.map((g) => (
                    <div
                      key={g.grade}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {g.label || g.item.slice(0, 8)}
                        </span>
                        <StatusBadge status={g.status} />
                      </div>
                      <span className="tabular-nums">
                        {g.score}/{g.maxPoints}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4" /> Late Days
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {balance ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-xs text-muted-foreground">Granted</p>
                    <p className="text-xl font-semibold">{balance.granted}</p>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-xs text-muted-foreground">Used</p>
                    <p className="text-xl font-semibold">{balance.used}</p>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="text-xl font-semibold">{balance.remaining}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No late-day data.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentNotes
                learner={user}
                notes={notes}
                onUpdate={refetchNotes}
                editable
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export default function StudentDetailPage(props: {
  params: Promise<{ user: string }>;
}) {
  return (
    <RequireCapability capability="student-records">
      <StudentDetailPageContent {...props} />
    </RequireCapability>
  );
}

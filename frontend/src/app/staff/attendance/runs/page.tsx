"use client";

import { Radio } from "lucide-react";
import { useMemo } from "react";
import { Fact, Facts } from "@/components/facts";
import { LectureSwitch } from "@/components/live/lecture-switch";
import { FormTag } from "@/components/live/quiz-meta";
import { BackLink, PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import {
  lectureLabel,
  loadAttendance,
  loadPastRuns,
  openedTime,
  pastRuns,
  runsByDate,
} from "@/lib/attendance";
import { useAuth } from "@/lib/auth";

function MarkLecturesContent() {
  const { session } = useAuth();
  const attendance = useQuery(session ? () => loadAttendance() : null, [
    session,
  ]);
  const runs = useQuery(session ? () => loadPastRuns() : null, [session]);

  const timezone = attendance.data?.timezone ?? null;
  const groups = useMemo(
    () =>
      runs.data && attendance.data
        ? runsByDate(pastRuns(runs.data, attendance.data.timezone))
        : null,
    [runs.data, attendance.data],
  );

  const failed = attendance.error ? attendance : runs.error ? runs : null;

  return (
    <PageContainer>
      <BackLink href="/staff/attendance">Attendance</BackLink>
      <PageHeader eyebrow="Staff" title="Mark lectures" />
      {failed ? (
        <ErrorState
          message={failed.error ?? ""}
          refused={failed.refused}
          onRetry={failed.refetch}
        />
      ) : groups === null ? (
        <LoadingState label="Loading runs…" />
      ) : groups.length === 0 ? (
        <EmptyState icon={Radio} title="No runs" />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.date} className="space-y-2">
              <h2 className="font-display text-lg font-semibold">
                {lectureLabel(group.date)}
              </h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {group.runs.map((run) => (
                  <li
                    key={run.run}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <Facts className="min-w-0 text-sm">
                      <span dir="auto">{run.title}</span>
                      <FormTag form={run.kind} />
                      <span className="text-muted-foreground">
                        {openedTime(run.openedAt, timezone)}
                      </span>
                      {run.open ? <Fact.Status status="OPEN" /> : null}
                    </Facts>
                    <LectureSwitch
                      run={run.run}
                      lecture={run.lecture}
                      onChanged={runs.refetch}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export default function MarkLecturesPage() {
  return (
    <RequireCapability
      capability={[
        "course:manage",
        "grade",
        "student-records",
        "moderate",
        "live:host",
      ]}
    >
      <MarkLecturesContent />
    </RequireCapability>
  );
}

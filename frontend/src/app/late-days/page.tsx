"use client";

import { CalendarClock } from "lucide-react";
import { Fact, Facts } from "@/components/facts";
import { Link } from "@/components/link";
import {
  CoverLateness,
  LateDayCancel,
  LateDayStepper,
} from "@/components/lms/late-day-stepper";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { InlineHelp } from "@/components/ui/inline-help";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import {
  daysLeft,
  type LateDayRow,
  type LateDayTerms,
  lateBy,
  lateDayRows,
  lateDayTerms,
} from "@/lib/late-days";
import {
  loadAssignments,
  loadLateDayBalance,
  loadLateDaysList,
  loadSubmissionsForStudent,
} from "@/lib/lms";

export default function LateDaysPage() {
  const { session, me } = useAuth();
  const learner = me ? String(me.user) : null;

  const list = useQuery(session ? () => loadLateDaysList() : null, [session]);
  const releases = useQuery(session ? () => loadAssignments() : null, [
    session,
  ]);
  const attempts = useQuery(
    learner ? () => loadSubmissionsForStudent(learner) : null,
    [learner],
  );
  const balance = useQuery(learner ? () => loadLateDayBalance(learner) : null, [
    learner,
  ]);

  const reads = [list, releases, attempts, balance];
  const failed = reads.find((read) => read.error);
  const refetch = () => {
    for (const read of reads) read.refetch();
  };
  const refetchDays = () => {
    list.refetch();
    balance.refetch();
  };

  const terms =
    list.data && balance.data
      ? lateDayTerms(list.data, balance.data.balance)
      : null;
  const rows =
    terms && list.data && releases.data && attempts.data
      ? lateDayRows({
          releases: releases.data.assignments,
          attempts: attempts.data.submissions,
          uses: list.data.uses,
          terms,
        })
      : null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Course"
        title="Late days"
        actions={
          balance.data && terms ? (
            <div className="flex items-center gap-1">
              <p className="font-display text-2xl font-semibold tabular-nums">
                {daysLeft(balance.data.balance)}
              </p>
              <InlineHelp label="Late day rules">
                {`One late day covers ${count(terms.unitHours, "hour")}. One assignment takes at most ${count(terms.perItemLimit, "late day")}.`}
              </InlineHelp>
            </div>
          ) : null
        }
      />
      {failed?.error ? (
        <ErrorState
          message={failed.error}
          refused={failed.refused}
          onRetry={refetch}
        />
      ) : !rows || !terms ? (
        <LoadingState label="Loading late days…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No assignments yet" />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <LateDayItem
              key={row.assignment}
              row={row}
              terms={terms}
              onMoved={refetchDays}
            />
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function LateDayItem({
  row,
  terms,
  onMoved,
}: {
  row: LateDayRow;
  terms: LateDayTerms;
  onMoved: () => void;
}) {
  const archived = row.title === null;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        {archived ? (
          <p className="font-medium text-muted-foreground">
            Archived assignment
          </p>
        ) : (
          <Link
            href={`/assignments/${row.assignment}`}
            className="font-medium break-words hover:underline"
          >
            {row.title}
          </Link>
        )}
        {!archived && (
          <Facts className="mt-1 text-sm text-muted-foreground">
            <Fact.Due verb="Due" at={row.dueAt} />
            {row.handedInAt === null ? (
              <span>Not handed in</span>
            ) : (
              <>
                <Fact.When
                  verb="Handed in"
                  form="absolute"
                  at={row.handedInAt}
                />
                <span>
                  {row.lateMs > 0 ? `${lateBy(row.lateMs)} late` : "On time"}
                </span>
              </>
            )}
          </Facts>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {!archived && (
          <CoverLateness
            row={row}
            terms={terms}
            onMoved={onMoved}
            className="sm:max-w-56"
          />
        )}
        {archived ? (
          <>
            <span className="text-sm tabular-nums">
              {count(row.days, "late day")}
            </span>
            <LateDayCancel row={row} onMoved={onMoved} />
          </>
        ) : (
          <LateDayStepper row={row} onMoved={onMoved} />
        )}
      </div>
    </li>
  );
}

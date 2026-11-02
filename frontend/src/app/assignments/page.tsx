"use client";

import { BookOpen, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Fact, Facts } from "@/components/facts";
import { Link } from "@/components/link";
import { StatusBadge } from "@/components/lms/status-badge";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/hooks/use-query";
import { assignmentTypeLabel } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import { type Assessment, assessmentForEvidence } from "@/lib/grading";
import { handedInAttempt, overdue } from "@/lib/late-days";
import {
  loadAssignments,
  loadGradesForMe,
  loadLateDaysList,
  loadRosterMe,
  loadSubmissionsForStudent,
} from "@/lib/lms";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "upcoming" | "submitted" | "overdue" | "graded";

export default function AssignmentsPage() {
  const { session, me } = useAuth();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const { data: rosterData } = useQuery<{ seat: unknown }>(
    session ? () => loadRosterMe() : null,
    [session],
  );

  const {
    data: asgnData,
    loading,
    error,
    refused,
    refetch,
  } = useQuery(session && rosterData?.seat ? () => loadAssignments() : null, [
    session,
    rosterData,
  ]);

  const { data: gradesData } = useQuery(
    session && rosterData?.seat ? () => loadGradesForMe() : null,
    [session, rosterData],
  );
  const { data: submissionsData } = useQuery(
    me && rosterData?.seat
      ? () => loadSubmissionsForStudent(String(me.user))
      : null,
    [me, rosterData],
  );
  const { data: lateDaysData } = useQuery(
    session && rosterData?.seat ? () => loadLateDaysList() : null,
    [session, rosterData],
  );

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "submitted", label: "Submitted" },
    { key: "overdue", label: "Overdue" },
    { key: "graded", label: "Graded" },
  ];

  const assignments = asgnData?.assignments ?? [];
  const grades = (gradesData?.grades ?? []) as Assessment[];
  const attempts = submissionsData?.submissions ?? [];
  const standingDays = new Map(
    (lateDaysData?.uses ?? [])
      .filter((use) => use.status === "APPLIED")
      .map((use) => [String(use.item), use.days]),
  );
  const now = new Date();

  const rows = assignments.map((a) => {
    const sub = handedInAttempt(
      attempts.filter((attempt) => attempt.assignment === a.assignment),
    );
    const grade = me
      ? assessmentForEvidence(
          grades,
          String(me.user),
          a.assignment,
          sub?.submission ?? "",
        )
      : undefined;
    const settled = grade?.status === "RELEASED" || grade?.status === "EXCUSED";
    const isOverdue =
      a.acceptsSubmissions &&
      !settled &&
      lateDaysData !== null &&
      overdue({
        handedIn: sub !== undefined,
        dueAt: a.dueAt,
        dueOverride: a.dueOverride,
        lateDays: standingDays.get(String(a.assignment)) ?? 0,
        unitHours: lateDaysData.unitHours,
        at: now,
      });
    return { a, sub, grade, settled, isOverdue };
  });

  const filtered = rows.filter(({ a, sub, grade, settled, isOverdue }) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !assignmentTypeLabel(a.kind).toLowerCase().includes(q)
      )
        return false;
    }

    if (filter === "all") return true;
    if (filter === "submitted") return !!sub;
    if (filter === "graded") return grade?.status === "RELEASED";
    if (filter === "upcoming") return !sub && !settled && !isOverdue;
    if (filter === "overdue") return isOverdue;
    return true;
  });

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading assignments…" />
      </PageContainer>
    );
  if (error)
    return (
      <PageContainer>
        <ErrorState message={error} refused={refused} onRetry={refetch} />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Course"
        title="Assignments"
        description="Your current assignments, submissions, and grades."
      />

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
          {search ? (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? `No assignments match “${search}”` : "No assignments"}
          description={
            search
              ? "Try another title or type, or clear the search."
              : filter !== "all"
                ? `No ${filter} assignments to show.`
                : "No assignments yet."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ a, sub, grade, isOverdue }) => {
            const due = a.dueOverride ?? a.dueAt;

            return (
              <Link
                key={a.assignment}
                href={`/assignments/${a.assignment}`}
                className={cn(
                  "flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors",
                  isOverdue && "border-destructive/30 bg-destructive/5",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{a.title}</p>
                    <Fact.Kind>{assignmentTypeLabel(a.kind)}</Fact.Kind>
                  </div>
                  <Facts className="mt-1 text-xs text-muted-foreground">
                    <Fact.Due verb="Due" at={due} />
                    {sub && (
                      <span className="text-muted-foreground">
                        Attempt #{sub.number}
                      </span>
                    )}
                    {grade && grade.status === "RELEASED" && (
                      <span>
                        <span className="text-muted-foreground">Grade</span>{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {grade.method === "POINTS" && grade.scored
                            ? `${grade.score} / ${grade.outOf}`
                            : "Assessment available"}
                        </span>
                      </span>
                    )}
                    {grade?.status === "EXCUSED" && <span>Excused</span>}
                  </Facts>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {grade ? <StatusBadge status={grade.status} /> : null}
                  {!grade && sub && <StatusBadge status="SUBMITTED" />}
                  {!grade && !sub && isOverdue && (
                    <Fact.Status status="OVERDUE" />
                  )}
                  {!grade && !sub && !isOverdue && (
                    <Fact.Status status="PENDING" />
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

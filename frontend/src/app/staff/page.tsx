"use client";

import {
  BookOpen,
  Clock,
  FileText,
  Radio,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { noun } from "@/lib/format";
import { loadStaffDashboard } from "@/lib/lms";

function StaffDashboardPageContent() {
  const { session, permissions } = useAuth();

  const {
    data: dashData,
    loading,
    error,
    refetch,
  } = useQuery(session ? () => loadStaffDashboard() : null, [session]);

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading staff dashboard…" />
      </PageContainer>
    );
  if (error)
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );

  const members = dashData?.dashboard ?? [];
  const students = members.filter((m) => m.kind === "STUDENT");
  const staff = members.filter((m) => m.kind === "STAFF");
  const auditors = members.filter((m) => m.kind === "AUDITOR");
  const counts = dashData?.counts ?? {
    assignments: 0,
    gradeItems: 0,
    lateDayUses: 0,
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Course dashboard"
        description="Overview of your course roster, assignments, and tasks."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Link
          href="/staff/roster"
          className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Students</p>
          </div>
          <p className="text-3xl font-semibold">{students.length}</p>
          <p className="text-xs text-muted-foreground mt-1">enrolled</p>
        </Link>

        <Link
          href="/staff/assignments"
          className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Assignments</p>
          </div>
          <p className="text-3xl font-semibold">{counts.assignments}</p>
          <p className="text-xs text-muted-foreground mt-1">total</p>
        </Link>

        <Link
          href="/staff/gradebook"
          className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Assessments</p>
          </div>
          <p className="text-3xl font-semibold">{counts.gradeItems}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {noun(counts.gradeItems, "item")}
          </p>
        </Link>

        <Link
          href="/staff/late-days"
          className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Late days</p>
          </div>
          <p className="text-3xl font-semibold">{counts.lateDayUses}</p>
          <p className="text-xs text-muted-foreground mt-1">
            active {noun(counts.lateDayUses, "use")}
          </p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" /> Roster summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Counts, not statuses: a figure in tabular numerals rather than
                a badge, so the only filled thing on a page stays a state. */}
            <dl className="space-y-2 text-sm">
              {[
                ["Students", students.length],
                ["Staff", staff.length],
                ["Auditors", auditors.length],
              ].map(([label, n]) => (
                <div className="flex justify-between" key={label}>
                  <dt>{label}</dt>
                  <dd className="tabular-nums text-muted-foreground">{n}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <dt>Total active</dt>
                <dd className="tabular-nums">{members.length}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="size-4" /> Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/staff/assignments"
              className="flex items-center gap-2 text-sm hover:text-primary"
            >
              <BookOpen className="size-4" /> Manage assignments
            </Link>
            <Link
              href="/staff/roster"
              className="flex items-center gap-2 text-sm hover:text-primary"
            >
              <Users className="size-4" /> Manage the roster and sections
            </Link>
            <Link
              href="/staff/gradebook"
              className="flex items-center gap-2 text-sm hover:text-primary"
            >
              <FileText className="size-4" /> Open assessments
            </Link>
            <Link
              href="/staff/late-days"
              className="flex items-center gap-2 text-sm hover:text-primary"
            >
              <Clock className="size-4" /> Manage late days
            </Link>
            <Link
              href="/staff/class"
              className="flex items-center gap-2 text-sm hover:text-primary"
            >
              <Settings className="size-4" /> Open class settings
            </Link>
            {permissions.can("live:host") ? (
              <Link
                href="/staff/live"
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                <Radio className="size-4" /> Run quizzes, surveys, and relays
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function StaffDashboardPage() {
  return (
    <RequireCapability capability="course:manage">
      <StaffDashboardPageContent />
    </RequireCapability>
  );
}

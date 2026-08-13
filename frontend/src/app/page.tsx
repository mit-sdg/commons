"use client";

import {
  BookOpen,
  Clock,
  GraduationCap,
  MessagesSquare,
  PenLine,
  StickyNote,
} from "lucide-react";
import { useCallback, useState } from "react";
import { CategoryDot } from "@/components/forum/badges";
import { TopicRow } from "@/components/forum/topic-row";
import { Link } from "@/components/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  loadAssignments,
  loadGradesForMe,
  loadLateDayBalance,
  loadRosterMe,
  loadVisibleNotes,
} from "@/lib/lms";
import { lmsNavigation } from "@/lib/lms-navigation";
import { loadFeed } from "@/lib/loaders";

function CategoriesCard() {
  const { data } = useQuery<{
    categories: { category: string; name: string; description?: string }[];
  }>(() => api.categories.list({}), []);
  const categories = data?.categories ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Categories</p>
        <Link
          href="/categories"
          className="text-xs font-medium text-primary hover:underline"
        >
          All
        </Link>
      </div>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {categories.slice(0, 8).map((c) => (
            <li key={String(c.category)}>
              <Link
                href={`/c/${c.category}`}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <CategoryDot id={String(c.category)} />
                <span className="truncate font-medium">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LmsDashboard({
  mayManageAssignments,
  permissionLoading,
}: {
  mayManageAssignments: boolean | undefined;
  permissionLoading: boolean;
}) {
  const { session, me } = useAuth();
  const { data: rosterData, loading: rosterLoading } = useQuery<{
    seat: unknown;
  }>(session ? () => loadRosterMe() : null, [session]);

  const learnerReady =
    Boolean(session && rosterData?.seat) && mayManageAssignments === false;

  const { data: assignmentsData } = useQuery(
    learnerReady && session ? () => loadAssignments() : null,
    [learnerReady, session],
  );

  const { data: gradesData } = useQuery(
    learnerReady && session ? () => loadGradesForMe() : null,
    [learnerReady, session],
  );

  const { data: notesData } = useQuery(
    learnerReady && session ? () => loadVisibleNotes() : null,
    [learnerReady, session],
  );

  const { data: lateBalance } = useQuery<{
    balance: { granted: number; used: number; remaining: number };
  }>(learnerReady && me ? () => loadLateDayBalance(String(me.user)) : null, [
    learnerReady,
    me,
  ]);

  const hasSeat = rosterData?.seat && !("error" in rosterData);

  if (rosterLoading || permissionLoading) return null;
  if (!hasSeat) return null;

  if (mayManageAssignments) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
          <GraduationCap className="size-5" /> Course Staff
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the roster, assignments, grades, and calendar from the staff
          pages.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/staff">Open staff dashboard</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/assignments">Assignments</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/gradebook">Gradebook</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/calendar">Calendar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const upcoming =
    assignmentsData?.assignments
      ?.filter((a) => a.status === "ASSIGNED")
      .slice(0, 5) ?? [];
  const released =
    gradesData?.grades?.filter((g) => g.status === "RELEASED").slice(0, 5) ??
    [];
  const unacknowledged =
    notesData?.notes?.filter((n) => !n.acknowledgedAt).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
              <GraduationCap className="size-5" /> My Class
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your assignments, grades, notes, and late-day balance.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/assignments">
                <BookOpen className="size-4" /> Assignments
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/grades">
                <GraduationCap className="size-4" /> Grades
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/assignments"
            className="rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
          >
            <p className="text-xs text-muted-foreground">Upcoming</p>
            <p className="text-2xl font-semibold">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">
              {upcoming.length === 1 ? "assignment due" : "assignments due"}
            </p>
          </Link>
          <Link
            href="/notes"
            className="rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
          >
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-2xl font-semibold">{unacknowledged}</p>
            <p className="text-xs text-muted-foreground">unacknowledged</p>
          </Link>
          <Link
            href="/grades"
            className="rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
          >
            <p className="text-xs text-muted-foreground">Grades</p>
            <p className="text-2xl font-semibold">{released.length}</p>
            <p className="text-xs text-muted-foreground">released</p>
          </Link>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Late Days</p>
            <p className="text-2xl font-semibold">
              {lateBalance?.balance?.remaining ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">remaining</p>
          </div>
        </div>
      </div>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" /> Upcoming Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((a) => (
                <Link
                  key={a.assignment}
                  href={`/assignments/${a.assignment}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{a.assignment}</span>
                  <Badge variant="secondary" className="text-xs">
                    DUE
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {released.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4" /> Recent Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {released.map((g) => (
                <div
                  key={g.grade}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {g.label || g.item}
                  </span>
                  <Badge>
                    {g.score} / {g.maxPoints}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {unacknowledged > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote className="size-4" /> Unacknowledged Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have {unacknowledged} unacknowledged{" "}
              {unacknowledged === 1 ? "note" : "notes"}.{" "}
              <Link href="/notes" className="text-primary hover:underline">
                View them
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function HomePage() {
  const [sort, setSort] = useState<"latest" | "activity">("latest");
  const {
    data,
    loading: feedLoading,
    error: feedError,
    refetch,
  } = useQuery(
    useCallback(() => loadFeed(sort), [sort]),
    [sort],
  );
  const { me } = useAuth();

  const { data: staffPermission, loading: staffPermissionLoading } = useQuery<{
    allowed: boolean;
  }>(
    me
      ? () =>
          api.roles.can({
            user: String(me.user),
            context: "forum",
            capability: "assignments:manage",
          })
      : null,
    [me],
  );

  const showLms = me !== null;
  const quickLinks = lmsNavigation(Boolean(staffPermission?.allowed));

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_18rem] lg:py-10">
      <section className="min-w-0">
        {showLms && (
          <div className="mb-8">
            <LmsDashboard
              mayManageAssignments={staffPermission?.allowed}
              permissionLoading={staffPermissionLoading}
            />
          </div>
        )}

        <div className="mb-5 flex items-end justify-between border-b border-border pb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Conversations
            </h1>
            <div className="mt-2 inline-flex rounded-lg border bg-card p-0.5 shadow-xs">
              <button
                type="button"
                aria-pressed={sort === "latest"}
                className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all ${
                  sort === "latest"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSort("latest")}
              >
                Latest
              </button>
              <button
                type="button"
                aria-pressed={sort === "activity"}
                className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all ${
                  sort === "activity"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSort("activity")}
              >
                Activity
              </button>
            </div>
          </div>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/new">
              <PenLine className="size-4" /> New topic
            </Link>
          </Button>
        </div>

        {feedLoading && !data ? (
          <LoadingState label="Gathering the latest…" />
        ) : feedError ? (
          <ErrorState message={feedError} onRetry={refetch} />
        ) : data && data.length > 0 ? (
          <div className="-mx-3">
            {data.map((summary, i) => (
              <TopicRow
                key={String(summary.conversation)}
                summary={summary}
                index={i}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description="Start the first conversation for this class."
            action={
              <Button asChild size="sm">
                <Link href="/new">Start a topic</Link>
              </Button>
            }
          />
        )}
      </section>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <CategoriesCard />
        {showLms && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="eyebrow">Quick Links</p>
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                <item.icon className="size-4" /> {item.label}
              </Link>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

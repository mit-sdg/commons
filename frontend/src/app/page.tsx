"use client";

import {
  BookOpen,
  GraduationCap,
  MessagesSquare,
  PenLine,
  StickyNote,
} from "lucide-react";
import { useCallback, useState } from "react";
import { AudienceFilter } from "@/components/forum/audience-picker";
import { CategoryDot } from "@/components/forum/badges";
import { TopicList } from "@/components/forum/topic-list";
import { Link } from "@/components/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { matchesDiscussionAudience } from "@/lib/discussion-filters";
import {
  loadAssignments,
  loadGradesForMe,
  loadLateDayBalance,
  loadRosterMe,
  loadVisibleNotes,
} from "@/lib/lms";
import { loadFeedIndex } from "@/lib/loaders";
import { SELF_ADD_HREF } from "@/lib/roster-people";

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

function LmsDashboard({ isStaff }: { isStaff: boolean }) {
  const { session, me, permissions } = useAuth();
  const canManageCourse = permissions.can("course:manage");
  const { data: rosterData, loading: rosterLoading } = useQuery<{
    seat: unknown;
  }>(session ? () => loadRosterMe() : null, [session]);
  const learnerReady = Boolean(session && rosterData?.seat) && !isStaff;

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

  if (rosterLoading) return null;
  if (!hasSeat) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">
              You are not enrolled in this course
            </h2>
            {canManageCourse ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add yourself to the course roster. Review your details before
                  confirming.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href={SELF_ADD_HREF}>Add yourself to the roster</Link>
                </Button>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Ask course staff to add you. Once they do, your assignments,
                grades, and course tools show up here.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
          <GraduationCap className="size-5" /> Course staff
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the roster, assignments, assessments, and calendar from the
          staff pages.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/staff">Open staff dashboard</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/assignments">Assignments</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/gradebook">Assessments</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/staff/calendar">Calendar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const assigned =
    assignmentsData?.assignments?.filter((a) => a.status === "ASSIGNED") ?? [];
  const released =
    gradesData?.grades?.filter((g) => g.status === "RELEASED") ?? [];
  const unacknowledged =
    notesData?.notes?.filter((n) => !n.acknowledgedAt).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
              <GraduationCap className="size-5" /> Course overview
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your assignments, assessments, notes, and late-day balance.
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
                <GraduationCap className="size-4" /> Assessments
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/assignments"
            className="rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
          >
            <p className="text-xs text-muted-foreground">Assignments</p>
            <p className="text-2xl font-semibold">{assigned.length}</p>
            <p className="text-xs text-muted-foreground">assigned to you</p>
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
            <p className="text-xs text-muted-foreground">Assessments</p>
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
  const { me, permissions } = useAuth();
  const [recipientSelection, setRecipientSelection] = useState({
    user: me?.user,
    holder: "",
  });
  const addressedTo =
    recipientSelection.user === me?.user ? recipientSelection.holder : "";
  const selectRecipient = (holder: string) =>
    setRecipientSelection({ user: me?.user, holder });
  const [sort, setSort] = useState<"latest" | "activity">("latest");
  const [audienceFilter, setAudienceFilter] = useState<
    "all" | "everyone" | "private" | "staff"
  >("all");
  const {
    data,
    loading: feedLoading,
    error: feedError,
    refetch,
  } = useQuery(
    useCallback(() => loadFeedIndex(sort), [sort]),
    [sort, me?.user],
  );

  const addressable = useQuery(
    me ? async () => unwrap(await api.audiences.options({})) : null,
    [me?.user],
  );
  const showLms = me !== null;
  const recipients = [
    ...new Map(
      [
        ...(data ?? []).flatMap((conversation) => conversation.audience),
        ...(addressable.data?.holders ?? []).filter(
          (holder) => holder.kind === "group",
        ),
      ].map((holder) => [holder.holder, holder]),
    ).values(),
  ].sort(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      a.kind.localeCompare(b.kind) ||
      a.holder.localeCompare(b.holder),
  );
  const visible = data?.filter((conversation) =>
    matchesDiscussionAudience(
      conversation.audience,
      audienceFilter,
      addressedTo,
    ),
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_18rem] lg:py-10">
      <section className="min-w-0">
        {showLms && (
          <div className="mb-8">
            <LmsDashboard isStaff={permissions.isStaff} />
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Discussions
            </h1>
            <div className="mt-2 inline-flex rounded-lg border bg-card p-0.5 shadow-xs">
              <button
                type="button"
                aria-pressed={sort === "latest"}
                className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  sort === "latest"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSort("latest")}
              >
                Newest topics
              </button>
              <button
                type="button"
                aria-pressed={sort === "activity"}
                className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  sort === "activity"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSort("activity")}
              >
                Recent activity
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button asChild size="sm" variant="outline">
              <Link href="/new?audience=staff">Ask staff privately</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/new">
                <PenLine className="size-4" /> New discussion
              </Link>
            </Button>
          </div>
        </div>

        <div
          aria-label="Discussion audience filters"
          className="mb-4 flex flex-wrap gap-2"
        >
          {(["all", "everyone", "private", "staff"] as const).map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={audienceFilter === filter ? "default" : "outline"}
              aria-pressed={audienceFilter === filter}
              onClick={() => {
                setAudienceFilter(filter as typeof audienceFilter);
                if (filter === "staff") setSort("activity");
              }}
            >
              {
                (
                  {
                    all: "All",
                    everyone: "Course-wide",
                    private: "Private",
                    staff: "To Staff",
                  } as Record<string, string>
                )[filter]
              }
            </Button>
          ))}
          <AudienceFilter
            options={recipients}
            value={addressedTo}
            onChange={selectRecipient}
          />
        </div>

        {feedLoading && !data ? (
          <LoadingState label="Gathering the latest…" />
        ) : feedError ? (
          <ErrorState message={feedError} onRetry={refetch} />
        ) : visible && visible.length > 0 ? (
          <TopicList
            key={JSON.stringify([me?.user, sort, audienceFilter, addressedTo])}
            conversations={visible.map((row) => String(row.conversation))}
          />
        ) : addressedTo || audienceFilter !== "all" ? (
          <EmptyState
            icon={MessagesSquare}
            title="No discussions match these filters"
            description="Only discussions you can read appear here."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  selectRecipient("");
                  setAudienceFilter("all");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="No discussions yet"
            description="Start the first discussion for this course."
            action={
              <Button asChild size="sm">
                <Link href="/new">Start a discussion</Link>
              </Button>
            }
          />
        )}
      </section>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <CategoriesCard />
      </aside>
    </div>
  );
}

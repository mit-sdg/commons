"use client";

import {
  BookOpen,
  GraduationCap,
  MessagesSquare,
  PenLine,
  Search,
  Star,
  StickyNote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudienceFilter } from "@/components/forum/audience-picker";
import { CategoryDot } from "@/components/forum/badges";
import { TopicList } from "@/components/forum/topic-list";
import { Link } from "@/components/link";
import { PageTitle } from "@/components/page-title";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { matchesDiscussionAudience } from "@/lib/discussion-filters";
import { pinnedFirst, useDiscussionMarks } from "@/lib/discussion-marks";
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
            <Link href="/staff/gradebook">Course grades</Link>
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
    gradesData?.grades?.filter((grade) => grade.status === "RELEASED").length ??
    0;
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
            <p className="text-xs text-muted-foreground">Grades</p>
            <p className="text-2xl font-semibold">{released}</p>
            <p className="text-xs text-muted-foreground">released</p>
          </Link>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Late days</p>
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
              <StickyNote className="size-4" /> Unacknowledged notes
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

/** Shorter text matches nearly every post and finds nothing useful. */
const SEARCH_MIN_LENGTH = 2;

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
  const [starredOnly, setStarredOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearchText(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const { pinned, starred } = useDiscussionMarks();
  // The server answers only discussions this reader may read; the list then
  // keeps its own order and filters over them.
  const searching = searchText.length >= SEARCH_MIN_LENGTH;
  const tooShort =
    searchInput.trim().length > 0 &&
    searchInput.trim().length < SEARCH_MIN_LENGTH;
  const search = useQuery(
    me && searching
      ? async () =>
          new Set(
            unwrap(
              await api.discussions.search({ text: searchText }),
            ).matches.map((row) => String(row.conversation)),
          )
      : null,
    [me?.user, searchText],
  );
  const {
    data,
    loading: feedLoading,
    error: feedError,
    refetch,
  } = useQuery(
    useCallback(() => loadFeedIndex(sort), [sort]),
    [sort, me?.user],
  );

  // A match the loaded list lacks was posted since the list loaded.
  const reloadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!search.data || !data || reloadedFor.current === searchText) return;
    const listed = new Set(data.map((row) => String(row.conversation)));
    if ([...search.data].some((conversation) => !listed.has(conversation))) {
      reloadedFor.current = searchText;
      refetch();
    }
  }, [search.data, data, searchText, refetch]);

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
  const visible = data?.filter(
    (conversation) =>
      matchesDiscussionAudience(
        conversation.audience,
        audienceFilter,
        addressedTo,
      ) &&
      (!starredOnly || starred.has(String(conversation.conversation))) &&
      (!searching ||
        (search.data?.has(String(conversation.conversation)) ?? false)),
  );
  const shown = visible
    ? pinnedFirst(
        visible.map((row) => String(row.conversation)),
        pinned,
      )
    : undefined;
  const narrowed =
    Boolean(addressedTo) || audienceFilter !== "all" || starredOnly;
  const filtered = narrowed || searching;
  const matchCount = search.data?.size ?? 0;
  const emptyTitle = searching
    ? matchCount > 0 && narrowed
      ? matchCount === 1
        ? "Your filters hide the 1 match"
        : `Your filters hide all ${matchCount} matches`
      : "No discussions match your search"
    : starredOnly
      ? "No starred discussions"
      : "No discussions match these filters";
  const resetFilters = () => {
    selectRecipient("");
    setAudienceFilter("all");
    setStarredOnly(false);
    setSearchInput("");
    setSearchText("");
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_18rem] lg:py-10">
      <PageTitle parts={["Discussions"]} />
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

        {me ? (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSearchText(searchInput.trim());
                if (event.key === "Escape") {
                  setSearchInput("");
                  setSearchText("");
                }
              }}
              placeholder="Search discussions and replies"
              aria-label="Search discussions"
              maxLength={200}
              enterKeyHint="search"
              className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchInput ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchInput("");
                  setSearchText("");
                }}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}

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
          {me ? (
            <Button
              size="sm"
              variant={starredOnly ? "default" : "outline"}
              aria-pressed={starredOnly}
              className="gap-1.5"
              onClick={() => setStarredOnly((value) => !value)}
            >
              <Star
                className={starredOnly ? "size-4 fill-current" : "size-4"}
              />
              Starred
            </Button>
          ) : null}
          <AudienceFilter
            options={recipients}
            value={addressedTo}
            onChange={selectRecipient}
          />
        </div>

        {tooShort ? (
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            Type at least {SEARCH_MIN_LENGTH} characters to search.
          </p>
        ) : searching && search.data && shown && shown.length > 0 ? (
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {shown.length === 1
              ? "1 discussion matches"
              : `${shown.length} discussions match`}{" "}
            “{searchText}”
          </p>
        ) : null}

        {(feedLoading && !data) ||
        (searching && search.loading && !search.data) ||
        (searching && feedLoading && matchCount > 0 && shown?.length === 0) ? (
          <LoadingState
            label={searching ? "Searching…" : "Gathering the latest…"}
          />
        ) : feedError ? (
          <ErrorState message={feedError} onRetry={refetch} />
        ) : searching && search.error ? (
          <ErrorState message={search.error} onRetry={search.refetch} />
        ) : shown && shown.length > 0 ? (
          <TopicList
            key={JSON.stringify([
              me?.user,
              sort,
              audienceFilter,
              addressedTo,
              starredOnly,
              searchText,
              pinned,
            ])}
            conversations={shown}
          />
        ) : filtered ? (
          <EmptyState
            icon={starredOnly && !searching ? Star : MessagesSquare}
            title={emptyTitle}
            description={
              starredOnly && !searching
                ? "Star a discussion to find it here. Only you see your stars."
                : "Only discussions you can read appear here."
            }
            action={
              <Button variant="outline" onClick={resetFilters}>
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

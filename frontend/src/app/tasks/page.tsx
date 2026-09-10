"use client";
import { CalendarClock, ListChecks, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ExpandAllDetails } from "@/components/tasks/expand-all-details";
import { NewTaskDialog } from "@/components/tasks/new-task";
import { TaskCard } from "@/components/tasks/task-card";
import { useExpandedTasks } from "@/hooks/use-expanded-tasks";
import { useQuery } from "@/hooks/use-query";
import { api, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import type { TaskList } from "@/lib/models";
import { loadMyLists, loadMyTasks } from "@/lib/tasks";

function Tasks() {
  const { me, session } = useAuth();
  const viewer = me ? String(me.user) : "";

  const lists = useQuery<TaskList[]>(session ? loadMyLists : null, [session]);
  const tasks = useQuery(
    session
      ? async () => {
          const [assigned, personal] = await Promise.all([
            loadMyTasks(),
            api.tasks.personal({}).then(unwrap),
          ]);
          return [
            ...assigned.map((task) => ({ ...task, assignee: viewer })),
            ...personal.tasks.map((task) => ({
              ...task,
              list: viewer,
              listTitle: "Personal",
            })),
          ];
        }
      : null,
    [session, viewer],
  );

  function refreshAll() {
    lists.refetch();
    tasks.refetch();
  }

  const allTasks = useMemo(() => tasks.data ?? [], [tasks.data]);
  const [now] = useState(() => Date.now());
  const expandable = useMemo(
    () =>
      allTasks
        .filter((task) => task.details?.trim())
        .map((task) => String(task.task)),
    [allTasks],
  );
  const details = useExpandedTasks(expandable);

  const openTasks = allTasks.filter((task) => task.state === "OPEN");
  const activeAndOverdue = openTasks
    .filter((task) => new Date(task.startsAt as string).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(a.endsAt as string).getTime() -
        new Date(b.endsAt as string).getTime(),
    );

  const upcoming = openTasks
    .filter((task) => new Date(task.startsAt as string).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.endsAt as string).getTime() -
        new Date(b.endsAt as string).getTime(),
    );

  const settled = allTasks
    .filter((task) => task.state !== "OPEN")
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? (b.createdAt as string)).getTime() -
        new Date(a.updatedAt ?? (a.createdAt as string)).getTime(),
    );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Your work"
        title="Tasks"
        description="Your personal tasks and work assigned to you in groups."
        actions={
          me ? (
            <NewTaskDialog
              scope={viewer}
              scopeLabel="Personal"
              groups={lists.data ?? []}
              onCreated={refreshAll}
            />
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-6" aria-label="Assigned to me">
          {tasks.loading && !tasks.data ? (
            <LoadingState />
          ) : tasks.error ? (
            <ErrorState message={tasks.error} onRetry={tasks.refetch} />
          ) : allTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Add a personal task or open a group to work together."
            />
          ) : (
            <>
              <ExpandAllDetails details={details} />

              {activeAndOverdue.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Active &amp; Overdue ({activeAndOverdue.length})
                  </h2>
                  {activeAndOverdue.map((task) => (
                    <TaskCard
                      key={String(task.task)}
                      expanded={details.isExpanded(String(task.task))}
                      onToggleExpanded={() => details.toggle(String(task.task))}
                      task={task}
                      personal={task.list === viewer}
                      viewer={viewer}
                      onChanged={refreshAll}
                      context={
                        <Link
                          href={
                            task.list === viewer
                              ? "/tasks"
                              : `/groups/${String(task.list)}?view=tasks`
                          }
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {task.listTitle || "Group"}
                        </Link>
                      }
                    />
                  ))}
                </div>
              ) : null}

              {upcoming.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <CalendarClock className="size-4" />
                    Upcoming ({upcoming.length})
                  </h2>
                  {upcoming.map((task) => (
                    <TaskCard
                      key={String(task.task)}
                      expanded={details.isExpanded(String(task.task))}
                      onToggleExpanded={() => details.toggle(String(task.task))}
                      task={task}
                      personal={task.list === viewer}
                      viewer={viewer}
                      onChanged={refreshAll}
                      context={
                        <Link
                          href={
                            task.list === viewer
                              ? "/tasks"
                              : `/groups/${String(task.list)}?view=tasks`
                          }
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {task.listTitle || "Group"}
                        </Link>
                      }
                    />
                  ))}
                </div>
              ) : null}

              {activeAndOverdue.length === 0 && upcoming.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No open tasks assigned to you"
                  description="All your assigned tasks are completed or canceled."
                />
              ) : null}

              {settled.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Finished and canceled ({settled.length})
                  </h2>
                  {settled.map((task) => (
                    <TaskCard
                      key={String(task.task)}
                      expanded={details.isExpanded(String(task.task))}
                      onToggleExpanded={() => details.toggle(String(task.task))}
                      task={task}
                      personal={task.list === viewer}
                      viewer={viewer}
                      onChanged={refreshAll}
                      context={
                        <Link
                          href={
                            task.list === viewer
                              ? "/tasks"
                              : `/groups/${String(task.list)}?view=tasks`
                          }
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {task.listTitle || "Group"}
                        </Link>
                      }
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">Your groups</h2>
            <Link href="/groups" className="text-sm text-primary">
              View all
            </Link>
          </div>
          {lists.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not in any group yet.
            </p>
          ) : null}
          {lists.data?.map((group) => (
            <Link
              key={group.list}
              href={`/groups/${group.list}?view=tasks`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Users className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {group.title || "Untitled group"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {count(group.openTasks ?? 0, "open task")}
                </span>
              </span>
            </Link>
          ))}
        </aside>
      </div>
    </PageContainer>
  );
}

export default function TasksPage() {
  return (
    <RequireAuth>
      <Tasks />
    </RequireAuth>
  );
}

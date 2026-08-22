"use client";

import { CalendarClock, ListChecks, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ExpandAllDetails } from "@/components/tasks/expand-all-details";
import {
  MemberPicker,
  type PickedMember,
} from "@/components/tasks/member-picker";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExpandedTasks } from "@/hooks/use-expanded-tasks";
import { useQuery } from "@/hooks/use-query";
import { CommonsError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import type { AssignedTask, TaskList } from "@/lib/models";
import { createTaskList, loadMyLists, loadMyTasks } from "@/lib/tasks";

function NewListDialog({
  me,
  myName,
  onOpened,
}: {
  me: string;
  myName: string;
  onOpened: (list: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);
  const members = [{ user: me, displayName: myName }, ...chosen];

  async function create() {
    setBusy(true);
    try {
      const list = await createTaskList(
        title.trim(),
        chosen.map((member) => member.user),
      );
      setOpen(false);
      setTitle("");
      setChosen([]);
      toast.success("Task list created");
      onOpened(list);
    } catch (error) {
      toast.error(
        error instanceof CommonsError
          ? error.message
          : "The list could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" /> New list
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a task list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-list-title">Title (optional)</Label>
            <Input
              id="new-list-title"
              value={title}
              disabled={busy}
              placeholder="e.g. Team project"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <MemberPicker
            chosen={members}
            fixed={me}
            disabled={busy}
            onChange={(next) =>
              setChosen(next.filter((member) => member.user !== me))
            }
          />
          <p className="text-xs text-muted-foreground">
            You will be added as a member. You can add more members now or
            later.
          </p>
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => void create()}>
            {busy ? "Creating…" : "Create list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListRow({ list }: { list: TaskList }) {
  const id = String(list.list);
  const members = list.members ?? [];
  return (
    <Link
      href={`/tasks/${id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {list.title ||
            members
              .map((member) => member.displayName)
              .join(", ")
              .slice(0, 80) ||
            "Untitled list"}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {members.length === 1
            ? "Just you"
            : members.map((member) => member.displayName).join(", ")}
        </p>
      </div>
      <span className="shrink-0 text-sm text-muted-foreground">
        {count(list.openTasks ?? 0, "open task")}
      </span>
    </Link>
  );
}

function Tasks() {
  const { me, session } = useAuth();
  const router = useRouter();
  const viewer = me ? String(me.user) : "";

  const lists = useQuery<TaskList[]>(session ? loadMyLists : null, [session]);
  const tasks = useQuery<AssignedTask[]>(session ? loadMyTasks : null, [
    session,
  ]);

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
        description="Everything assigned to you, across every list you belong to."
        actions={
          me ? (
            <NewListDialog
              me={viewer}
              myName={me.profile.displayName}
              onOpened={(list) => router.push(`/tasks/${list}`)}
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
              title="Nothing is assigned to you"
              description="Create or open a list, add a task, and take it — or collaborate with team members in a shared list."
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
                      task={{ ...task, assignee: viewer }}
                      viewer={viewer}
                      onChanged={refreshAll}
                      context={
                        <Link
                          href={`/tasks/${String(task.list)}`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {task.listTitle || "Task list"}
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
                      task={{ ...task, assignee: viewer }}
                      viewer={viewer}
                      onChanged={refreshAll}
                      context={
                        <Link
                          href={`/tasks/${String(task.list)}`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {task.listTitle || "Task list"}
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
                      task={{ ...task, assignee: viewer }}
                      viewer={viewer}
                      onChanged={refreshAll}
                      context={
                        <Link
                          href={`/tasks/${String(task.list)}`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {task.listTitle || "Task list"}
                        </Link>
                      }
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="space-y-3" aria-label="Your task lists">
          <h2 className="eyebrow">Your lists</h2>
          {lists.loading && !lists.data ? (
            <LoadingState />
          ) : lists.error ? (
            <ErrorState message={lists.error} onRetry={lists.refetch} />
          ) : (lists.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              You do not belong to a task list yet.
            </p>
          ) : (
            (lists.data ?? []).map((list) => (
              <ListRow key={String(list.list)} list={list} />
            ))
          )}
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

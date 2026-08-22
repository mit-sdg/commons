"use client";

import {
  ArrowLeft,
  CalendarClock,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  MemberPicker,
  type PickedMember,
} from "@/components/tasks/member-picker";
import { TaskCard } from "@/components/tasks/task-card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TaskListPage } from "@/lib/models";
import { defaultWindow, fromLocalInput, loadTaskListPage } from "@/lib/tasks";

interface Member {
  user: string;
  displayName: string;
}

function RenameListDialog({
  list,
  currentTitle,
  onRenamed,
}: {
  list: string;
  currentTitle: string;
  onRenamed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [busy, setBusy] = useState(false);

  async function rename() {
    if (title.trim() === "") {
      toast.error("List title cannot be empty.");
      return;
    }
    setBusy(true);
    const result = await api.tasklists.rename({
      list,
      title: title.trim(),
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    toast.success("List renamed");
    setOpen(false);
    onRenamed();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Rename list"
          onClick={() => setTitle(currentTitle)}
        >
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename task list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-list-title">New title</Label>
            <Input
              id="rename-list-title"
              value={title}
              disabled={busy}
              placeholder="e.g. Sprint 1 Tasks"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void rename();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void rename()}>
            {busy ? "Saving…" : "Save title"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({
  list,
  members,
  onChanged,
}: {
  list: string;
  members: Member[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);

  async function addMembers() {
    if (chosen.length === 0) return;
    setBusy(true);
    let successCount = 0;
    for (const candidate of chosen) {
      const result = await api.tasklists["add-member"]({
        list,
        candidate: candidate.user,
      });
      if ("error" in result) {
        toast.error(publicErrorMessage(result.error));
      } else {
        successCount++;
      }
    }
    setBusy(false);
    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Member added to list"
          : `${successCount} members added to list`,
      );
      setChosen([]);
      setOpen(false);
      onChanged();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="size-4" /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members to this list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <MemberPicker
            chosen={chosen}
            disabled={busy}
            label="Search and select members"
            onChange={(next) =>
              setChosen(
                next.filter(
                  (entry) =>
                    !members.some((member) => member.user === entry.user),
                ),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            All members have equal authority to create, edit, assign, and manage
            tasks.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || chosen.length === 0}
            onClick={() => void addMembers()}
          >
            {busy ? "Adding…" : "Add to list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskForm({
  list,
  onCreated,
}: {
  list: string;
  onCreated: () => void;
}) {
  const initial = defaultWindow();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [busy, setBusy] = useState(false);

  async function create() {
    const start = fromLocalInput(startsAt);
    const end = fromLocalInput(endsAt);
    if (title.trim() === "" || !start || !end) {
      toast.error("A task needs a title, a start time, and an end time.");
      return;
    }
    setBusy(true);
    const result = await api.tasks.create({
      list,
      title: title.trim(),
      details: details.trim(),
      startsAt: start,
      endsAt: end,
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(
        result.error === "INVALID_REQUEST"
          ? "A task cannot end before it begins."
          : publicErrorMessage(result.error),
      );
      return;
    }
    toast.success("Task added");
    setTitle("");
    setDetails("");
    const next = defaultWindow();
    setStartsAt(next.startsAt);
    setEndsAt(next.endsAt);
    onCreated();
  }

  return (
    <section
      aria-label="Add a task"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          disabled={busy}
          placeholder="e.g. Draft report, or Review pull request"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-details">Details (Markdown supported)</Label>
        <Textarea
          id="task-details"
          value={details}
          disabled={busy}
          rows={2}
          placeholder="Optional notes, checklist, or instructions..."
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="task-starts">Starts</Label>
          <Input
            id="task-starts"
            type="datetime-local"
            value={startsAt}
            disabled={busy}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-ends">Ends (the deadline)</Label>
          <Input
            id="task-ends"
            type="datetime-local"
            value={endsAt}
            disabled={busy}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() => void create()}
          className="gap-1.5"
        >
          <Plus className="size-4" /> Add task
        </Button>
      </div>
    </section>
  );
}

function TaskListView() {
  const params = useParams<{ list: string }>();
  const list = String(params.list);
  const router = useRouter();
  const { me, session } = useAuth();
  const viewer = me ? String(me.user) : "";

  const page = useQuery<TaskListPage>(
    session ? () => loadTaskListPage(list) : null,
    [session, list],
  );

  const detail = page.data?.list ?? null;
  const roster: Member[] = (detail?.members ?? []).map((member) => ({
    user: String(member.user),
    displayName: member.displayName,
  }));

  async function leave() {
    const result = await api.tasklists.leave({ list });
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "Cannot leave as the last member of the list."
          : publicErrorMessage(result.error),
      );
      return;
    }
    toast.success("You left the list");
    router.push("/tasks");
  }

  async function removeMember(targetUser: string, targetName: string) {
    const result = await api.tasklists["remove-member"]({
      list,
      target: targetUser,
    });
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "Cannot remove the only member from the list."
          : publicErrorMessage(result.error),
      );
      return;
    }
    toast.success(`${targetName} removed from list`);
    page.refetch();
  }

  const allTasks = page.data?.tasks ?? [];
  const [now] = useState(() => Date.now());

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
        eyebrow={
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> All tasks
          </Link>
        }
        title={
          <div className="flex items-center gap-2">
            <span>
              {detail?.title ||
                (roster.length === 1
                  ? "My tasks"
                  : roster.map((member) => member.displayName).join(", ")) ||
                "Task list"}
            </span>
            {detail ? (
              <RenameListDialog
                list={list}
                currentTitle={detail.title || ""}
                onRenamed={page.refetch}
              />
            ) : null}
          </div>
        }
        description={
          roster.length > 1
            ? "Every member holds equal power over this list and its tasks."
            : "Your personal task list. Add members to collaborate."
        }
        actions={
          detail ? (
            <>
              <AddMemberDialog
                list={list}
                members={roster}
                onChanged={page.refetch}
              />
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <LogOut className="size-4" /> Leave
                  </Button>
                }
                title="Leave this list?"
                description="Its tasks will stop appearing in your assigned tasks list, and any open tasks you hold will be released."
                confirmLabel="Leave"
                destructive
                onConfirm={leave}
              />
            </>
          ) : null
        }
      />

      {page.loading && !page.data ? (
        <LoadingState />
      ) : page.error ? (
        <ErrorState message={page.error} onRetry={page.refetch} />
      ) : !detail ? (
        <EmptyState
          icon={ListChecks}
          title="This list is not available"
          description="You may not be a member of this list or it does not exist."
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members:
            </span>
            {roster.map((member) => (
              <Badge
                key={member.user}
                variant="secondary"
                className="gap-1.5 py-1 pr-1.5 pl-2.5 text-xs"
              >
                <span>{member.displayName}</span>
                {member.user === viewer ? (
                  <span className="text-muted-foreground">(you)</span>
                ) : (
                  <ConfirmAction
                    trigger={
                      <button
                        type="button"
                        aria-label={`Remove ${member.displayName}`}
                        className="rounded-full text-muted-foreground hover:text-destructive"
                      >
                        <UserMinus className="size-3" />
                      </button>
                    }
                    title={`Remove ${member.displayName}?`}
                    description={`Remove ${member.displayName} from this list? Any open tasks assigned to them will be released.`}
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() =>
                      removeMember(member.user, member.displayName)
                    }
                  />
                )}
              </Badge>
            ))}
          </div>

          <NewTaskForm list={list} onCreated={page.refetch} />

          {allTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks here yet"
              description="Add one above. Set its start and deadline to organize upcoming work."
            />
          ) : (
            <div className="space-y-6">
              {activeAndOverdue.length > 0 ? (
                <section className="space-y-3" aria-label="Active and overdue">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Active &amp; Overdue ({activeAndOverdue.length})
                  </h2>
                  {activeAndOverdue.map((task) => (
                    <TaskCard
                      key={String(task.task)}
                      task={task}
                      members={roster}
                      viewer={viewer}
                      onChanged={page.refetch}
                    />
                  ))}
                </section>
              ) : null}

              {upcoming.length > 0 ? (
                <section className="space-y-3" aria-label="Upcoming tasks">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <CalendarClock className="size-4" />
                    Upcoming ({upcoming.length})
                  </h2>
                  {upcoming.map((task) => (
                    <TaskCard
                      key={String(task.task)}
                      task={task}
                      members={roster}
                      viewer={viewer}
                      onChanged={page.refetch}
                    />
                  ))}
                </section>
              ) : null}

              {activeAndOverdue.length === 0 && upcoming.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No open tasks"
                  description="All tasks in this list are completed or canceled."
                />
              ) : null}

              {settled.length > 0 ? (
                <section className="space-y-3 pt-2" aria-label="Settled tasks">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Finished and canceled ({settled.length})
                  </h2>
                  {settled.map((task) => (
                    <TaskCard
                      key={String(task.task)}
                      task={task}
                      members={roster}
                      viewer={viewer}
                      onChanged={page.refetch}
                    />
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

export default function TaskListPageRoute() {
  return (
    <RequireAuth>
      <TaskListView />
    </RequireAuth>
  );
}

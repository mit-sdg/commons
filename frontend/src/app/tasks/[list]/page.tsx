"use client";

import { ArrowLeft, ListChecks, LogOut, Plus, UserPlus } from "lucide-react";
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
import { api, CommonsError, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TaskListPage } from "@/lib/models";
import {
  defaultWindow,
  fromLocalInput,
  loadTaskListPage,
  openTaskList,
} from "@/lib/tasks";

interface Member {
  user: string;
  displayName: string;
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);
  const enlarged = [...members, ...chosen];

  async function takeListAlong() {
    setBusy(true);
    const result = await api.tasklists.extend({
      list,
      members: enlarged.map((member) => member.user),
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "Another list already holds exactly those people. Start a separate list to reach it."
          : publicErrorMessage(result.error),
      );
      return;
    }
    toast.success("The list now covers everyone, with its tasks");
    setChosen([]);
    setOpen(false);
    onChanged();
  }

  async function startSeparate() {
    setBusy(true);
    try {
      const next = await openTaskList(enlarged.map((member) => member.user));
      setChosen([]);
      setOpen(false);
      router.push(`/tasks/${next}`);
    } catch (error) {
      toast.error(
        error instanceof CommonsError
          ? error.message
          : "The separate list could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="size-4" /> Add someone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add someone to this list</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <MemberPicker
            chosen={enlarged}
            disabled={busy}
            label="This list will be for"
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
            Taking this list along keeps the tasks already in it. Starting a
            separate list leaves them here.
          </p>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            disabled={busy || chosen.length === 0}
            onClick={() => void startSeparate()}
          >
            Start a separate list
          </Button>
          <Button
            disabled={busy || chosen.length === 0}
            onClick={() => void takeListAlong()}
          >
            Take this list along
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
      toast.error("A task needs a title, a start, and an end.");
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
          placeholder="e.g. Office hours, or Draft the report"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-details">Details (optional)</Label>
        <Textarea
          id="task-details"
          value={details}
          disabled={busy}
          rows={2}
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
  const present = new Set(
    (detail?.present ?? []).map((row) => String(row.user)),
  );
  const assignable = roster.filter((member) => present.has(member.user));

  async function leave() {
    const result = await api.tasklists.leave({ list });
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    toast.success("You left the list");
    router.push("/tasks");
  }

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
          detail?.title ||
          (roster.length === 1
            ? "My tasks"
            : roster.map((member) => member.displayName).join(", ")) ||
          "Task list"
        }
        description={
          roster.length > 1
            ? "Every member holds the same powers over these tasks."
            : "Your own tasks are the list whose only member is you."
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
                description="Its tasks stop appearing among yours, and any open task you hold is released. The list keeps everything else."
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
          description="It may have been opened for a different set of people."
        />
      ) : (
        <div className="space-y-6">
          {roster.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {roster.map((member) => (
                <Badge
                  key={member.user}
                  variant={present.has(member.user) ? "secondary" : "outline"}
                >
                  {member.displayName}
                  {present.has(member.user) ? "" : " · left"}
                </Badge>
              ))}
            </div>
          ) : null}

          <NewTaskForm list={list} onCreated={page.refetch} />

          {(page.data?.tasks ?? []).length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks here yet"
              description="Add one above. Its end is both the deadline and the end of the time it occupies."
            />
          ) : (
            <div className="space-y-3">
              {(page.data?.tasks ?? []).map((task) => (
                <TaskCard
                  key={String(task.task)}
                  task={task}
                  members={assignable}
                  viewer={viewer}
                  onChanged={page.refetch}
                />
              ))}
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

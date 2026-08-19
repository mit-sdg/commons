"use client";

import { ListChecks, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
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
import { useQuery } from "@/hooks/use-query";
import { CommonsError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import type { AssignedTask, TaskList } from "@/lib/models";
import { loadMyLists, loadMyTasks, openTaskList } from "@/lib/tasks";

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
      const list = await openTaskList(
        members.map((member) => member.user),
        title.trim(),
      );
      setOpen(false);
      setTitle("");
      setChosen([]);
      onOpened(list);
    } catch (error) {
      toast.error(
        error instanceof CommonsError
          ? error.message
          : "The list could not be opened.",
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
          <DialogTitle>Open a task list</DialogTitle>
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
            A list is the set of people it is for. Opening the same set again
            reaches the same list rather than making another.
          </p>
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => void create()}>
            {busy ? "Opening…" : "Open list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListRow({ list }: { list: TaskList }) {
  const id = String(list.list);
  const members = list.members ?? [];
  const present = new Set((list.present ?? []).map((row) => String(row.user)));
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
            : members
                .map((member) =>
                  present.has(String(member.user))
                    ? member.displayName
                    : `${member.displayName} (left)`,
                )
                .join(", ")}
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
  const [openingOwn, setOpeningOwn] = useState(false);

  const lists = useQuery<TaskList[]>(session ? loadMyLists : null, [session]);
  const tasks = useQuery<AssignedTask[]>(session ? loadMyTasks : null, [
    session,
  ]);

  function refreshAll() {
    lists.refetch();
    tasks.refetch();
  }

  async function openOwnList() {
    setOpeningOwn(true);
    try {
      router.push(`/tasks/${await openTaskList([viewer])}`);
    } catch (error) {
      toast.error(
        error instanceof CommonsError
          ? error.message
          : "Your own list could not be opened.",
      );
    } finally {
      setOpeningOwn(false);
    }
  }

  const outstanding = (tasks.data ?? []).filter(
    (task) => task.state === "OPEN",
  );
  const settled = (tasks.data ?? []).filter((task) => task.state !== "OPEN");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Your work"
        title="Tasks"
        description="Everything assigned to you, across every list you belong to."
        actions={
          me ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={openingOwn}
                onClick={() => void openOwnList()}
              >
                My own tasks
              </Button>
              <NewListDialog
                me={viewer}
                myName={me.profile.displayName}
                onOpened={(list) => router.push(`/tasks/${list}`)}
              />
            </>
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-4" aria-label="Assigned to me">
          {tasks.loading && !tasks.data ? (
            <LoadingState />
          ) : tasks.error ? (
            <ErrorState message={tasks.error} onRetry={tasks.refetch} />
          ) : outstanding.length === 0 && settled.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nothing is assigned to you"
              description="Open a list, add a task, and take it — or wait for someone in a shared list to hand you one."
            />
          ) : (
            <>
              {outstanding.map((task) => (
                <TaskCard
                  key={String(task.task)}
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
              {settled.length > 0 ? (
                <>
                  <h2 className="pt-2 text-sm font-semibold text-muted-foreground">
                    Finished and canceled
                  </h2>
                  {settled.map((task) => (
                    <TaskCard
                      key={String(task.task)}
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
                </>
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

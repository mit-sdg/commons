"use client";

import {
  Ban,
  CalendarClock,
  Check,
  RotateCcw,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserName } from "@/components/user-name";
import { api, publicErrorMessage } from "@/lib/api";
import { fromLocalInput, toLocalInput, windowLabel } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export interface TaskCardTask {
  task: unknown;
  title: string;
  details: string;
  startsAt: unknown;
  endsAt: unknown;
  state: string;
  overdue: boolean;
  assignee?: string | null;
}

export interface TaskCardMember {
  user: string;
  displayName?: string;
}

export function TaskCard({
  task,
  members,
  viewer,
  onChanged,
  context,
}: {
  task: TaskCardTask;
  /** The profiles that may hold this task; empty hides reassignment. */
  members?: TaskCardMember[];
  viewer: string;
  onChanged: () => void;
  context?: React.ReactNode;
}) {
  const id = String(task.task);
  const [retiming, setRetiming] = useState(false);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(task.startsAt));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(task.endsAt));
  const [busy, setBusy] = useState(false);
  const canceled = task.state === "CANCELED";
  const done = task.state === "DONE";
  const assignee = task.assignee ? String(task.assignee) : null;

  async function run(
    label: string,
    call: () => Promise<{ error: string } | object>,
  ) {
    setBusy(true);
    const result = await call();
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(label);
      onChanged();
    }
  }

  async function saveWindow() {
    const start = fromLocalInput(startsAt);
    const end = fromLocalInput(endsAt);
    if (!start || !end) {
      toast.error("Give the task a start and an end.");
      return;
    }
    setBusy(true);
    const result = await api.tasks.retime({
      task: id,
      startsAt: start,
      endsAt: end,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Window changed");
      setRetiming(false);
      onChanged();
    }
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        canceled && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3
            className={cn(
              "font-medium",
              (done || canceled) && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            <span>{windowLabel(task.startsAt, task.endsAt)}</span>
            {context}
          </p>
          {task.details ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              {task.details}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {task.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
          {done ? <Badge variant="secondary">Done</Badge> : null}
          {canceled ? <Badge variant="outline">Canceled</Badge> : null}
          {!done && !canceled && !task.overdue ? (
            <Badge variant="outline">Open</Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-sm">
        <span className="text-muted-foreground">
          {assignee ? "Assigned to" : "Unassigned"}
        </span>
        {assignee ? <UserName user={assignee} /> : null}

        {!canceled && members && members.length > 0 ? (
          <Select
            value={assignee ?? ""}
            disabled={busy}
            onValueChange={(value) =>
              run("Assignee changed", () =>
                api.tasks.assign({ task: id, assignee: value }),
              )
            }
          >
            <SelectTrigger
              aria-label="Assign this task"
              className="h-8 w-auto min-w-40"
            >
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.user} value={member.user}>
                  {member.user === viewer
                    ? "Me"
                    : (member.displayName ?? member.user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {!canceled && assignee ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              run("Assignee released", () => api.tasks.release({ task: id }))
            }
          >
            <UserMinus className="size-4" /> Release
          </Button>
        ) : null}
        {!canceled && !assignee && members !== undefined ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              run("Task taken", () =>
                api.tasks.assign({ task: id, assignee: viewer }),
              )
            }
          >
            <UserPlus className="size-4" /> Take it
          </Button>
        ) : null}

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {!canceled ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setRetiming((open) => !open)}
            >
              <CalendarClock className="size-4" /> Retime
            </Button>
          ) : null}
          {!canceled && !done ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Task completed", () => api.tasks.complete({ task: id }))
              }
            >
              <Check className="size-4" /> Complete
            </Button>
          ) : null}
          {done ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                run("Task reopened", () => api.tasks.reopen({ task: id }))
              }
            >
              <RotateCcw className="size-4" /> Reopen
            </Button>
          ) : null}
          {!canceled && !done ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-muted-foreground"
              onClick={() =>
                run("Task canceled", () => api.tasks.cancel({ task: id }))
              }
            >
              <Ban className="size-4" /> Cancel
            </Button>
          ) : null}
        </span>
      </div>

      {retiming ? (
        <div className="mt-3 grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`start-${id}`}>Starts</Label>
            <Input
              id={`start-${id}`}
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`end-${id}`}>Ends (the deadline)</Label>
            <Input
              id={`end-${id}`}
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <Button disabled={busy} onClick={() => void saveWindow()}>
            Save window
          </Button>
        </div>
      ) : null}
    </article>
  );
}

"use client";

import {
  Ban,
  CalendarClock,
  Check,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TaskMarkdown } from "@/components/tasks/task-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

/**
 * The one place a task's state is announced. Kept visually distinct from the
 * action row so a button is never mistaken for a status.
 */
function StatusBadge({
  done,
  canceled,
  overdue,
}: {
  done: boolean;
  canceled: boolean;
  overdue: boolean;
}) {
  if (canceled) {
    return (
      <Badge variant="outline" className="shrink-0 text-muted-foreground">
        <Ban className="size-3" /> Canceled
      </Badge>
    );
  }
  if (done) {
    return (
      <Badge variant="secondary" className="shrink-0">
        <Check className="size-3" /> Done
      </Badge>
    );
  }
  if (overdue) {
    return (
      <Badge variant="destructive" className="shrink-0">
        Overdue
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 text-muted-foreground">
      Open
    </Badge>
  );
}

export function TaskCard({
  task,
  members,
  viewer,
  onChanged,
  context,
  expanded,
  onToggleExpanded,
}: {
  task: TaskCardTask;
  /** The profiles that may hold this task; empty hides reassignment. */
  members?: TaskCardMember[];
  viewer: string;
  onChanged: () => void;
  context?: React.ReactNode;
  /** Whether the details are open. Omit both to let the card govern itself. */
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const id = String(task.task);
  const [retiming, setRetiming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDetails, setEditDetails] = useState(task.details || "");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(task.startsAt));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(task.endsAt));
  const [busy, setBusy] = useState(false);
  const [selfExpanded, setSelfExpanded] = useState(false);

  const hasDetails = Boolean(task.details?.trim());
  // A page that owns the open set drives the card; otherwise it drives itself.
  const governed = onToggleExpanded !== undefined;
  const detailsOpen = governed ? expanded === true : selfExpanded;
  const toggleDetails = governed
    ? onToggleExpanded
    : () => setSelfExpanded((prev) => !prev);

  const canceled = task.state === "CANCELED";
  const done = task.state === "DONE";
  const assignee = task.assignee ? String(task.assignee) : null;
  // A canceled task is read-only, which empties the overflow menu.
  const hasActions = !canceled;
  const assignable = !canceled && members !== undefined && members.length > 0;

  async function run(
    label: string,
    call: () => Promise<{ error: string } | object>,
  ) {
    setBusy(true);
    const result = await call();
    setBusy(false);
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
    } else {
      toast.success(label);
      onChanged();
    }
  }

  async function saveDescription() {
    if (editTitle.trim() === "") {
      toast.error("Task title cannot be empty.");
      return;
    }
    setBusy(true);
    const result = await api.tasks.describe({
      task: id,
      title: editTitle.trim(),
      details: editDetails.trim(),
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
    } else {
      toast.success("Task updated");
      setEditing(false);
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
    if ("error" in result) {
      toast.error(
        result.error === "INVALID_REQUEST"
          ? "A task cannot end before it begins."
          : publicErrorMessage(result.error),
      );
    } else {
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
        <div className="min-w-0 flex-1 space-y-1">
          <h3
            className={cn(
              "font-medium text-foreground",
              (done || canceled) && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {/* The icon and its window stay one unit so the icon never wraps alone. */}
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4 shrink-0" />
              {windowLabel(task.startsAt, task.endsAt)}
            </span>
            {context}
          </p>
          {hasDetails ? (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={toggleDetails}
                aria-expanded={detailsOpen}
                aria-controls={`details-${id}`}
                className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    detailsOpen && "rotate-90",
                  )}
                />
                {detailsOpen ? "Hide details" : "Show details"}
              </button>
              {detailsOpen ? (
                <div id={`details-${id}`} className="mt-1.5 max-w-prose">
                  <TaskMarkdown content={task.details} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <StatusBadge done={done} canceled={canceled} overdue={task.overdue} />
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          {/* The picker doubles as the value display, so the name is only
              spelled out when there is no picker to read it from. */}
          <span className="text-muted-foreground">
            {assignee ? "Assigned to" : "Unassigned"}
          </span>
          {assignee && !assignable ? <UserName user={assignee} /> : null}

          {assignable ? (
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
                className="h-8 w-auto min-w-36 max-w-full"
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
        </div>

        {/* One row at every width: the primary action, then everything else
            behind a single overflow menu. */}
        {hasActions ? (
          <div className="flex shrink-0 items-center justify-end gap-2">
            {!canceled && !done ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run("Task completed", () => api.tasks.complete({ task: id }))
                }
              >
                <Check className="size-4" /> Mark complete
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={`More actions for ${task.title}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!canceled ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing((prev) => !prev);
                      setRetiming(false);
                    }}
                  >
                    <Pencil /> Edit title and details
                  </DropdownMenuItem>
                ) : null}
                {!canceled ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setRetiming((prev) => !prev);
                      setEditing(false);
                    }}
                  >
                    <CalendarClock /> Change the window
                  </DropdownMenuItem>
                ) : null}
                {!canceled && assignee ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void run("Assignee released", () =>
                        api.tasks.release({ task: id }),
                      )
                    }
                  >
                    <UserMinus /> Release
                  </DropdownMenuItem>
                ) : null}
                {!canceled && !assignee && members !== undefined ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void run("Task taken", () =>
                        api.tasks.assign({ task: id, assignee: viewer }),
                      )
                    }
                  >
                    <UserPlus /> Take it
                  </DropdownMenuItem>
                ) : null}
                {!canceled && !done ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        void run("Task canceled", () =>
                          api.tasks.cancel({ task: id }),
                        )
                      }
                    >
                      <Ban /> Cancel this task
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-title-${id}`}>Title</Label>
            <Input
              id={`edit-title-${id}`}
              value={editTitle}
              disabled={busy}
              placeholder="Task title"
              onChange={(event) => setEditTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-details-${id}`}>
              Details (Markdown supported)
            </Label>
            <Textarea
              id={`edit-details-${id}`}
              value={editDetails}
              disabled={busy}
              rows={3}
              placeholder="Add details in Markdown..."
              onChange={(event) => setEditDetails(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditTitle(task.title);
                setEditDetails(task.details || "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void saveDescription()}
            >
              Save description
            </Button>
          </div>
        </div>
      ) : null}

      {retiming ? (
        <div className="mt-3 grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`start-${id}`}>Starts</Label>
            <Input
              id={`start-${id}`}
              type="datetime-local"
              value={startsAt}
              disabled={busy}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`end-${id}`}>Ends (the deadline)</Label>
            <Input
              id={`end-${id}`}
              type="datetime-local"
              value={endsAt}
              disabled={busy}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setStartsAt(toLocalInput(task.startsAt));
                setEndsAt(toLocalInput(task.endsAt));
                setRetiming(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void saveWindow()}>
              Save window
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { api, publicErrorMessage } from "@/lib/api";
import type { TaskList } from "@/lib/models";
import { defaultWindow, fromLocalInput } from "@/lib/tasks";
export function NewTaskForm({
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
    <section aria-label="Add a task" className="min-w-0 space-y-3">
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
      <div className="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))] [&>div]:min-w-0">
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
      </div>
      <div className="flex justify-end border-t pt-4">
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

export function NewTaskDialog({
  scope,
  scopeLabel,
  groups,
  onCreated,
}: {
  scope: string;
  scopeLabel: string;
  groups?: TaskList[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState(scope);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelectedScope(scope);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        {groups ? (
          <div className="space-y-2">
            <Label htmlFor="task-scope">For</Label>
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger id="task-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={scope}>Personal — only you</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.list} value={String(group.list)}>
                    {group.title || "Untitled group"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">For {scopeLabel}</p>
        )}
        <NewTaskForm
          key={selectedScope}
          list={selectedScope}
          onCreated={() => {
            setOpen(false);
            onCreated();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

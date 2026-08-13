"use client";

import { Archive, CheckCircle, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Note {
  note: string;
  author: string;
  learner: string;
  body: string;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  followUpAt: string | null;
  acknowledgedAt: string | null;
  tags: string[];
}

interface StudentNotesProps {
  learner: string;
  notes: Note[];
  onUpdate: () => void;
  editable?: boolean;
  className?: string;
}

function localDateTime(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function StudentNotes({
  learner,
  notes,
  onUpdate,
  editable = false,
  className,
}: StudentNotesProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        notes.map((note) => (
          <NoteCard
            key={note.note}
            note={note}
            onUpdate={onUpdate}
            editable={editable}
          />
        ))
      )}
      {editable ? <WriteNoteForm learner={learner} onSaved={onUpdate} /> : null}
    </div>
  );
}

function NoteCard({
  note,
  onUpdate,
  editable,
}: {
  note: Note;
  onUpdate: () => void;
  editable: boolean;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [visibility, setVisibility] = useState<
    "STAFF_ONLY" | "LEARNER_VISIBLE"
  >(note.visibility === "LEARNER_VISIBLE" ? "LEARNER_VISIBLE" : "STAFF_ONLY");
  const [tags, setTags] = useState(note.tags.join(", "));
  const [followUpAt, setFollowUpAt] = useState(localDateTime(note.followUpAt));

  if (!session) return null;

  async function action(fn: () => Promise<unknown>, successMessage: string) {
    setLoading(true);
    const result = await fn();
    setLoading(false);
    if (typeof result === "object" && result !== null && "error" in result) {
      toast.error(publicErrorMessage((result as { error: string }).error));
    } else {
      toast.success(successMessage);
      setEditing(false);
      onUpdate();
    }
  }

  async function revise() {
    if (!body.trim()) return;
    await action(
      () =>
        api.students["notes/revise"]({
          note: note.note,
          body: body.trim(),
          visibility,
          tags: parseTags(tags),
          followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        }),
      "Note updated",
    );
  }

  const fieldPrefix = `note-${note.note}`;

  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              note.status === "OPEN"
                ? "bg-orange-100 text-orange-800 text-xs dark:bg-orange-950 dark:text-orange-200"
                : note.status === "RESOLVED"
                  ? "bg-green-100 text-green-800 text-xs dark:bg-green-950 dark:text-green-200"
                  : "bg-gray-100 text-gray-600 text-xs dark:bg-gray-900 dark:text-gray-300"
            }
          >
            {note.status.toLowerCase()}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {note.visibility === "STAFF_ONLY"
              ? "Staff only"
              : "Learner visible"}
          </Badge>
          {note.acknowledgedAt ? (
            <Badge variant="outline" className="text-xs text-green-700">
              Acknowledged
            </Badge>
          ) : null}
        </div>
        <time
          dateTime={note.createdAt}
          className="text-xs text-muted-foreground"
        >
          {relativeTime(note.createdAt)}
        </time>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-md bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-body`}>Note</Label>
            <Textarea
              id={`${fieldPrefix}-body`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              disabled={loading}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldPrefix}-visibility`}>Visibility</Label>
              <select
                id={`${fieldPrefix}-visibility`}
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as typeof visibility)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={loading}
              >
                <option value="STAFF_ONLY">Staff only</option>
                <option value="LEARNER_VISIBLE">Learner visible</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldPrefix}-follow-up`}>Follow-up date</Label>
              <Input
                id={`${fieldPrefix}-follow-up`}
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-tags`}>Tags</Label>
            <Input
              id={`${fieldPrefix}-tags`}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="advising, follow-up"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={revise}
              disabled={loading || !body.trim()}
            >
              Save changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{note.body}</p>
          {note.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          {note.followUpAt ? (
            <p className="text-xs text-muted-foreground">
              Follow up {new Date(note.followUpAt).toLocaleString()}
            </p>
          ) : null}
        </>
      )}

      {editable && !editing ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {note.status === "OPEN" ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setEditing(true)}
                disabled={loading}
              >
                <Pencil className="size-3" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() =>
                  action(
                    () => api.students["notes/resolve"]({ note: note.note }),
                    "Note resolved",
                  )
                }
                disabled={loading}
              >
                <CheckCircle className="size-3" /> Resolve
              </Button>
            </>
          ) : null}
          {note.status === "RESOLVED" ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() =>
                  action(
                    () => api.students["notes/restore"]({ note: note.note }),
                    "Note restored",
                  )
                }
                disabled={loading}
              >
                <RefreshCw className="size-3" /> Reopen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() =>
                  action(
                    () => api.students["notes/archive"]({ note: note.note }),
                    "Note archived",
                  )
                }
                disabled={loading}
              >
                <Archive className="size-3" /> Archive
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function WriteNoteForm({
  learner,
  onSaved,
}: {
  learner: string;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<
    "STAFF_ONLY" | "LEARNER_VISIBLE"
  >("STAFF_ONLY");
  const [tags, setTags] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function write() {
    if (!session || !body.trim()) return;
    setLoading(true);
    const result = await api.students["notes/write"]({
      learner,
      body: body.trim(),
      visibility,
      tags: parseTags(tags),
      followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Note written");
      setBody("");
      setTags("");
      setFollowUpAt("");
      setOpen(false);
      onSaved();
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-3" /> Write a note
      </Button>
    );
  }

  const prefix = `new-note-${learner}`;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-body`}>Note</Label>
        <Textarea
          id={`${prefix}-body`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a note about this student…"
          rows={4}
          disabled={loading}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-visibility`}>Visibility</Label>
          <select
            id={`${prefix}-visibility`}
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as typeof visibility)
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={loading}
          >
            <option value="STAFF_ONLY">Staff only</option>
            <option value="LEARNER_VISIBLE">Learner visible</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-follow-up`}>Follow-up date</Label>
          <Input
            id={`${prefix}-follow-up`}
            type="datetime-local"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-tags`}>Tags</Label>
        <Input
          id={`${prefix}-tags`}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="advising, follow-up"
          disabled={loading}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={write} disabled={loading || !body.trim()}>
          Save note
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

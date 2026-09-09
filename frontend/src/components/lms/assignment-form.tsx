"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import type { Input as ApiInput } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";
import { ASSIGNMENT_TYPES } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import { fromZonedInput, toZonedInput } from "@/lib/format";
import { loadSections } from "@/lib/lms";
import { CreationSkills } from "./grade-setup";

interface AssignmentFormProps {
  onSaved: (assignment: string) => void;
  existing?: {
    assignment: string;
    title: string;
    instructions: string;
    kind: string;
    availableAt: string;
    dueAt: string;
    closeAt: string | null;
    acceptsSubmissions: boolean;
    audience?: ApiInput<"/assignments/create-draft">["audience"];
    targets?: string[];
    status: string;
  };
  onCancel?: () => void;
}

export function AssignmentForm({
  onSaved,
  existing,
  onCancel,
}: AssignmentFormProps) {
  const { session, permissions } = useAuth();
  const { timezone } = useCourse();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [instructions, setInstructions] = useState(
    existing?.instructions ?? "",
  );
  const [kind, setKind] = useState(
    existing?.kind === "RECITATION" ? "PREP" : (existing?.kind ?? "EXERCISE"),
  );
  const [availableAt, setAvailableAt] = useState(() =>
    existing?.availableAt
      ? toZonedInput(existing.availableAt, timezone)
      : toZonedInput(new Date(), timezone),
  );
  const [dueAt, setDueAt] = useState(() =>
    existing?.dueAt
      ? toZonedInput(existing.dueAt, timezone)
      : toZonedInput(new Date(Date.now() + 7 * 86400000), timezone),
  );
  const [closeAt, setCloseAt] = useState(
    existing?.closeAt ? toZonedInput(existing.closeAt, timezone) : "",
  );
  const [acceptsSubmissions, setAcceptsSubmissions] = useState(
    existing?.acceptsSubmissions ?? true,
  );
  const [audience, setAudience] = useState<
    ApiInput<"/assignments/create-draft">["audience"]
  >(existing?.audience ?? "EVERYONE");
  const [targets, setTargets] = useState<string[]>(
    () => existing?.targets?.map(String) ?? [],
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showClose, setShowClose] = useState(Boolean(existing?.closeAt));
  const [loading, setLoading] = useState(false);
  const { data: sectionsData, loading: sectionsLoading } = useQuery(
    () => loadSections(),
    [],
  );
  const sections = (sectionsData?.sections ?? []).filter(
    (section) => section.status === "ACTIVE",
  );
  const availableError =
    availableAt && dueAt && availableAt > dueAt
      ? "Availability must be on or before the due date."
      : "";
  const dueError =
    closeAt && dueAt && dueAt > closeAt
      ? "The due date must be on or before close."
      : "";
  const scheduleValid =
    Boolean(availableAt && dueAt) && !availableError && !dueError;

  function toggleTarget(section: string) {
    setTargets((current) =>
      current.includes(section)
        ? current.filter((target) => target !== section)
        : [...current, section],
    );
  }

  async function save() {
    if (!session || !scheduleValid) return;
    setLoading(true);
    try {
      const rawPayload = {
        session,
        title: title.trim(),
        instructions: instructions.trim(),
        kind,
        availableAt: fromZonedInput(availableAt, timezone),
        dueAt: fromZonedInput(dueAt, timezone),
        closeAt: closeAt ? fromZonedInput(closeAt, timezone) : undefined,
        acceptsSubmissions,
        audience,
        targets: audience === "TARGETS" ? targets : [],
      };

      const existingGradeItem = existing
        ? await api.grades.item({ item: existing.assignment })
        : null;
      const result = existing
        ? await api.assignments.revise({
            title: rawPayload.title,
            instructions: rawPayload.instructions,
            kind: rawPayload.kind,
            availableAt: rawPayload.availableAt,
            dueAt: rawPayload.dueAt,
            closeAt: rawPayload.closeAt,
            acceptsSubmissions: rawPayload.acceptsSubmissions,
            audience: rawPayload.audience,
            targets: rawPayload.targets,
            assignment: existing.assignment,
          })
        : await api.assignments["create-draft"](rawPayload);

      if ("error" in result) {
        setLoading(false);
        toast.error(publicErrorMessage(result.error));
      } else {
        if (
          existing &&
          existingGradeItem &&
          !("error" in existingGradeItem) &&
          existingGradeItem.label === existing.title &&
          existing.title !== rawPayload.title
        ) {
          try {
            const renamed = await api.grades["configure-item"]({
              item: existing.assignment,
              label: rawPayload.title,
            });
            if ("error" in renamed) throw new Error(renamed.error);
          } catch {
            toast.warning(
              "Assignment saved, but its assessment label could not be updated. Review the label before retrying.",
            );
          }
        }
        toast.success(existing ? "Assignment updated" : "Assignment created");
        const savedAssignment =
          existing?.assignment ??
          ("assignment" in result ? result.assignment : "");
        if (!existing && acceptsSubmissions) {
          for (const [position, basis] of selectedSkills.entries()) {
            try {
              const added = await api.grades["add-criterion"]({
                item: savedAssignment,
                basis,
                position,
              });
              if ("error" in added)
                throw new Error(publicErrorMessage(added.error));
            } catch {
              toast.error(
                "Draft saved, but some skills could not be added. Review its skills before publishing.",
              );
              break;
            }
          }
        }
        onSaved(savedAssignment);
      }
    } catch {
      toast.error(
        "Could not save the assignment. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="asgn-title">Title</Label>
        <Input
          id="asgn-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Prep for concept modeling"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="asgn-instructions">Instructions</Label>
        <Textarea
          id="asgn-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={10}
          className="min-h-56"
          placeholder="Assignment instructions (Markdown supported)..."
          disabled={loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="asgn-kind">Assignment type</Label>
          <Select value={kind} onValueChange={setKind} disabled={loading}>
            <SelectTrigger id="asgn-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ASSIGNMENT_TYPES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="asgn-audience">Assign to</Label>
          <Select
            value={audience}
            onValueChange={(value) => {
              if (value === "EVERYONE" || value === "TARGETS")
                setAudience(value);
            }}
            disabled={loading}
          >
            <SelectTrigger id="asgn-audience" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EVERYONE">All students</SelectItem>
              <SelectItem value="TARGETS">Selected sections</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {audience === "TARGETS" ? (
        <fieldset className="space-y-2 rounded-lg border border-border bg-muted/25 p-4">
          <legend className="px-1 text-sm font-medium">
            Assigned sections
          </legend>
          {sectionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading sections…</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a course section before targeting an assignment.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sections.map((section) => {
                const id = `assignment-target-${section.section}`;
                const selected = targets.includes(String(section.section));
                return (
                  <label
                    key={String(section.section)}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-card p-3 text-sm hover:border-primary/40"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTarget(String(section.section))}
                      disabled={loading}
                      className="mt-0.5 rounded"
                    />
                    <span>
                      <span className="block font-medium">{section.name}</span>
                      {section.meetingPattern ? (
                        <span className="block text-xs text-muted-foreground">
                          {section.meetingPattern}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {existing?.status === "PUBLISHED" ? (
            <p className="text-xs text-muted-foreground">
              Adding sections grants access to newly included learners. Removing
              a section does not revoke access already granted.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {!existing && acceptsSubmissions && permissions.can("grade") && (
        <CreationSkills
          selected={selectedSkills}
          onChange={setSelectedSkills}
          disabled={loading}
        />
      )}
      <section className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Schedule</h2>
          <p className="text-sm text-muted-foreground">Times in {timezone}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="asgn-available">Available from</Label>
            <Input
              id="asgn-available"
              type="datetime-local"
              value={availableAt}
              onChange={(e) => setAvailableAt(e.target.value)}
              disabled={loading}
              aria-invalid={Boolean(availableError)}
              aria-describedby={
                availableError ? "asgn-available-error" : undefined
              }
            />
            {availableError ? (
              <p id="asgn-available-error" className="text-xs text-destructive">
                {availableError}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="asgn-due">Due date</Label>
            <Input
              id="asgn-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={loading}
              aria-invalid={Boolean(availableError || dueError)}
              aria-describedby={
                availableError || dueError ? "asgn-due-error" : undefined
              }
            />
            {availableError || dueError ? (
              <p id="asgn-due-error" className="text-xs text-destructive">
                {availableError || dueError}
              </p>
            ) : null}
          </div>
          {showClose && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="asgn-close">
                Closes{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="asgn-close"
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                disabled={loading}
                aria-invalid={Boolean(dueError)}
                aria-describedby={dueError ? "asgn-close-error" : undefined}
              />
              {dueError ? (
                <p id="asgn-close-error" className="text-xs text-destructive">
                  {dueError}
                </p>
              ) : null}
            </div>
          )}
        </div>
        {!showClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowClose(true)}
          >
            Add closing date
          </Button>
        )}
      </section>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="asgn-accepts"
          checked={acceptsSubmissions}
          onChange={(e) => setAcceptsSubmissions(e.target.checked)}
          disabled={loading}
          className="rounded"
        />
        <Label htmlFor="asgn-accepts" className="cursor-pointer">
          Accepts submissions
        </Label>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={save}
          disabled={
            loading ||
            !title.trim() ||
            !scheduleValid ||
            (audience === "TARGETS" && targets.length === 0)
          }
        >
          {loading ? "Saving…" : existing ? "Save changes" : "Create draft"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

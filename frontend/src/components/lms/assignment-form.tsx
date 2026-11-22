"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
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
import type { Input as ApiInput, Output } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";
import { ASSIGNMENT_TYPES } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import { fromZonedInput, toZonedInput } from "@/lib/format";
import type { SetupCriterionInput } from "@/lib/grading";
import {
  loadGradesForItem,
  loadSections,
  loadSubmissionsForAssignment,
} from "@/lib/lms";
import { submittedByTeam } from "@/lib/teams";
import { CreationSkills } from "./grade-setup";

type SubmittedBy = "STUDENT" | "SECTION";

/** Students on teams who submitted on their own, on an assignment each student submits. */
export interface OwnWorkOnTeams {
  students: number;
  teams: number;
  /** How many of those students hold an assessment; null when grades could not be read. */
  graded: number | null;
}

/** Which students on teams have a submitted attempt of their own, and on how many teams. */
export function ownWorkOnTeams(
  work: Output<"/submissions/for-assignment">,
  grades: Output<"/grades/for-item">["grades"] | null,
): OwnWorkOnTeams {
  const submitters = new Set(
    work.submissions
      .filter((attempt) => attempt.status === "SUBMITTED")
      .map((attempt) => String(attempt.submitter)),
  );
  const students = new Set<string>();
  const teams = new Set<string>();
  for (const row of work.assigned) {
    const student = String(row.assignee);
    if (row.section == null || !submitters.has(student)) continue;
    students.add(student);
    teams.add(String(row.section));
  }
  const graded = grades
    ? new Set(
        grades
          .filter(
            (grade) =>
              grade.status !== "EXCUSED" && students.has(String(grade.learner)),
          )
          .map((grade) => String(grade.learner)),
      ).size
    : null;
  return { students: students.size, teams: teams.size, graded };
}

/** How many teams have a submitted attempt, on an assignment each team submits. */
export function teamsWithWork(
  work: Output<"/submissions/for-assignment">,
): number {
  const teams = new Set(
    work.assigned
      .filter((row) => String(row.submitter) !== String(row.assignee))
      .map((row) => String(row.submitter)),
  );
  return new Set(
    work.submissions
      .filter(
        (attempt) =>
          attempt.status === "SUBMITTED" &&
          teams.has(String(attempt.submitter)),
      )
      .map((attempt) => String(attempt.submitter)),
  ).size;
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** What changing to each team hides; null when nothing is hidden, and no numbers when the work could not be read. */
export function toTeamsNotice(work: OwnWorkOnTeams | null): string | null {
  if (!work)
    return "Students on teams who already submitted on their own stop seeing that submission until it is moved to their team.";
  if (work.students === 0) return null;
  const one = work.students === 1;
  const graded = !work.graded
    ? ""
    : one
      ? ", and that submission is graded"
      : `, and ${work.graded} of those submissions ${work.graded === 1 ? "is" : "are"} graded`;
  return `${counted(work.students, "student", "students")} on ${counted(work.teams, "team", "teams")} ${one ? "has" : "have"} already submitted on their own${graded}. ${one ? "The student stops" : "Students stop"} seeing their own submission until it is moved to their team.`;
}

/** What changing to each student hides; null when nothing is hidden, and no numbers when the work could not be read. */
export function toStudentsNotice(teams: number | null): string | null {
  if (teams === null)
    return "Students on teams stop seeing their team's submissions.";
  if (teams === 0) return null;
  return `${counted(teams, "team", "teams")} ${teams === 1 ? "has" : "have"} submitted. Students stop seeing their team's submissions.`;
}

/** Reads the assignment's work at save time and words what the change would hide. */
async function hiddenWorkNotice(
  assignment: string,
  to: SubmittedBy,
): Promise<string | null> {
  let work: Output<"/submissions/for-assignment">;
  try {
    work = await loadSubmissionsForAssignment(assignment);
  } catch {
    return to === "SECTION" ? toTeamsNotice(null) : toStudentsNotice(null);
  }
  if (to === "STUDENT") return toStudentsNotice(teamsWithWork(work));
  if (ownWorkOnTeams(work, []).students === 0) return null;
  const grades = await loadGradesForItem(assignment).then(
    (result) => result.grades,
    () => null,
  );
  return toTeamsNotice(ownWorkOnTeams(work, grades));
}

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
    submittedBy?: ApiInput<"/assignments/revise">["submittedBy"];
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
  const storedSubmittedBy: SubmittedBy = submittedByTeam({
    submittedBy: existing?.submittedBy,
  })
    ? "SECTION"
    : "STUDENT";
  const [submittedBy, setSubmittedBy] =
    useState<SubmittedBy>(storedSubmittedBy);
  const [notice, setNotice] = useState("");
  const [asking, setAsking] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [gradingMethod, setGradingMethod] = useState<"COMPETENCY" | "POINTS">(
    "COMPETENCY",
  );
  const [maxPoints, setMaxPoints] = useState("100");
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
  const numericMaximum = Number(maxPoints);
  const maximumValid =
    Boolean(existing) ||
    !acceptsSubmissions ||
    gradingMethod !== "POINTS" ||
    (maxPoints.trim() !== "" &&
      Number.isFinite(numericMaximum) &&
      numericMaximum > 0);

  function toggleTarget(section: string) {
    setTargets((current) =>
      current.includes(section)
        ? current.filter((target) => target !== section)
        : [...current, section],
    );
  }

  async function save() {
    if (!session || !scheduleValid || !maximumValid) return;
    if (existing?.status === "PUBLISHED" && submittedBy !== storedSubmittedBy) {
      setLoading(true);
      const hidden = await hiddenWorkNotice(existing.assignment, submittedBy);
      if (hidden) {
        setLoading(false);
        setNotice(hidden);
        setAsking(true);
        return;
      }
    }
    await commit();
  }

  async function commit() {
    if (!session) return;
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
        submittedBy,
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
            submittedBy: rawPayload.submittedBy,
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
          try {
            const criteria: SetupCriterionInput[] =
              gradingMethod === "POINTS"
                ? [
                    {
                      kind: "POINTS",
                      name: "Overall",
                      maxPoints: numericMaximum,
                      position: 0,
                    },
                  ]
                : selectedSkills.map((basis, position) => ({
                    kind: "COMPETENCY",
                    basis,
                    position,
                  }));
            const configured = await api.grades["configure-setup"]({
              item: savedAssignment,
              method: gradingMethod,
              revision: 0,
              criteria,
            });
            if ("error" in configured) throw new Error(configured.error);
          } catch {
            toast.error(
              "Draft saved, but its grading setup could not be configured. Review the setup before publishing.",
            );
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
          placeholder="Assignment instructions (Markdown supported)…"
          disabled={loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
              <SelectItem value="TARGETS">Selected teams</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="asgn-submitted-by">Submitted by</Label>
          <Select
            value={submittedBy}
            onValueChange={(value) => {
              if (value === "STUDENT" || value === "SECTION")
                setSubmittedBy(value);
            }}
            disabled={loading}
          >
            <SelectTrigger id="asgn-submitted-by" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STUDENT">Each student</SelectItem>
              <SelectItem value="SECTION">Each team</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {audience === "TARGETS" ? (
        <fieldset className="space-y-2 rounded-lg border border-border bg-muted/25 p-4">
          <legend className="px-1 text-sm font-medium">Assigned teams</legend>
          {sectionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading teams…</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
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
              Students on an added team get access. Students on a removed team
              keep the access they have.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {!existing && acceptsSubmissions && permissions.can("grade") && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="font-medium">Grading</h2>
          <div className="flex flex-wrap gap-2" aria-label="Grading method">
            {(
              [
                ["COMPETENCY", "Competency"],
                ["POINTS", "Points"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={gradingMethod === value ? "default" : "outline"}
                aria-pressed={gradingMethod === value}
                disabled={loading}
                onClick={() => setGradingMethod(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {gradingMethod === "POINTS"
              ? "Start with one Overall criterion. You can add named subsections in the assignment setup."
              : "Assess the selected skills against their rubrics."}
          </p>
          {gradingMethod === "POINTS" && (
            <div className="space-y-2">
              <Label htmlFor="asgn-max-points">Maximum points</Label>
              <Input
                id="asgn-max-points"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="w-32"
                value={maxPoints}
                disabled={loading}
                aria-invalid={!maximumValid}
                aria-describedby={
                  maximumValid ? undefined : "asgn-max-points-error"
                }
                onChange={(event) => setMaxPoints(event.target.value)}
              />
              {!maximumValid && (
                <p
                  id="asgn-max-points-error"
                  className="text-xs text-destructive"
                >
                  Enter a maximum greater than zero.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      {!existing &&
        acceptsSubmissions &&
        permissions.can("grade") &&
        gradingMethod === "COMPETENCY" && (
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
            !maximumValid ||
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

      <ConfirmAction
        open={asking}
        onOpenChange={setAsking}
        title={
          submittedBy === "SECTION"
            ? "Change to each team?"
            : "Change to each student?"
        }
        description={notice}
        confirmLabel={
          submittedBy === "SECTION"
            ? "Change to each team"
            : "Change to each student"
        }
        onConfirm={commit}
      />
    </div>
  );
}

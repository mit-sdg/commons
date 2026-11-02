"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CourseGradeCard } from "@/components/lms/course-grade-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InlineHelp } from "@/components/ui/inline-help";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SwitchRow } from "@/components/ui/switch";
import {
  type CourseGradesPage,
  type CoursePolicy,
  courseGradeActions,
  courseGrades,
  loadPolicy,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import { courseGradeCard } from "../../../../../src/computations/course-grades.ts";
import {
  lateAsMissingCount,
  lateWarning,
  openRelease,
  type ReleaseForm,
  releaseOf,
  reviewList,
  settingsFrom,
  startingForm,
} from "./release-helpers";
import type { ReleaseProps } from "./types";

interface FinalPolicy {
  name: string;
  version: number;
  specification: CoursePolicy;
}

/** "Release to students": the dialog that releases each student's grade so far under the final policy. */
export function ReleaseDialog({ page, onChanged }: ReleaseProps) {
  const [open, setOpen] = useState(false);
  const releasing = openRelease(page);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Release to students</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        {open && (
          <ReleaseBody
            page={page}
            again={releasing !== null}
            onReleased={() => {
              setOpen(false);
              onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReleaseBody({
  page,
  again,
  onReleased,
}: {
  page: CourseGradesPage;
  again: boolean;
  onReleased: () => void;
}) {
  const finalEntry = page.policies.find((entry) => entry.final) ?? null;
  const finalId = finalEntry?.policy ?? null;
  const finalVersion = finalEntry?.version ?? null;
  const [final, setFinal] = useState<FinalPolicy | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const title = again ? "Release again" : "Release to students";

  useEffect(() => {
    if (finalId === null) return;
    let current = true;
    loadPolicy(finalId)
      .then((loaded) => {
        if (current)
          setFinal({
            name: loaded.name,
            version: loaded.version,
            specification: loaded.specification,
          });
      })
      .catch((error: unknown) => {
        if (current)
          setFailed(error instanceof Error ? error.message : String(error));
      });
    return () => {
      current = false;
    };
  }, [finalId, finalVersion]);

  if (!finalEntry || failed)
    return (
      <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {failed ?? "No policy is marked final."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </>
    );
  if (!final)
    return (
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Loading the final policy…</DialogDescription>
      </DialogHeader>
    );
  return (
    <ReleaseControls
      page={page}
      final={final}
      title={title}
      again={again}
      onReleased={onReleased}
    />
  );
}

function ReleaseControls({
  page,
  final,
  title,
  again,
  onReleased,
}: {
  page: CourseGradesPage;
  final: FinalPolicy;
  title: string;
  again: boolean;
  onReleased: () => void;
}) {
  const inputs = page.inputs;
  const timezone = inputs.timezone;
  const now = useMemo(() => new Date(), []);
  const [form, setForm] = useState<ReleaseForm>(() => {
    const entry = openRelease(page);
    return startingForm(entry ? releaseOf(entry) : null, timezone, now);
  });
  const [released, setReleased] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const spec = final.specification;
  const settings = useMemo(
    () => (form.date ? settingsFrom(form, timezone) : null),
    [form, timezone],
  );
  const grades = useMemo(
    () =>
      settings ? courseGrades(spec, inputs, new Date(settings.dueBy), now) : [],
    [spec, inputs, settings, now],
  );
  const review = useMemo(
    () => reviewList(spec, inputs, grades),
    [spec, inputs, grades],
  );
  const late = lateAsMissingCount(grades);
  const heldStudents = new Set(review.map((row) => row.student));
  const stillHeld = review.filter((row) => !released.has(row.student)).length;

  const [preview, setPreview] = useState<string | null>(null);
  const previewStudent =
    preview ?? review[0]?.student ?? inputs.students[0]?.user ?? null;
  const previewGrade =
    grades.find((grade) => grade.student === previewStudent) ?? null;
  const previewCard =
    settings && previewGrade
      ? courseGradeCard(
          spec,
          inputs,
          previewGrade,
          settings,
          heldStudents.has(previewGrade.student) &&
            !released.has(previewGrade.student),
        )
      : null;

  function toggle(student: string, release: boolean) {
    setReleased((current) => {
      const next = new Set(current);
      if (release) next.add(student);
      else next.delete(student);
      return next;
    });
  }

  async function submit() {
    if (!settings || busy) return;
    setBusy(true);
    try {
      const result = await courseGradeActions.release(
        settings,
        [...released].filter((student) => heldStudents.has(student)),
      );
      if (!result.ok)
        return void toast.error(
          result.code === "CONFLICT" || result.code === "NO_FINAL_POLICY"
            ? "No policy is marked final."
            : result.error,
        );
      toast.success(again ? "Released again." : "Released to students.");
      onReleased();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-3">
          <span>
            {final.name}, version {final.version}
          </span>
          {again && (
            <InlineHelp label="About releasing again">
              Replaces every student’s copy, including students updated one at a
              time.
            </InlineHelp>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid content-start gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Work due by</span>
            <Input
              type="date"
              className="w-fit"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </label>
          <div className="grid gap-3">
            <SwitchRow
              label="Breakdown by group"
              on={form.breakdown}
              onChange={(breakdown) => setForm({ ...form, breakdown })}
            />
            <SwitchRow
              label="Letter grade"
              on={form.letter}
              onChange={(letter) => setForm({ ...form, letter })}
            />
            {form.letter && (
              <div className="pl-4">
                <SwitchRow
                  label="Include overrides"
                  on={form.includeOverrides}
                  onChange={(includeOverrides) =>
                    setForm({ ...form, includeOverrides })
                  }
                />
              </div>
            )}
          </div>
          {late > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {lateWarning(late, spec.missing)}
            </p>
          )}
          <Review
            rows={review}
            released={released}
            preview={previewStudent}
            onRelease={toggle}
            onPreview={setPreview}
          />
        </div>
        <Preview
          page={page}
          student={previewStudent}
          card={previewCard}
          onPick={setPreview}
        />
      </div>
      <DialogFooter className="items-center">
        {review.length > 0 && (
          <span className="mr-auto text-sm text-muted-foreground">
            {stillHeld} held
          </span>
        )}
        <DialogClose asChild>
          <Button variant="outline" aria-disabled={busy || undefined}>
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={submit} aria-disabled={busy || !settings || undefined}>
          {busy ? "Working…" : again ? "Release again" : "Release"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Review({
  rows,
  released,
  preview,
  onRelease,
  onPreview,
}: {
  rows: ReturnType<typeof reviewList>;
  released: Set<string>;
  preview: string | null;
  onRelease: (student: string, release: boolean) => void;
  onPreview: (student: string) => void;
}) {
  return (
    <div className="grid gap-2 border-t pt-3">
      <div className="flex items-center gap-1 text-sm font-medium">
        Held for review
        <InlineHelp label="About held students">
          Below C, or with a draft or ungraded work. Held students see “Staff
          will contact you about your course grade.”
        </InlineHelp>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody</p>
      ) : (
        <ul className="grid max-h-80 gap-1 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.student}
              className={cn(
                "grid gap-1 rounded-md px-2 py-1.5",
                preview === row.student && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-sm font-medium hover:underline"
                  onClick={() => onPreview(row.student)}
                >
                  {row.name}
                </button>
                <Segmented
                  label={`Release ${row.name}`}
                  value={released.has(row.student) ? "release" : "hold"}
                  options={[
                    ["hold", "Hold"],
                    ["release", "Release"],
                  ]}
                  onChange={(value) =>
                    onRelease(row.student, value === "release")
                  }
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {row.average !== null && (
                  <span className="text-foreground tabular-nums">
                    {row.average.toFixed(2)} {row.grade}
                  </span>
                )}
                {row.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Preview({
  page,
  student,
  card,
  onPick,
}: {
  page: CourseGradesPage;
  student: string | null;
  card: ReturnType<typeof courseGradeCard> | null;
  onPick: (student: string) => void;
}) {
  const [query, setQuery] = useState("");
  const students = page.inputs.students;
  const name = students.find((entry) => entry.user === student)?.name ?? "";
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? students
        .filter(
          (entry) =>
            entry.name.toLowerCase().includes(needle) ||
            entry.email.toLowerCase().includes(needle),
        )
        .slice(0, 6)
    : [];
  return (
    <div className="grid content-start gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">Preview</span>
        <span className="text-muted-foreground">{name}</span>
      </div>
      <div className="relative">
        <Input
          type="search"
          placeholder="Find a student"
          aria-label="Preview a student"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {needle && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 grid rounded-md border bg-popover p-1 shadow-md">
            {matches.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">
                No match
              </li>
            ) : (
              matches.map((entry) => (
                <li key={entry.user}>
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      onPick(entry.user);
                      setQuery("");
                    }}
                  >
                    {entry.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {card ? (
        <CourseGradeCard card={card} />
      ) : (
        <p className="text-sm text-muted-foreground">No students</p>
      )}
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import { Input } from "@/components/ui/input";
import {
  letterCounts,
  medianGrade,
  notCounted,
  type StudentGrade,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import {
  bySkill,
  CHIPS,
  type Filters,
  headline,
  isFiltered,
  matchesFilters,
  NO_FILTERS,
  notCountedHint,
  rankGrades,
  showLetter,
  withDividers,
} from "./class-helpers";
import { DotStrip } from "./class-strip";
import { OpenedStudent } from "./class-student";
import { ClassTable } from "./class-table";
import type { ClassPaneProps } from "./types";

const PILL =
  "inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The class pane: the headline, the dot strip, and the table. */
export function ClassPane({
  inputs,
  policy,
  onChange,
  grades,
  comparison,
  showAs,
  sections,
  readOnly,
  savedPolicy,
  onChanged,
  studentActions,
}: ClassPaneProps) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<string | null>(null);

  const students = useMemo(
    () => new Map(inputs.students.map((student) => [student.user, student])),
    [inputs],
  );
  const nameOf = (student: string) => students.get(student)?.name ?? "";
  const sectionNames = new Map(
    sections.map((entry) => [entry.section, entry.name]),
  );
  const grid = useMemo(() => bySkill(inputs), [inputs]);

  const median = medianGrade(grades, policy);
  const said = headline({
    grades,
    median: median === null ? null : showLetter(median, policy, showAs),
    comparison,
  });
  const hint = notCountedHint(notCounted(grades), policy.missing);
  const counts = letterCounts(grades, policy);

  const visible = grades.filter((grade) =>
    matchesFilters(grade, students.get(grade.student), policy, filters),
  );
  const filtered = isFiltered(filters);
  const rows = withDividers(
    rankGrades(visible, nameOf),
    policy.lines[policy.gradeSet],
  );
  const compared = useMemo(
    () =>
      comparison
        ? {
            policy: comparison.policy,
            grades: new Map(
              comparison.grades.map((grade) => [grade.student, grade]),
            ),
          }
        : null,
    [comparison],
  );
  const showReasons =
    "chip" in filters.filter && filters.filter.chip === "adjusted";

  function openStudent(student: string) {
    if (!visible.some((grade) => grade.student === student))
      setFilters(NO_FILTERS);
    setOpen(student);
    requestAnimationFrame(() =>
      document
        .getElementById(`course-grade-${student}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }

  return (
    <section aria-label="Class" className="grid min-w-0 gap-4">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="font-display text-2xl font-semibold">{said}</h2>
          {hint && <InlineHelp label="What counts">{hint}</InlineHelp>}
        </div>
        {comparison && comparison.differsIn.length > 0 && (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">Differs in</span>
            {comparison.differsIn.map((name) => (
              <span
                key={name}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium"
              >
                {name}
              </span>
            ))}
          </p>
        )}
      </div>

      <DotStrip
        grades={grades}
        policy={policy}
        showAs={showAs}
        readOnly={readOnly}
        onChange={onChange}
        highlighted={
          filtered ? new Set(visible.map((grade) => grade.student)) : null
        }
        nameOf={nameOf}
        onOpen={openStudent}
      />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grades">
        {counts.map(({ grade, count }) => {
          const on =
            "letter" in filters.filter && filters.filter.letter === grade;
          return (
            <button
              key={grade}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setFilters({
                  ...filters,
                  filter: on ? { chip: "everyone" } : { letter: grade },
                })
              }
              className={cn(
                PILL,
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card",
              )}
            >
              <b className="font-semibold">
                {showLetter(grade, policy, showAs)}
              </b>
              <span
                className={cn(
                  "tabular-nums",
                  on ? "text-background/75" : "text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative w-56 max-w-full">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Find a student"
              placeholder="Find a student"
              className="h-9 bg-card pl-8"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
          </div>
          {sections.length > 0 && (
            <select
              aria-label="Section"
              className="h-9 max-w-full rounded-md border border-input bg-card px-2 text-sm"
              value={filters.section}
              onChange={(event) =>
                setFilters({ ...filters, section: event.target.value })
              }
            >
              <option value="">All sections</option>
              {sections.map((entry) => (
                <option key={entry.section} value={entry.section}>
                  {entry.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {CHIPS.map(([chip, label]) => {
            const on = "chip" in filters.filter && filters.filter.chip === chip;
            return (
              <button
                key={chip}
                type="button"
                aria-pressed={on}
                onClick={() => setFilters({ ...filters, filter: { chip } })}
                className={cn(
                  PILL,
                  "py-0.5",
                  on
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ClassTable
        rows={rows}
        policy={policy}
        showAs={showAs}
        studentOf={(student) =>
          students.get(student) ?? { name: "", section: null }
        }
        sectionName={(section) =>
          section === null ? null : (sectionNames.get(section) ?? null)
        }
        compared={compared}
        showReasons={showReasons}
        open={open}
        onToggle={(student) =>
          setOpen((current) => (current === student ? null : student))
        }
        renderOpened={(grade: StudentGrade) => (
          <OpenedStudent
            grade={grade}
            inputs={inputs}
            policy={policy}
            showAs={showAs}
            grid={grid}
            readOnly={readOnly}
            savedPolicy={savedPolicy}
            onChanged={onChanged}
            actions={studentActions?.(grade.student)}
          />
        )}
      />
    </section>
  );
}

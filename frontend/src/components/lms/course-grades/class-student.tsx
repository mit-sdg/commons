"use client";

import type React from "react";
import { LEVEL_FILL, LEVEL_NAMES } from "@/components/lms/grades/common";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  type ShowAs,
  type StudentGrade,
  showAverage,
  showGrade,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import {
  assignmentCaptions,
  type BySkill,
  groupShare,
  RATING_SHORT,
  type RatingName,
  shortNames,
  showLetter,
  statusWord,
  TEAM_KIND,
} from "./class-helpers";
import { OverrideBox } from "./class-override";

/** One rating as a coloured chip; a ring marks a rating a skill row counted. */
function RatingChip({
  rating,
  counted = false,
}: {
  rating: RatingName;
  counted?: boolean;
}) {
  return (
    <span
      title={LEVEL_NAMES[rating]}
      className={cn(
        "inline-grid h-5 w-[22px] place-items-center rounded-[5px] text-[11px] font-semibold text-background",
        LEVEL_FILL[rating],
        counted && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
    >
      {RATING_SHORT[rating]}
    </span>
  );
}

function Cell({
  children,
  caption,
  title,
}: {
  children: React.ReactNode;
  caption: string;
  title?: string;
}) {
  return (
    <span className="grid justify-items-center gap-px">
      {children}
      <small title={title} className="text-[10px] text-muted-foreground">
        {caption}
      </small>
    </span>
  );
}

function Word({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[5px] px-1 text-xs text-muted-foreground ring-1 ring-border ring-inset">
      {children}
    </span>
  );
}

/** The opened student: groups and their rows, the By skill grid, the sum, and the override. */
export function OpenedStudent({
  grade,
  inputs,
  policy,
  showAs,
  grid,
  readOnly,
  savedPolicy,
  onChanged,
  actions,
}: {
  grade: StudentGrade;
  inputs: CourseGradeInputs;
  policy: CoursePolicy;
  showAs: ShowAs;
  grid: BySkill;
  readOnly: boolean;
  savedPolicy: string | null;
  onChanged: () => void;
  actions?: React.ReactNode;
}) {
  const titles = new Map(
    inputs.assignments.map((assignment) => [
      assignment.assignment,
      assignment.title,
    ]),
  );
  const captions = assignmentCaptions(inputs.assignments);
  const skillName = new Map(
    grid.skills.map((skill) => [skill.standard, skill.name]),
  );
  const skillCaption = shortNames(grid.skills.map((skill) => skill.name));
  const captionOf = (standard: string) => {
    const name = skillName.get(standard) ?? standard;
    return skillCaption.get(name) ?? name;
  };
  const rows = new Map(
    policy.groups.flatMap((group) => group.rows.map((row) => [row.key, row])),
  );
  const show = (value: number | null) => showAverage(value, policy, showAs);
  // The grade the student gets, as the row shows it.
  const letter = grade.grade ? showGrade(grade, policy, showAs) : null;

  return (
    <div className="grid max-w-4xl gap-4 text-sm whitespace-normal">
      {grade.groups.map((group) => (
        <section key={group.key} className="grid gap-1.5">
          <h4 className="flex flex-wrap items-baseline gap-x-3 font-semibold">
            {group.name}
            {group.value !== null && (
              <span className="tabular-nums">{show(group.value)}</span>
            )}
            <span className="font-normal text-muted-foreground">
              {group.value === null
                ? "Not due yet"
                : `${groupShare(policy, group.weight)}% weight`}
            </span>
          </h4>
          {group.rows.map((result) => {
            const row = rows.get(result.key);
            if (!row) return null;
            let label: React.ReactNode;
            let cells: React.ReactNode;
            if (row.type === "assignment") {
              const work = grade.work[row.assignment];
              label = titles.get(row.assignment) ?? "";
              const word = work
                ? statusWord(work.status, policy.missing)
                : null;
              const rated =
                work &&
                (work.status === "rated" || work.status === "lateRated");
              cells = (
                <>
                  {rated && work.points && (
                    <span className="rounded-[5px] bg-muted px-1.5 text-xs font-semibold tabular-nums">
                      {work.points.score}/{work.points.outOf}
                    </span>
                  )}
                  {rated &&
                    Object.entries(work.skills).map(([standard, rating]) => (
                      <Cell
                        key={standard}
                        caption={captionOf(standard)}
                        title={skillName.get(standard)}
                      >
                        <RatingChip rating={rating} />
                      </Cell>
                    ))}
                  {word && <Word>{word}</Word>}
                </>
              );
            } else {
              label = (
                <>
                  {skillName.get(row.standard) ?? row.standard}{" "}
                  <span className="text-muted-foreground">
                    {row.count === "latest"
                      ? "Latest"
                      : row.count === "best"
                        ? "Best"
                        : "Average"}
                  </span>
                </>
              );
              const from = grid.assignments.filter(
                (assignment) =>
                  row.from === "all" || assignment.kind !== TEAM_KIND,
              );
              const rated = from.flatMap((assignment) => {
                const work = grade.work[assignment.assignment];
                const rating = work?.skills[row.standard];
                return rating ? [{ assignment, rating }] : [];
              });
              cells =
                rated.length === 0 ? (
                  <Word>no ratings yet</Word>
                ) : (
                  rated.map(({ assignment, rating }) => (
                    <Cell
                      key={assignment.assignment}
                      caption={captions.get(assignment.assignment) ?? ""}
                      title={assignment.title}
                    >
                      <RatingChip
                        rating={rating}
                        counted={result.counted.includes(assignment.assignment)}
                      />
                    </Cell>
                  ))
                );
            }
            return (
              <div
                key={result.key}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_4.5rem]",
                  result.dropped && "opacity-50",
                )}
              >
                <span className="truncate text-muted-foreground">{label}</span>
                <span className="col-span-2 row-start-2 flex flex-wrap items-end gap-1 sm:col-span-1 sm:row-start-auto">
                  {cells}
                  {result.dropped && <Word>dropped</Word>}
                </span>
                <span className="text-right tabular-nums sm:col-start-3">
                  {result.value === null ? "" : show(result.value)}
                </span>
              </div>
            );
          })}
        </section>
      ))}

      <BySkillGrid grade={grade} grid={grid} captions={captions} />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border pt-2.5">
        <span>
          Average <b className="tabular-nums">{show(grade.average)}</b>
          {letter && (
            <>
              , grade <b>{letter}</b>
            </>
          )}
        </span>
        {grade.cappedBy && (
          <span>
            Fewer than {grade.cappedBy.below}% of lectures, grade at most{" "}
            <b>{showLetter(grade.cappedBy.atMost, policy, showAs)}</b>
          </span>
        )}
        {grade.lectures.total > 0 && (
          <span className="text-muted-foreground">
            Lectures {grade.lectures.attended} of {grade.lectures.total}
          </span>
        )}
      </div>

      <OverrideBox
        key={`${grade.student}:${String(grade.override?.setAt ?? "")}`}
        grade={grade}
        policy={policy}
        readOnly={readOnly}
        savedPolicy={savedPolicy}
        onChanged={onChanged}
      />
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Skills down, assignments across in due order. */
function BySkillGrid({
  grade,
  grid,
  captions,
}: {
  grade: StudentGrade;
  grid: BySkill;
  captions: Map<string, string>;
}) {
  if (grid.skills.length === 0) return null;
  return (
    <section className="grid gap-1.5">
      <h4 className="font-semibold">By skill</h4>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-x-1 border-spacing-y-0.5 text-xs">
          <thead>
            <tr>
              <th className="sr-only">Skill</th>
              {grid.assignments.map((assignment) => (
                <th
                  key={assignment.assignment}
                  title={assignment.title}
                  className="px-0.5 text-center font-normal whitespace-nowrap text-muted-foreground"
                >
                  {captions.get(assignment.assignment)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.skills.map((skill) => (
              <tr key={skill.standard}>
                <th
                  scope="row"
                  className="max-w-[11rem] truncate pr-2 text-left font-normal text-muted-foreground"
                  title={skill.name}
                >
                  {skill.name}
                </th>
                {grid.assignments.map((assignment) => {
                  const rating =
                    grade.work[assignment.assignment]?.skills[skill.standard];
                  return (
                    <td key={assignment.assignment} className="text-center">
                      {rating ? <RatingChip rating={rating} /> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import {
  type CoursePolicy,
  type GradeSet,
  gradeOrder,
  newKey,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import { LEVEL_NAMES } from "../grades/common";
import {
  AddButton,
  ChoiceField,
  NumberField,
  PolicySection,
  RemoveButton,
} from "./policy-fields";

export interface StepProps {
  policy: CoursePolicy;
  /** The policy as saved, to mark the steps an edit changed; null before the first save. */
  saved: CoursePolicy | null;
  onChange: (policy: CoursePolicy) => void;
  readOnly: boolean;
}

/** Whether the parts of a step differ between the edit and the saved policy. */
export function changed(
  saved: CoursePolicy | null,
  policy: CoursePolicy,
  parts: (policy: CoursePolicy) => unknown,
): boolean {
  return (
    saved !== null &&
    JSON.stringify(parts(saved)) !== JSON.stringify(parts(policy))
  );
}

type RatingName = keyof CoursePolicy["ratings"];
const RATINGS: RatingName[] = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"];

const DOT: Record<RatingName, string> = {
  DEFICIENT: "bg-level-deficient",
  EMERGENT: "bg-level-emergent",
  COMPETENT: "bg-level-competent",
  EXPERT: "bg-level-expert",
};

const LATE: [CoursePolicy["late"], string][] = [
  ["missing", "counts as Missing"],
  ["graded", "is graded as usual"],
];

/** A column of a step's row: a name over its value. */
function Column({
  top,
  children,
}: {
  top: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 content-start justify-items-center gap-1.5 text-center">
      {top}
      {children}
    </label>
  );
}

/** What each rating and Missing count as, and late work not covered by late days. */
export function RatingValues({ policy, saved, onChange, readOnly }: StepProps) {
  const [editing, setEditing] = useState(false);
  const edit = editing && !readOnly;
  const value = (
    label: string,
    number: number,
    set: (value: number) => void,
  ) =>
    edit ? (
      <NumberField
        label={label}
        value={number}
        step={0.5}
        onChange={set}
        readOnly={false}
        className="w-12 text-center"
      />
    ) : (
      <span className="text-base leading-7 font-semibold tabular-nums">
        {number}
      </span>
    );
  const name = (dot: string, words: string) => (
    <span className="grid max-w-full justify-items-center gap-1 text-[0.7rem] text-muted-foreground">
      <span aria-hidden className={cn("size-2.5 rounded-full", dot)} />
      <span className="max-w-full truncate">{words}</span>
    </span>
  );
  return (
    <PolicySection
      step={1}
      title="Ratings"
      hint="Each rating counts as its number, and missing work counts as the Missing number. Excused work, drafts, and work not due yet are left out. Points assignments count their share of the range, so 8 of 10 counts as 3.4."
      edited={changed(saved, policy, (p) => [p.ratings, p.missing, p.late])}
      editing={edit}
      onEditing={readOnly ? undefined : setEditing}
    >
      <div className="grid grid-cols-5 gap-1.5">
        {RATINGS.map((rating) => (
          <Column key={rating} top={name(DOT[rating], LEVEL_NAMES[rating])}>
            {value(LEVEL_NAMES[rating], policy.ratings[rating], (number) =>
              onChange({
                ...policy,
                ratings: { ...policy.ratings, [rating]: number },
              }),
            )}
          </Column>
        ))}
        <Column top={name("border-[1.5px] border-foreground/35", "Missing")}>
          {value("Missing", policy.missing, (missing) =>
            onChange({ ...policy, missing }),
          )}
        </Column>
      </div>
      {edit ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          Late work not covered by late days
          <ChoiceField
            label="Late work not covered by late days"
            value={policy.late}
            options={LATE}
            onChange={(late) => onChange({ ...policy, late })}
            readOnly={false}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Late work not covered by late days{" "}
          {LATE.find(([late]) => late === policy.late)?.[1]}
        </p>
      )}
    </PolicySection>
  );
}

const GRADE_SETS: [GradeSet, string][] = [
  ["letters", "A to F"],
  ["plusMinus", "With + and −"],
];

/** The grade lines drawn on the rating values' scale, Deficient to Expert. */
function GradeScale({ policy }: { policy: CoursePolicy }) {
  const lines = policy.lines[policy.gradeSet];
  const values = RATINGS.map((rating) => policy.ratings[rating]);
  const low = Math.min(...values, ...lines.map((line) => line.at));
  const high = Math.max(...values, low + 1);
  const left = (value: number) =>
    `${((Math.min(Math.max(value, low), high) - low) / (high - low)) * 100}%`;
  const tight = lines.length > 6;
  return (
    <div aria-hidden className="relative mx-5 mt-1 h-[3.9rem]">
      <span className="absolute inset-x-0 top-[1.4rem] h-px bg-foreground/20" />
      {RATINGS.map((rating) => (
        <span key={rating}>
          <span
            className="absolute top-[1.15rem] h-2.5 w-px bg-foreground/25"
            style={{ left: left(policy.ratings[rating]) }}
          />
          <span
            className="absolute top-8 -translate-x-1/2 text-center text-[0.7rem] leading-tight whitespace-nowrap text-muted-foreground"
            style={{ left: left(policy.ratings[rating]) }}
          >
            <b className="block font-semibold text-foreground">
              {policy.ratings[rating]}
            </b>
            {LEVEL_NAMES[rating]}
          </span>
        </span>
      ))}
      {lines.map((line) => (
        <span key={line.grade}>
          <span
            className="absolute top-3.5 h-3.5 w-[1.5px] -translate-x-1/2 bg-foreground"
            style={{ left: left(line.at) }}
          />
          <span
            title={`${line.grade} from ${line.at.toFixed(2)}`}
            className={cn(
              "absolute top-0 -translate-x-1/2 rounded bg-foreground font-bold text-background",
              tight ? "px-0.5 text-[10px]" : "px-1.5 text-[11px]",
            )}
            style={{ left: left(line.at) }}
          >
            {line.grade}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The letters the policy grades with, and where each one starts. */
export function GradeLines({ policy, saved, onChange, readOnly }: StepProps) {
  const [editing, setEditing] = useState(false);
  const edit = editing && !readOnly;
  const lines = policy.lines[policy.gradeSet];
  return (
    <PolicySection
      step={3}
      title="Grade lines"
      hint="An average at or above a line gets that letter. Below the last line is F. Lines sit on the same scale as the rating values. You can also drag a line on the strip."
      edited={changed(saved, policy, (p) => [p.gradeSet, p.lines])}
      editing={edit}
      onEditing={readOnly ? undefined : setEditing}
    >
      {edit ? (
        <div>
          <Segmented
            label="Grade set"
            value={policy.gradeSet}
            options={GRADE_SETS}
            onChange={(gradeSet) => onChange({ ...policy, gradeSet })}
          />
        </div>
      ) : null}
      <GradeScale policy={policy} />
      {/* Low to high, the way the scale above runs. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-x-1.5 gap-y-2.5">
        {[...lines.entries()].reverse().map(([index, line]) => (
          <Column
            key={line.grade}
            top={
              <span className="rounded bg-foreground px-1.5 text-xs font-bold text-background">
                {line.grade}
              </span>
            }
          >
            {edit ? (
              <NumberField
                label={`${line.grade} line`}
                value={line.at}
                step={0.1}
                onChange={(at) =>
                  onChange({
                    ...policy,
                    lines: {
                      ...policy.lines,
                      [policy.gradeSet]: lines.map((entry, place) =>
                        place === index ? { ...entry, at } : entry,
                      ),
                    },
                  })
                }
                readOnly={false}
                className="w-12 text-center"
              />
            ) : (
              <span className="text-[13px] leading-7 whitespace-nowrap text-muted-foreground tabular-nums">
                from {line.at.toFixed(2)}
              </span>
            )}
          </Column>
        ))}
      </div>
    </PolicySection>
  );
}

const CAPPED =
  "inline-block min-w-[30px] rounded-md border border-dashed border-foreground px-1.5 py-px text-center text-[13px] font-semibold";

/** Rules that cap the letter for students who came to too few lectures. */
export function AttendanceRules({
  policy,
  saved,
  onChange,
  readOnly,
}: StepProps) {
  const [editing, setEditing] = useState(false);
  const edit = editing && !readOnly;
  const order = gradeOrder(policy);
  const setRules = (attendance: CoursePolicy["attendance"]) =>
    onChange({ ...policy, attendance });
  return (
    <PolicySection
      step={4}
      title="Attendance"
      hint="A rule caps the letter after the average is worked out. An override replaces it."
      edited={changed(saved, policy, (p) => p.attendance)}
      editing={edit}
      onEditing={readOnly ? undefined : setEditing}
    >
      {policy.attendance.length === 0 && !edit ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : null}
      {policy.attendance.map((rule) => {
        if (!edit)
          return (
            <p key={rule.key} className="text-sm">
              Fewer than {rule.below}% of lectures: at most{" "}
              <span className={CAPPED}>{rule.atMost}</span>
            </p>
          );
        const letters = order.includes(rule.atMost)
          ? order
          : [rule.atMost, ...order];
        return (
          <div
            key={rule.key}
            className="group/item flex flex-wrap items-center gap-1.5 text-sm"
          >
            Fewer than
            <NumberField
              label="Percent of lectures"
              value={rule.below}
              max={100}
              onChange={(below) =>
                setRules(
                  policy.attendance.map((entry) =>
                    entry.key === rule.key ? { ...entry, below } : entry,
                  ),
                )
              }
              readOnly={false}
              className="w-12"
            />
            % of lectures: at most
            <ChoiceField
              label="Highest grade"
              value={rule.atMost}
              options={letters.map((letter) => [letter, letter])}
              onChange={(atMost) =>
                setRules(
                  policy.attendance.map((entry) =>
                    entry.key === rule.key ? { ...entry, atMost } : entry,
                  ),
                )
              }
              readOnly={false}
            />
            <span className="ml-auto">
              <RemoveButton
                label="Remove rule"
                onClick={() =>
                  setRules(
                    policy.attendance.filter((entry) => entry.key !== rule.key),
                  )
                }
              />
            </span>
          </div>
        );
      })}
      {edit ? (
        <AddButton
          onClick={() =>
            setRules([
              ...policy.attendance,
              { key: newKey("a"), below: 70, atMost: "B" },
            ])
          }
        >
          + Rule
        </AddButton>
      ) : null}
    </PolicySection>
  );
}

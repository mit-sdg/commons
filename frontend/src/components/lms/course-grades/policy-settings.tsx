"use client";

import { Segmented } from "@/components/ui/segmented";
import {
  type CoursePolicy,
  type GradeSet,
  gradeOrder,
  newKey,
} from "@/lib/course-grades";
import { LEVEL_NAMES } from "../grades/common";
import {
  AddButton,
  ChoiceField,
  NumberField,
  PolicySection,
  RemoveButton,
} from "./policy-fields";

interface SettingProps {
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  readOnly: boolean;
}

type RatingName = keyof CoursePolicy["ratings"];
const RATINGS: RatingName[] = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"];

const LATE: [CoursePolicy["late"], string][] = [
  ["missing", "counts as missing"],
  ["graded", "counts as graded"],
];

/** What each rating counts as, what Missing counts as, and late work without late days. */
export function RatingValues({ policy, onChange, readOnly }: SettingProps) {
  return (
    <PolicySection
      title="Rating values"
      hint="Each rating counts as its number. Missing work counts as the Missing number. Excused work, drafts, and work not due yet are left out. Points assignments count their share of the range, so 8 of 10 counts as 3.4."
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(3.75rem,1fr))] gap-1.5">
        {RATINGS.map((rating) => (
          <label
            key={rating}
            className="grid min-w-0 justify-items-center gap-1 text-[0.7rem] text-muted-foreground"
          >
            <span className="max-w-full truncate">{LEVEL_NAMES[rating]}</span>
            <NumberField
              label={LEVEL_NAMES[rating]}
              value={policy.ratings[rating]}
              step={0.5}
              onChange={(value) =>
                onChange({
                  ...policy,
                  ratings: { ...policy.ratings, [rating]: value },
                })
              }
              readOnly={readOnly}
              className="w-full max-w-14 text-center"
            />
          </label>
        ))}
        <label className="grid min-w-0 justify-items-center gap-1 text-[0.7rem] text-muted-foreground">
          <span className="truncate">Missing</span>
          <NumberField
            label="Missing"
            value={policy.missing}
            step={0.5}
            onChange={(missing) => onChange({ ...policy, missing })}
            readOnly={readOnly}
            className="w-full max-w-14 text-center"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        Late without late days
        <ChoiceField
          label="Late without late days"
          value={policy.late}
          options={LATE}
          onChange={(late) => onChange({ ...policy, late })}
          readOnly={readOnly}
          className={readOnly ? "text-muted-foreground" : undefined}
        />
      </div>
    </PolicySection>
  );
}

/** Rules that cap the letter for students who came to too few lectures. */
export function AttendanceRules({ policy, onChange, readOnly }: SettingProps) {
  const order = gradeOrder(policy);
  const setRules = (attendance: CoursePolicy["attendance"]) =>
    onChange({ ...policy, attendance });
  return (
    <PolicySection
      title="Attendance"
      hint="A rule caps the letter after the average is worked out. An override replaces it."
    >
      {policy.attendance.length === 0 && readOnly ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : null}
      {policy.attendance.map((rule) => {
        const letters = order.includes(rule.atMost)
          ? order
          : [rule.atMost, ...order];
        return (
          <div
            key={rule.key}
            className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background p-2 text-sm"
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
              readOnly={readOnly}
              className="w-12"
            />
            % of lectures, grade at most
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
              readOnly={readOnly}
            />
            {readOnly ? null : (
              <span className="ml-auto">
                <RemoveButton
                  label="Remove rule"
                  onClick={() =>
                    setRules(
                      policy.attendance.filter(
                        (entry) => entry.key !== rule.key,
                      ),
                    )
                  }
                />
              </span>
            )}
          </div>
        );
      })}
      {readOnly ? null : (
        <div>
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
        </div>
      )}
    </PolicySection>
  );
}

const GRADE_SETS: [GradeSet, string][] = [
  ["letters", "A to F"],
  ["plusMinus", "A to F with + and −"],
];

/** The letters the policy grades with, and where each one starts. */
export function GradeLines({ policy, onChange, readOnly }: SettingProps) {
  const lines = policy.lines[policy.gradeSet];
  return (
    <PolicySection
      title="Grade lines"
      hint={
        <div className="grid gap-2">
          <p>
            An average at or above a line gets that letter. Below the last line
            is F.
          </p>
          <p>
            Download, Below C, and the attendance rule use this policy&apos;s
            letters. Show as changes only how this screen shows grades.
          </p>
        </div>
      }
    >
      {readOnly ? (
        <p className="text-sm">
          {GRADE_SETS.find(([set]) => set === policy.gradeSet)?.[1]}
        </p>
      ) : (
        <div>
          <Segmented
            label="Grade set"
            value={policy.gradeSet}
            options={GRADE_SETS}
            onChange={(gradeSet) => onChange({ ...policy, gradeSet })}
          />
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        {lines.map((line, index) => (
          <label
            key={line.grade}
            className="flex items-center justify-between gap-1.5 rounded-md border bg-background px-2 py-1 text-sm font-medium"
          >
            {line.grade}
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
              readOnly={readOnly}
              className="w-12 font-normal"
            />
          </label>
        ))}
      </div>
    </PolicySection>
  );
}

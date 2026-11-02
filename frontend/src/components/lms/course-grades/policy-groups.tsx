"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import { Segmented } from "@/components/ui/segmented";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  newKey,
  type PolicyGroup,
  type PolicyRow,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import {
  AddButton,
  AddPicker,
  ChoiceField,
  KindTag,
  NumberField,
  PolicySection,
  RemoveButton,
  TextField,
} from "./policy-fields";

type Combine = PolicyGroup["combine"];
type SkillRow = Extract<PolicyRow, { type: "skill" }>;

const COMBINE: [Combine, string][] = [
  ["average", "Average"],
  ["best", "Best"],
  ["dropLowest", "Drop lowest"],
];

const COMBINE_HINT: Record<Combine, string> = {
  average: "Rows are averaged by their weights.",
  best: "The group takes its highest row.",
  dropLowest:
    "The lowest row is left out, then the rest are averaged by weight.",
};

const COUNT: [SkillRow["count"], string][] = [
  ["latest", "Latest"],
  ["best", "Best"],
  ["average", "Average"],
];

const FROM: [SkillRow["from"], string][] = [
  ["personal", "personal work"],
  ["all", "all work"],
];

interface Skill {
  standard: string;
  name: string;
}

/** What the inputs say about assignments and skills, for naming and adding rows. */
interface Catalog {
  /** Assignments that accept submissions, in due order. */
  assignments: { assignment: string; title: string }[];
  title: Map<string, string>;
  /** Rated skills by assignment, from its assessments' criteria. */
  skillsOf: Map<string, Skill[]>;
  /** Assignments graded in points. */
  points: Set<string>;
  /** Every skill, in the order the course first rates it. */
  skills: Skill[];
  skillName: Map<string, string>;
}

function catalog(inputs: CourseGradeInputs): Catalog {
  const assignments = inputs.assignments
    .filter((assignment) => assignment.acceptsSubmissions)
    .sort(
      (left, right) =>
        new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
    );
  const order = new Map(
    assignments.map((assignment, index) => [assignment.assignment, index]),
  );
  const byAssignment = new Map<string, Map<string, string>>();
  const points = new Set<string>();
  for (const assessment of inputs.assessments) {
    if (assessment.method === "POINTS") points.add(assessment.item);
    const skills = byAssignment.get(assessment.item) ?? new Map();
    for (const criterion of assessment.criteria)
      if (criterion.kind === "COMPETENCY" && !skills.has(criterion.standard))
        skills.set(criterion.standard, criterion.name || criterion.standard);
    byAssignment.set(assessment.item, skills);
  }
  const skillsOf = new Map(
    [...byAssignment].map(([assignment, skills]) => [
      assignment,
      [...skills].map(([standard, name]) => ({ standard, name })),
    ]),
  );
  const skillName = new Map<string, string>();
  for (const [, skills] of [...skillsOf].sort(
    ([left], [right]) =>
      (order.get(left) ?? Infinity) - (order.get(right) ?? Infinity),
  ))
    for (const skill of skills)
      if (!skillName.has(skill.standard))
        skillName.set(skill.standard, skill.name);
  return {
    assignments: assignments.map(({ assignment, title }) => ({
      assignment,
      title,
    })),
    title: new Map(
      inputs.assignments.map((assignment) => [
        assignment.assignment,
        assignment.title,
      ]),
    ),
    skillsOf,
    points,
    skills: [...skillName].map(([standard, name]) => ({ standard, name })),
    skillName,
  };
}

/** A name for a new group that no other group has. */
function newGroupName(groups: PolicyGroup[]): string {
  const taken = new Set(groups.map((group) => group.name));
  let name = "New group";
  for (let n = 2; taken.has(name); n += 1) name = `New group ${n}`;
  return name;
}

/** The policy's groups: each with a name, a weight, how it combines, and its rows. */
export function PolicyGroups({
  inputs,
  policy,
  onChange,
  readOnly,
}: {
  inputs: CourseGradeInputs;
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  readOnly: boolean;
}) {
  const known = useMemo(() => catalog(inputs), [inputs]);
  const total = policy.groups.reduce((sum, group) => sum + group.weight, 0);
  const setGroups = (groups: PolicyGroup[]) => onChange({ ...policy, groups });
  const setGroup = (key: string, next: PolicyGroup) =>
    setGroups(policy.groups.map((group) => (group.key === key ? next : group)));

  return (
    <PolicySection
      title="Groups"
      hint={
        <div className="grid gap-2">
          <p>
            The average is the weighted mean of the groups. Each group combines
            its rows. A row is an assignment, or one skill followed across the
            term.
          </p>
          <p>Team work is Final project work. Personal work is the rest.</p>
        </div>
      }
    >
      <div className="grid gap-2.5">
        {policy.groups.map((group) => (
          <Group
            key={group.key}
            group={group}
            share={
              total > 0 && total !== 100
                ? Math.round((group.weight / total) * 100)
                : null
            }
            known={known}
            policy={policy}
            onChange={onChange}
            onGroup={(next) => setGroup(group.key, next)}
            onRemove={() =>
              setGroups(
                policy.groups.filter((entry) => entry.key !== group.key),
              )
            }
            readOnly={readOnly}
          />
        ))}
      </div>
      {readOnly ? null : (
        <div>
          <AddButton
            onClick={() =>
              setGroups([
                ...policy.groups,
                {
                  key: newKey("g"),
                  name: newGroupName(policy.groups),
                  weight: 10,
                  combine: "average",
                  rows: [],
                },
              ])
            }
          >
            + Group
          </AddButton>
        </div>
      )}
    </PolicySection>
  );
}

function Group({
  group,
  share,
  known,
  policy,
  onChange,
  onGroup,
  onRemove,
  readOnly,
}: {
  group: PolicyGroup;
  /** The group's share of the average, shown when the weights don't total 100. */
  share: number | null;
  known: Catalog;
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  onGroup: (group: PolicyGroup) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(true);
  const name = group.name || "Group";
  const setRows = (rows: PolicyRow[]) => onGroup({ ...group, rows });
  const setRow = (key: string, row: PolicyRow) =>
    setRows(group.rows.map((entry) => (entry.key === key ? row : entry)));
  const inGroup = new Set(
    group.rows.map((row) =>
      row.type === "assignment" ? row.assignment : `skill:${row.standard}`,
    ),
  );

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center gap-1.5 p-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={name}
          onClick={() => setOpen(!open)}
          className="inline-grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
        </button>
        <TextField
          label="Group name"
          value={group.name}
          onChange={(value) => onGroup({ ...group, name: value })}
          readOnly={readOnly}
          className="flex-1 font-semibold"
        />
        <NumberField
          label={`Weight of ${name}`}
          value={group.weight}
          onChange={(weight) => onGroup({ ...group, weight })}
          readOnly={readOnly}
        />
        {share === null ? null : (
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {share}%
          </span>
        )}
        {readOnly ? null : (
          <RemoveButton label={`Remove ${name}`} onClick={onRemove} />
        )}
      </div>
      {open ? (
        <div className="grid gap-2 px-2.5 pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            Combine
            {readOnly ? (
              <span className="text-foreground">
                {COMBINE.find(([value]) => value === group.combine)?.[1]}
              </span>
            ) : (
              <Segmented
                label={`Combine the rows of ${name}`}
                value={group.combine}
                options={COMBINE}
                onChange={(combine) => onGroup({ ...group, combine })}
              />
            )}
            <InlineHelp label="Combine">
              {COMBINE_HINT[group.combine]}
            </InlineHelp>
          </div>
          {group.rows.length > 0 ? (
            <ul className="grid">
              {group.rows.map((row) => (
                <Row
                  key={row.key}
                  row={row}
                  weighted={group.combine !== "best"}
                  known={known}
                  policy={policy}
                  onChange={onChange}
                  onRow={(next) => setRow(row.key, next)}
                  onRemove={() =>
                    setRows(group.rows.filter((entry) => entry.key !== row.key))
                  }
                  readOnly={readOnly}
                />
              ))}
            </ul>
          ) : null}
          {readOnly ? null : (
            <div className="flex flex-wrap gap-1.5">
              <AddPicker
                said="+ Assignment"
                label={`Add an assignment to ${name}`}
                options={known.assignments
                  .filter((entry) => !inGroup.has(entry.assignment))
                  .map((entry) => [entry.assignment, entry.title])}
                onPick={(assignment) =>
                  setRows([
                    ...group.rows,
                    {
                      key: newKey("r"),
                      type: "assignment",
                      assignment,
                      weight: 1,
                    },
                  ])
                }
              />
              <AddPicker
                said="+ Skill"
                label={`Add a skill to ${name}`}
                options={known.skills
                  .filter((skill) => !inGroup.has(`skill:${skill.standard}`))
                  .map((skill) => [skill.standard, skill.name])}
                onPick={(standard) =>
                  setRows([
                    ...group.rows,
                    {
                      key: newKey("r"),
                      type: "skill",
                      standard,
                      weight: 1,
                      count: "latest",
                      from: "personal",
                    },
                  ])
                }
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  row,
  weighted,
  known,
  policy,
  onChange,
  onRow,
  onRemove,
  readOnly,
}: {
  row: PolicyRow;
  /** Whether row weights count: not under Best. */
  weighted: boolean;
  known: Catalog;
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  onRow: (row: PolicyRow) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const name =
    row.type === "assignment"
      ? (known.title.get(row.assignment) ?? "Removed assignment")
      : (known.skillName.get(row.standard) ?? row.standard);
  const skills =
    row.type === "assignment" && !known.points.has(row.assignment)
      ? (known.skillsOf.get(row.assignment) ?? [])
      : [];
  const weights =
    row.type === "assignment"
      ? (policy.skillWeights[row.assignment] ?? {})
      : {};

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-1.5 gap-y-1 border-t py-1.5 text-sm first:border-t-0">
      {row.type === "skill" ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <KindTag>Skill</KindTag>
          <span className="truncate">{name}</span>
        </span>
      ) : skills.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 items-center gap-1 text-left hover:underline hover:decoration-dotted hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate">{name}</span>
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{name}</span>
          {row.type === "assignment" && known.points.has(row.assignment) ? (
            <KindTag>Points</KindTag>
          ) : null}
        </span>
      )}
      {row.type === "skill" ? (
        <ChoiceField
          label={`Which rating of ${name} counts`}
          value={row.count}
          options={COUNT}
          onChange={(count) => onRow({ ...row, count })}
          readOnly={readOnly}
        />
      ) : (
        <span />
      )}
      {weighted ? (
        <NumberField
          label={`Weight of ${name}`}
          value={row.weight}
          onChange={(weight) => onRow({ ...row, weight })}
          readOnly={readOnly}
        />
      ) : (
        <span />
      )}
      {readOnly ? (
        <span />
      ) : (
        <RemoveButton label={`Remove ${name}`} onClick={onRemove} />
      )}
      {row.type === "skill" ? (
        <span className="col-span-full flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
          From
          <ChoiceField
            label={`Which work ${name} counts from`}
            value={row.from}
            options={FROM}
            onChange={(from) => onRow({ ...row, from })}
            readOnly={readOnly}
            className="h-7 text-xs"
          />
        </span>
      ) : null}
      {row.type === "assignment" && open && skills.length > 0 ? (
        <div className="col-span-full ml-1.5 grid gap-1 border-l-2 py-1 pl-2.5 text-muted-foreground">
          {skills.map((skill) => (
            <div
              key={skill.standard}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5"
            >
              <span className="truncate">{skill.name}</span>
              <NumberField
                label={`Weight of ${skill.name} in ${name}`}
                value={weights[skill.standard] ?? 1}
                onChange={(weight) =>
                  onChange({
                    ...policy,
                    skillWeights: {
                      ...policy.skillWeights,
                      [row.assignment]: {
                        ...weights,
                        [skill.standard]: weight,
                      },
                    },
                  })
                }
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

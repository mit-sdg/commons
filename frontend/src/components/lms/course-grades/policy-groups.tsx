"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
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
import { changed, type StepProps } from "./policy-settings";

type Combine = PolicyGroup["combine"];
type SkillRow = Extract<PolicyRow, { type: "skill" }>;

const COMBINE: [Combine, string][] = [
  ["average", "Average"],
  ["best", "Best"],
  ["dropLowest", "Drop lowest"],
];

/** How a group combines its rows, named only when it isn't Average. */
const COMBINED: Record<Combine, string> = {
  average: "",
  best: "best row counts",
  dropLowest: "lowest row left out",
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

/** A neutral tone per group, for its swatch and its part of the weight bar. */
const TONES = ["bg-foreground/60", "bg-foreground/35", "bg-foreground/20"];
const tone = (index: number) => TONES[index % TONES.length];

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

/** Each group's share of the average, and each row's when the group averages its rows. */
interface Shares {
  group: PolicyGroup;
  share: number;
  rows: { row: PolicyRow; share: number | null }[];
}

function sharesOf(policy: CoursePolicy): Shares[] {
  const total = policy.groups.reduce((sum, group) => sum + group.weight, 0);
  return policy.groups.map((group) => {
    const share = total > 0 ? (group.weight / total) * 100 : 0;
    const rowTotal = group.rows.reduce((sum, row) => sum + row.weight, 0);
    return {
      group,
      share,
      rows: group.rows.map((row) => ({
        row,
        share:
          group.combine === "average" && rowTotal > 0
            ? (share * row.weight) / rowTotal
            : null,
      })),
    };
  });
}

/** "14%", or "14.3%" when it isn't whole. */
function percent(share: number | null): string {
  if (share === null) return "";
  const whole = Math.round(share);
  return `${Math.abs(share - whole) < 0.05 ? whole : share.toFixed(1)}%`;
}

const rowKey = (row: PolicyRow) => row.key;

/** The whole average as one bar, split into groups and their rows. */
function WeightBar({
  shares,
  lit,
  onLight,
}: {
  shares: Shares[];
  lit: string | null;
  onLight: (key: string | null) => void;
}) {
  const dim = (key: string, group: string) =>
    lit !== null && lit !== key && lit !== group && "opacity-30";
  return (
    <div className="grid gap-1">
      <div aria-hidden className="flex h-3.5 gap-[3px]">
        {shares.map(({ group, share, rows }, index) => (
          <div
            key={group.key}
            className="flex min-w-0 gap-[1.5px]"
            style={{ flex: `${Math.max(share, 0.01)} 1 0` }}
          >
            {rows.length > 0 && rows.every((entry) => entry.share !== null) ? (
              rows.map(({ row }) => (
                <span
                  key={row.key}
                  onMouseEnter={() => onLight(rowKey(row))}
                  onMouseLeave={() => onLight(null)}
                  className={cn(
                    "min-w-0.5 rounded-[3px] transition-opacity",
                    tone(index),
                    dim(row.key, group.key),
                  )}
                  style={{ flex: `${Math.max(row.weight, 0.01)} 1 0` }}
                />
              ))
            ) : (
              <span
                onMouseEnter={() => onLight(group.key)}
                onMouseLeave={() => onLight(null)}
                className={cn(
                  "flex-1 rounded-[3px] transition-opacity",
                  tone(index),
                  dim(group.key, group.key),
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The policy's groups: each with a name, a weight, how it combines, and its rows. */
export function PolicyGroups({
  inputs,
  policy,
  saved,
  onChange,
  readOnly,
}: StepProps & { inputs: CourseGradeInputs }) {
  const [editing, setEditing] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const edit = editing && !readOnly;
  const known = useMemo(() => catalog(inputs), [inputs]);
  const shares = sharesOf(policy);
  const nameOf = (row: PolicyRow) =>
    row.type === "assignment"
      ? (known.title.get(row.assignment) ?? "Removed assignment")
      : (known.skillName.get(row.standard) ?? row.standard);
  const setGroups = (groups: PolicyGroup[]) => onChange({ ...policy, groups });
  const lightable = (key: string) => ({
    onMouseEnter: () => setLit(key),
    onMouseLeave: () => setLit(null),
  });
  const litRow = (key: string, group: string) =>
    lit !== null && (lit === key || lit === group) && "bg-foreground/[0.05]";

  return (
    <PolicySection
      step={2}
      title="Groups"
      hint={
        <div className="grid gap-2">
          <p>
            The average weighs each group by its weight. Average weighs a
            group&apos;s rows by their weights, Best takes the highest row, and
            Drop lowest leaves out the lowest row.
          </p>
          <p>
            A row is an assignment, or one skill followed across the term. Team
            work is Final project work. Personal work is the rest.
          </p>
        </div>
      }
      edited={changed(saved, policy, (p) => [p.groups, p.skillWeights])}
      editing={edit}
      onEditing={readOnly ? undefined : setEditing}
    >
      <WeightBar shares={shares} lit={lit} onLight={setLit} />
      {edit ? (
        <div className="grid gap-3">
          {shares.map((entry, index) => (
            <Group
              key={entry.group.key}
              index={index}
              entry={entry}
              known={known}
              nameOf={nameOf}
              policy={policy}
              onChange={onChange}
              onGroup={(next) =>
                setGroups(
                  policy.groups.map((group) =>
                    group.key === next.key ? next : group,
                  ),
                )
              }
              onRemove={() =>
                setGroups(
                  policy.groups.filter(
                    (group) => group.key !== entry.group.key,
                  ),
                )
              }
              lit={litRow}
              lightable={lightable}
            />
          ))}
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
      ) : (
        <div className="grid gap-2.5 text-sm">
          {shares.map(({ group, share, rows }, index) => (
            <div key={group.key} className="grid">
              <div
                {...lightable(group.key)}
                className={cn(
                  "flex items-baseline gap-2 rounded py-0.5",
                  litRow(group.key, group.key),
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 self-center rounded-[3px]",
                    tone(index),
                  )}
                />
                <b className="font-semibold">{group.name || "Group"}</b>
                <span className="text-xs text-muted-foreground">
                  {COMBINED[group.combine]}
                </span>
                <span className="ml-auto font-semibold tabular-nums">
                  {percent(share)}
                </span>
              </div>
              {rows.map(({ row, share: rowShare }) => (
                <div
                  key={row.key}
                  {...lightable(row.key)}
                  className={cn(
                    "ml-4 flex items-baseline gap-2 rounded py-0.5",
                    litRow(row.key, group.key),
                  )}
                >
                  <span className="min-w-0">
                    {nameOf(row)}
                    {row.type === "skill" ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        {COUNT.find(
                          ([count]) => count === row.count,
                        )?.[1].toLowerCase()}{" "}
                        rating, from{" "}
                        {FROM.find(([from]) => from === row.from)?.[1]}
                      </span>
                    ) : null}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {percent(rowShare)}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {policy.groups.length === 0 ? (
            <p className="text-muted-foreground">None</p>
          ) : null}
        </div>
      )}
    </PolicySection>
  );
}

type Light = (key: string) => {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

function Group({
  index,
  entry,
  known,
  nameOf,
  policy,
  onChange,
  onGroup,
  onRemove,
  lit,
  lightable,
}: {
  index: number;
  entry: Shares;
  known: Catalog;
  nameOf: (row: PolicyRow) => string;
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  onGroup: (group: PolicyGroup) => void;
  onRemove: () => void;
  lit: (key: string, group: string) => string | false;
  lightable: Light;
}) {
  const { group, share, rows } = entry;
  const name = group.name || "Group";
  const setRows = (next: PolicyRow[]) => onGroup({ ...group, rows: next });
  const inGroup = new Set(
    group.rows.map((row) =>
      row.type === "assignment" ? row.assignment : `skill:${row.standard}`,
    ),
  );

  return (
    <div className="grid gap-0.5">
      <div
        {...lightable(group.key)}
        className={cn(
          "group/item grid grid-cols-[0.625rem_minmax(0,1fr)_auto_auto_2.75rem_1.5rem] items-center gap-1.5 rounded",
          lit(group.key, group.key),
        )}
      >
        <span
          aria-hidden
          className={cn("size-2.5 rounded-[3px]", tone(index))}
        />
        <TextField
          label="Group name"
          value={group.name}
          onChange={(value) => onGroup({ ...group, name: value })}
          readOnly={false}
          className="font-semibold"
        />
        <ChoiceField
          label={`Combine the rows of ${name}`}
          value={group.combine}
          options={COMBINE}
          onChange={(combine) => onGroup({ ...group, combine })}
          readOnly={false}
          quiet
        />
        <NumberField
          label={`Weight of ${name}`}
          value={group.weight}
          onChange={(weight) => onGroup({ ...group, weight })}
          readOnly={false}
        />
        <span className="text-right text-xs text-muted-foreground tabular-nums">
          {percent(share)}
        </span>
        <RemoveButton label={`Remove ${name}`} onClick={onRemove} />
      </div>
      <ul className="ml-4 grid">
        {rows.map(({ row, share: rowShare }) => (
          <Row
            key={row.key}
            row={row}
            share={rowShare}
            weighted={group.combine !== "best"}
            name={nameOf(row)}
            known={known}
            policy={policy}
            onChange={onChange}
            onRow={(next) =>
              setRows(
                group.rows.map((entry) =>
                  entry.key === row.key ? next : entry,
                ),
              )
            }
            onRemove={() =>
              setRows(group.rows.filter((entry) => entry.key !== row.key))
            }
            className={cn(lit(row.key, group.key) || undefined)}
            light={lightable(row.key)}
          />
        ))}
      </ul>
      <div className="ml-4">
        <AddPicker
          said="+ Add"
          label={`Add to ${name}`}
          groups={[
            {
              label: "Assignments",
              options: known.assignments
                .filter((entry) => !inGroup.has(entry.assignment))
                .map((entry) => [`a:${entry.assignment}`, entry.title]),
            },
            {
              label: "A skill across the term",
              options: known.skills
                .filter((skill) => !inGroup.has(`skill:${skill.standard}`))
                .map((skill) => [`s:${skill.standard}`, skill.name]),
            },
          ]}
          onPick={(picked) => {
            const id = picked.slice(2);
            setRows([
              ...group.rows,
              picked.startsWith("a:")
                ? {
                    key: newKey("r"),
                    type: "assignment",
                    assignment: id,
                    weight: 1,
                  }
                : {
                    key: newKey("r"),
                    type: "skill",
                    standard: id,
                    weight: 1,
                    count: "latest",
                    from: "personal",
                  },
            ]);
          }}
        />
      </div>
    </div>
  );
}

function Row({
  row,
  share,
  weighted,
  name,
  known,
  policy,
  onChange,
  onRow,
  onRemove,
  className,
  light,
}: {
  row: PolicyRow;
  share: number | null;
  /** Whether row weights count: not under Best. */
  weighted: boolean;
  name: string;
  known: Catalog;
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  onRow: (row: PolicyRow) => void;
  onRemove: () => void;
  className?: string;
  light: ReturnType<Light>;
}) {
  const [open, setOpen] = useState(false);
  const skills =
    row.type === "assignment" && !known.points.has(row.assignment)
      ? (known.skillsOf.get(row.assignment) ?? [])
      : [];
  const weights =
    row.type === "assignment"
      ? (policy.skillWeights[row.assignment] ?? {})
      : {};

  return (
    <li
      {...light}
      className={cn(
        "group/item grid grid-cols-[minmax(0,1fr)_auto_2.75rem_1.5rem] items-center gap-x-1.5 gap-y-0.5 rounded py-0.5 text-sm",
        className,
      )}
    >
      {row.type === "skill" ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <KindTag>Skill</KindTag>
          <span className="truncate">{name}</span>
        </span>
      ) : skills.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Skill weights of ${name}`}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 items-center gap-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
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
        <span className="flex min-w-0 items-center gap-1.5 pl-4">
          <span className="truncate">{name}</span>
          {row.type === "assignment" && known.points.has(row.assignment) ? (
            <KindTag>Points</KindTag>
          ) : null}
        </span>
      )}
      {weighted ? (
        <NumberField
          label={`Weight of ${name}`}
          value={row.weight}
          onChange={(weight) => onRow({ ...row, weight })}
          readOnly={false}
        />
      ) : (
        <span />
      )}
      <span className="text-right text-xs text-muted-foreground tabular-nums">
        {percent(share)}
      </span>
      <RemoveButton label={`Remove ${name}`} onClick={onRemove} />
      {row.type === "skill" ? (
        <span className="col-span-full flex flex-wrap items-center gap-1 pl-1 text-xs text-muted-foreground">
          <ChoiceField
            label={`Which rating of ${name} counts`}
            value={row.count}
            options={COUNT}
            onChange={(count) => onRow({ ...row, count })}
            readOnly={false}
            quiet
            className="h-6 text-xs"
          />
          rating, from
          <ChoiceField
            label={`Which work ${name} counts from`}
            value={row.from}
            options={FROM}
            onChange={(from) => onRow({ ...row, from })}
            readOnly={false}
            quiet
            className="h-6 text-xs"
          />
        </span>
      ) : null}
      {row.type === "assignment" && open && skills.length > 0 ? (
        <div className="col-span-full mb-1 ml-1.5 grid gap-1 border-l-2 py-1 pl-2.5 text-muted-foreground">
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
                readOnly={false}
              />
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

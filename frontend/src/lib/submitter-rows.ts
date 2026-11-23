import type { Output } from "./api";
import type { AssignedLearner, ItemAssessment } from "./submissions-export";

type Unmoved = Output<"/submissions/for-assignment">["unmoved"][number];

/**
 * One row of an assignment's staff page: a team with its members, or one
 * student. A row reads as an assigned learner whose `assignee` is the
 * submitter, the id that attempts, grades, and delegations carry, so the
 * lists that take assigned learners count a team once.
 */
export type SubmitterRow = AssignedLearner & {
  team: boolean;
  /** A student whose seat has no team, on an assignment each team submits. */
  noTeam: boolean;
  members: AssignedLearner[];
  /** The member a request names; the routes answer for whoever submits for them. */
  through: string;
};

function latest(dates: readonly (string | null)[]): string | null {
  return dates.reduce<string | null>(
    (held, date) =>
      date !== null && (held === null || new Date(date) > new Date(held))
        ? date
        : held,
    null,
  );
}

/** Teams by name, then the students who submit on their own in the order given. */
export function submitterRows(
  assigned: readonly AssignedLearner[],
  teamNames: ReadonlyMap<string, string>,
  byTeam: boolean,
): SubmitterRow[] {
  const members = new Map<string, AssignedLearner[]>();
  for (const learner of assigned) {
    const submitter = String(learner.submitter);
    members.set(submitter, [...(members.get(submitter) ?? []), learner]);
  }
  const rows = [...members].map(([submitter, group]): SubmitterRow => {
    const first = group[0] as AssignedLearner;
    const through =
      group.find((member) => member.enrolment !== "DROPPED") ?? first;
    if (submitter === String(first.assignee))
      return {
        ...first,
        team: false,
        noTeam: byTeam,
        members: group,
        through: submitter,
      };
    return {
      ...first,
      assignee: submitter as AssignedLearner["assignee"],
      displayName: teamNames.get(submitter) ?? null,
      username: null,
      email: null,
      enrolment: through.enrolment,
      dueOverride: latest(group.map((member) => member.dueOverride)),
      team: true,
      noTeam: false,
      members: group,
      through: String(through.assignee),
    };
  });
  return [
    ...rows
      .filter((row) => row.team)
      .sort((left, right) =>
        (left.displayName ?? "").localeCompare(
          right.displayName ?? "",
          undefined,
          { numeric: true },
        ),
      ),
    ...rows.filter((row) => !row.team),
  ];
}

/** The submissions handed in before the assignment changed to each team, and how many each team waits on. */
export function earlierSubmissions(unmoved: readonly Unmoved[]): {
  submissions: number;
  teams: number;
  ofTeam: ReadonlyMap<string, number>;
} {
  const ofTeam = new Map<string, number>();
  for (const { section } of unmoved)
    ofTeam.set(String(section), (ofTeam.get(String(section)) ?? 0) + 1);
  return { submissions: unmoved.length, teams: ofTeam.size, ofTeam };
}

function said(grade: ItemAssessment): string {
  return grade.method === "POINTS" && grade.scored
    ? `${grade.score} / ${grade.outOf}`
    : JSON.stringify(grade.judgments);
}

/**
 * The drafts on one row's attempts when they disagree, oldest attempt first:
 * two members graded apart before their work moved to the team. Empty when
 * the row has one draft or its drafts agree.
 */
export function draftsThatDiffer(
  grades: readonly ItemAssessment[],
  learner: string,
): ItemAssessment[] {
  const drafts = grades
    .filter(
      (grade) =>
        String(grade.learner) === learner &&
        grade.status === "DRAFT" &&
        grade.evidence !== "",
    )
    .sort((left, right) => (left.attempt ?? 0) - (right.attempt ?? 0));
  return new Set(drafts.map(said)).size > 1 ? drafts : [];
}

/** What releasing every draft reaches: the drafts, their rows, and the students who read them. */
export function releaseReach(
  rows: readonly SubmitterRow[],
  grades: readonly ItemAssessment[],
): { drafts: number; teams: number; students: number; differing: string[] } {
  const drafts = grades.filter((grade) => grade.status === "DRAFT");
  const reached = rows.filter((row) =>
    drafts.some((grade) => String(grade.learner) === String(row.assignee)),
  );
  return {
    drafts: drafts.filter((grade) =>
      reached.some((row) => String(row.assignee) === String(grade.learner)),
    ).length,
    teams: reached.filter((row) => row.team).length,
    students: reached.reduce(
      (sum, row) =>
        sum +
        row.members.filter((member) => member.enrolment !== "DROPPED").length,
      0,
    ),
    differing: reached
      .filter(
        (row) => draftsThatDiffer(grades, String(row.assignee)).length > 0,
      )
      .map((row) => row.displayName ?? String(row.assignee)),
  };
}

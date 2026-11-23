import type { Output } from "./api";

/** The team that submits an assignment for a student, with its current members. */
export type Team = NonNullable<
  Extract<Output<"/assignments/get">, { team: unknown }>["team"]
>;

export function submittedByTeam(assignment: {
  submittedBy?: string | null;
}): boolean {
  return assignment.submittedBy === "SECTION";
}

/** Whose attempts and grades a student reads: the team's, or the student's own. */
export function submitterOf(
  student: string,
  team: Team | null | undefined,
): string {
  return team ? String(team.section) : student;
}

export function teamName(
  teams: readonly { section: unknown; name: unknown }[] | undefined,
  team: unknown,
): string | null {
  const found = teams?.find((entry) => String(entry.section) === String(team));
  return found ? String(found.name) : null;
}

/** Teams by id, for naming the team a grade belongs to. */
export function teamNamesOf(
  teams: readonly { section: unknown; name: unknown }[] | undefined,
): ReadonlyMap<string, string> {
  return new Map(
    (teams ?? []).map((team) => [String(team.section), String(team.name)]),
  );
}

export const ALL_GRADERS = "all";
export const MY_GRADING = "mine";
export const UNASSIGNED = "unassigned";
const GRADER_PREFIX = "grader:";

export type GraderFilter =
  | typeof ALL_GRADERS
  | typeof MY_GRADING
  | typeof UNASSIGNED
  | `grader:${string}`;

export function filterForGrader(grader: string): GraderFilter {
  return `${GRADER_PREFIX}${grader}`;
}

export function graderFromFilter(filter: GraderFilter): string | null {
  return filter.startsWith(GRADER_PREFIX)
    ? filter.slice(GRADER_PREFIX.length)
    : null;
}

export function learnerMatchesGraderFilter(
  learner: string,
  filter: GraderFilter,
  byLearner: ReadonlyMap<string, string>,
  currentUser: string | null,
): boolean {
  const owner = byLearner.get(learner);
  if (filter === ALL_GRADERS) return true;
  if (filter === MY_GRADING)
    return currentUser !== null && owner === currentUser;
  if (filter === UNASSIGNED) return owner === undefined;
  return owner === graderFromFilter(filter);
}

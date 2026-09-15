/** Whether a distinct, non-empty selection is entirely present in a current-state answer. */
export function allChosenAdmitted({
  chosen,
  admitted,
}: {
  chosen: string[];
  admitted: string[];
}): boolean {
  if (!Array.isArray(chosen) || chosen.length === 0) return false;
  if (chosen.some((name) => typeof name !== "string" || name === "")) return false;
  if (new Set(chosen).size !== chosen.length) return false;
  const answered = new Set(Array.isArray(admitted) ? admitted : []);
  return chosen.every((name) => answered.has(name));
}

/** Validate untrusted batch fields before any concept query receives them. */
export function validDelegationSpreadInput({
  item,
  learners,
  graders,
  replace,
}: {
  item: string;
  learners: string[];
  graders: string[];
  replace: boolean;
}): boolean {
  const selection = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry !== "") &&
    new Set(value).size === value.length;
  return (
    typeof item === "string" &&
    item !== "" &&
    selection(learners) &&
    selection(graders) &&
    typeof replace === "boolean"
  );
}

/** Reject non-string Mongo selector values before identity reads receive them. */
export function validDelegationIdentityInput({
  item,
  learner,
  grader,
}: {
  item: string;
  learner?: string;
  grader?: string;
}): boolean {
  return [item, learner, grader].every(
    (value) => value === undefined || (typeof value === "string" && value !== ""),
  );
}

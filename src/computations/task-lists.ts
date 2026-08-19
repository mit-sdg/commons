/**
 * A task list is identified by the set of profiles it is for. These pure
 * computations turn that set into the one canonical name the list is stored
 * under, and back, so the same people never reach two different lists.
 */
const SEPARATOR = " ";

const canonical = (members: readonly string[]): string[] =>
  [...new Set(members.filter((member) => member !== ""))].sort();

export function taskListMembers({ key }: { key: string }): string[] {
  return key === "" ? [] : key.split(SEPARATOR);
}

export function taskListKey({ members }: { members: string[] }): string {
  return canonical(members).join(SEPARATOR);
}

export function taskListExtension({ key, members }: { key: string; members: string[] }): string {
  return taskListKey({ members: [...taskListMembers({ key }), ...members] });
}

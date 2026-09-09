export const ASSIGNMENT_TYPES = {
  EXERCISE: "Exercise",
  PERSONAL_PROJECT: "Personal Project",
  FINAL_PROJECT: "Final Project",
  PREP: "Prep",
  ADMIN: "Administrative",
} as const;
export function assignmentTypeLabel(kind: string) {
  return ASSIGNMENT_TYPES[kind as keyof typeof ASSIGNMENT_TYPES] ?? kind;
}

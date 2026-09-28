import { type Level, type NOT_ASSESSED, scoreText } from "@/lib/grade-analysis";

export type Rating = Level | typeof NOT_ASSESSED;

export const LEVEL_NAMES: Record<Rating, string> = {
  DEFICIENT: "Deficient",
  EMERGENT: "Emergent",
  COMPETENT: "Competent",
  EXPERT: "Expert",
  NOT_ASSESSED: "Not assessed",
};

export const LEVEL_FILL: Record<Level, string> = {
  DEFICIENT: "bg-level-deficient",
  EMERGENT: "bg-level-emergent",
  COMPETENT: "bg-level-competent",
  EXPERT: "bg-level-expert",
};

export const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const ROW_GRID = "sm:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)_10rem]";

export const EACH_PAPER = 40;

export const NO_GRADER = "none";

export function score(value: number | null): string {
  return value === null ? "" : scoreText(value);
}

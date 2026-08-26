/**
 * Position arithmetic for the quizzes surface. Questions stand contiguously,
 * counting from one, so a place is always reckoned from a neighbor or from the
 * count of what stands.
 */

export function positionAfter({ position }: { position: number }): number {
  return position + 1;
}

export function positionBefore({ position }: { position: number }): number {
  return position - 1;
}

/**
 * Name the kind of feedback a submitted answer can receive. Choice answers
 * with a standard are graded; written answers with a standard carry a
 * reference; everything else is deliberately ungraded.
 */
export function receiptKind({
  choices,
  expected,
}: {
  choices: string[];
  expected: string;
}): "graded" | "reference" | "ungraded" {
  if (expected === "") return "ungraded";
  return choices.length > 0 ? "graded" : "reference";
}

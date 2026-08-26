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

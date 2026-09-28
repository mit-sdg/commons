/** Layers a pile reaches before the row's piles spread sideways. */
export const LAYERS = 12;

/** Layers past which a pile folds its highest scores into a count. */
export const MOST_LAYERS = 24;

/** The widest a pile spreads when nothing sits beside it. */
const MOST_ACROSS = 12;

export interface Pile<P> {
  /** Where the pile sits, as a share of the axis. */
  x: number;
  papers: P[];
}

/**
 * A row's papers as piles. Each score is its own pile while the scores sit at
 * least a dot apart on `reference` (the class row, for a grader's row);
 * closer than that, they share piles a dot wide, so no two dots overlap.
 */
export function pilesOf<P extends { score: number }>(
  papers: readonly P[],
  max: number,
  width: number,
  pitch: number,
  reference: readonly { score: number }[] = papers,
): Pile<P>[] {
  const values = [...new Set(reference.map((paper) => paper.score))].sort(
    (left, right) => left - right,
  );
  const apart = values.every(
    (value, index) =>
      index === 0 ||
      ((value - (values[index - 1] as number)) / max) * width >= pitch,
  );
  const slots = Math.max(1, Math.floor(width / pitch));
  const place = (value: number) =>
    max <= 0
      ? 0
      : width <= 0 || apart
        ? value / max
        : Math.round((value / max) * slots) / slots;
  const piles = new Map<number, P[]>();
  for (const paper of [...papers].sort(
    (left, right) => left.score - right.score,
  )) {
    const x = place(paper.score);
    piles.set(x, [...(piles.get(x) ?? []), paper]);
  }
  return [...piles.entries()].map(([x, own]) => ({ x, papers: own }));
}

/**
 * Where a pile `across` dots wide starts, in pixels: centred on its score, so
 * a pile at either end overhangs the axis, by two dots at most.
 */
export function leftOf(
  x: number,
  across: number,
  width: number,
  pitch: number,
) {
  const block = across * pitch;
  return Math.min(
    Math.max(x * width - block / 2, -2 * pitch),
    width - block + 2 * pitch,
  );
}

/**
 * How many dots wide every pile in a row is: one while no pile passes
 * `LAYERS`, else just wide enough, and never so wide that neighbouring piles
 * come within half a dot. One width for the row keeps a pile's height its
 * count.
 */
export function acrossOf(
  piles: readonly Pile<unknown>[],
  width: number,
  pitch: number,
): number {
  const tallest = Math.max(0, ...piles.map((pile) => pile.papers.length));
  if (width <= 0 || tallest <= LAYERS) return 1;
  const fits = (across: number) =>
    piles.every(
      (pile, index) =>
        index === 0 ||
        leftOf(pile.x, across, width, pitch) >=
          leftOf((piles[index - 1] as Pile<unknown>).x, across, width, pitch) +
            (across + 0.5) * pitch,
    );
  let across = Math.min(Math.ceil(tallest / LAYERS), MOST_ACROSS);
  while (across > 1 && !fits(across)) across -= 1;
  return across;
}

/**
 * The most layers any pile in the row reaches: a pile below it stacks one dot
 * wide, as in a small class, and a pile that would pass it spreads sideways.
 */
export function ceilingOf(piles: readonly Pile<unknown>[], across: number) {
  const tallest = Math.max(1, ...piles.map((pile) => pile.papers.length));
  return Math.min(Math.ceil(tallest / across), MOST_LAYERS);
}

/** A pile's dots, how many to a layer, and what folds into its count. */
export function layoutOf<P>(
  papers: readonly P[],
  ceiling: number,
  across: number,
) {
  if (papers.length <= ceiling * across)
    return {
      shown: papers,
      folded: [] as P[],
      wide: Math.max(1, Math.ceil(papers.length / ceiling)),
    };
  const cut = (ceiling - 1) * across;
  return {
    shown: papers.slice(0, cut),
    folded: papers.slice(cut),
    wide: across,
  };
}

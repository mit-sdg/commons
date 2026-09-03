/**
 * The shapes the relay screens build on: the wall, its cards and piles, the
 * relay run, and its rounds. Each is an alias of the generated wire type, so a
 * change to a former reaches the screens through the compiler.
 */

import type { Output } from "@/lib/api";

/** Done, open, and next are a run's standings; plain is a round that is only written. */
export type RoundStanding = "done" | "open" | "next" | "plain";

export type Wall = NonNullable<Output<"/live/walls/read">["wall"]>;
export type WallCard = Wall["cards"][number];
export type WallPile = Wall["piles"][number];
export type WallQuestion = Wall["questions"][number];

export type RelayRun = NonNullable<Output<"/live/relays/run">["run"]>;
export type RelayRunRound = RelayRun["rounds"][number];

export type Relay = NonNullable<Output<"/live/relays/get">["relay"]>;
export type RelayRound = Relay["rounds"][number];
export type RelayTake = RelayRound["takes"][number];

export interface RoundRef {
  leg: string;
  number: number;
  title: string;
}

/** Which of done, open, or next a round is, from whether it ran and whether it is still open. */
export function standingOf(round: {
  round: string | null;
  open: boolean | null;
}): RoundStanding {
  if (round.round === null) return "next";
  return round.open ? "open" : "done";
}

/** The standing of a run's round, whose openness sits under its figure. */
export function roundStanding(round: RelayRunRound): RoundStanding {
  return standingOf({ round: round.round, open: round.figure.open });
}

/** A pile carries into a later round when the pick names it. */
export function isPicked(pile: WallPile): boolean {
  return pile.picked !== null;
}

/** Piles fullest first, ties in the order they were opened. */
export function pilesByCount<Pile extends { count: number }>(
  piles: Pile[],
): Pile[] {
  return piles
    .map((pile, index) => ({ pile, index }))
    .sort(
      (left, right) =>
        right.pile.count - left.pile.count || left.index - right.index,
    )
    .map(({ pile }) => pile);
}

/** The cards of one pile, in the order they landed. */
export function cardsIn(cards: WallCard[], pile: string): WallCard[] {
  return cards.filter((card) => card.pile === pile);
}

export function trayOf(cards: WallCard[]): WallCard[] {
  return cards.filter((card) => card.pile === null);
}

/** A round holds one question; the wall carries it as the captured presentation does. */
export function questionOf(wall: Wall): WallQuestion | null {
  return wall.questions[0] ?? null;
}

export function promptOf(wall: Wall): string {
  return questionOf(wall)?.prompt ?? "";
}

export function choicesOf(wall: Wall): string[] {
  return questionOf(wall)?.choices ?? [];
}

/** Every pile the staff member tapped, as the pick endpoint takes them. */
export function pickedPiles(wall: Wall): string[] {
  return wall.piles.filter(isPicked).map((pile) => pile.pile);
}

/** How many cards a model participant wrote. */
export function modelCards(wall: Wall): number {
  return wall.cards.filter((card) => card.model).length;
}

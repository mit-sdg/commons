"use client";

/**
 * The shapes the relay screens build on: the wall, its cards and piles, the
 * relay run, and its rounds. Each is an alias of the generated wire type, so a
 * change to a former reaches the screens through the compiler.
 */

import { useEffect, useState } from "react";
import { saidRefusal } from "@/components/live/refusals";
import { api, isApiError, type Output } from "@/lib/api";

/** Why a relay cannot launch yet, said the way a questionnaire says its own. */
export const NO_ROUNDS = "Add a round first.";

/** What a refused launch says, wherever a screen offers one. */
export function launchRefusal(error: string): string {
  return saidRefusal(error, error === "CONFLICT" ? "NO_CHOICES" : null);
}

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

/**
 * Which of done, open, or next a round of a run is. Open and opening are the
 * run's to say: one read is not taken at one moment, so a round's own flag can
 * read open before the run names it, and until then the round has not opened.
 * A round left opening is still the one Open offers.
 */
export function standingInRun(
  run: { openRound: string | null; opening?: string | null },
  round: { round: string | null; open: boolean | null },
): RoundStanding {
  if (round.round === null) return "next";
  if (round.round === run.openRound) return "open";
  return round.open === false && round.round !== run.opening ? "done" : "next";
}

/** The round the run names open to the room, among its rounds. */
export function openEntryOf<Round extends { round: string | null }>(run: {
  openRound: string | null;
  rounds: Round[];
}): Round | null {
  if (run.openRound === null) return null;
  return run.rounds.find((round) => round.round === run.openRound) ?? null;
}

/**
 * The open round a phone has on its screen, for the run's room to count: its
 * question to answer or its receipt, once the phone's own state belongs to
 * that round and its join has been answered or its hand-in stands. A round
 * still opening on the phone, or state the round before left behind, is "".
 */
export function roundOnScreen(phone: {
  /** The round the run has open, or null. */
  round: string | null;
  runOpen: boolean;
  /** The round the phone's response and hand-in belong to. */
  inHand: string | null;
  joined: boolean;
  handedIn: boolean;
}): string {
  const { round, runOpen, inHand, joined, handedIn } = phone;
  return round !== null && runOpen && inHand === round && (joined || handedIn)
    ? round
    : "";
}

/** The standing of a run's round, whose closing sits under its figure. */
export function roundStanding(
  run: Pick<RelayRun, "openRound" | "opening">,
  round: RelayRunRound,
): RoundStanding {
  return standingInRun(run, { round: round.round, open: round.figure.open });
}

/**
 * The closed round whose wall stands once no round is open: the one closed
 * last, passing over a round read to have no wall, which closed while it was
 * still opening.
 */
export function lastClosedWall(
  run: Pick<RelayRun, "openRound" | "opening" | "rounds">,
  wallless: ReadonlySet<string>,
): string | null {
  let latest: RelayRunRound | null = null;
  for (const round of run.rounds) {
    if (
      round.round === null ||
      wallless.has(round.round) ||
      roundStanding(run, round) !== "done"
    )
      continue;
    if (
      latest === null ||
      (round.figure.closedAt ?? "") > (latest.figure.closedAt ?? "")
    )
      latest = round;
  }
  return latest?.round ?? null;
}

/**
 * The rounds read to have no wall, once one more read of a round's wall has
 * answered: a round answered with none has none, and one answered with a wall
 * leaves the set. A read that changes nothing gives the same set back.
 */
export function afterWallRead(
  wallless: ReadonlySet<string>,
  round: string | null,
  answer: { wall: object | null } | null,
): ReadonlySet<string> {
  if (round === null || answer === null) return wallless;
  const none = answer.wall === null;
  if (none === wallless.has(round)) return wallless;
  const next = new Set(wallless);
  if (none) next.add(round);
  else next.delete(round);
  return next;
}

/** The three kinds a round is. */
export type RoundKind = "write" | "list" | "vote";

/** One row of the served table: a use, the kinds it is open to, and its sentence. */
export type CarryUse = Output<"/live/relays/uses">["uses"][number];

/** The kinds in the order the editor offers them. */
export const KINDS: RoundKind[] = ["write", "list", "vote"];

/**
 * The word the editor pressed, which the leg holds. A leg with no word is the
 * kind its content makes it: choices make a vote, parts make a list, and a
 * round with neither is a write.
 */
export function kindOf(round: {
  kind: string;
  choices: string[];
  parts: string[];
  takes: { use: string }[];
}): RoundKind {
  const pressed = KINDS.find((entry) => entry === round.kind);
  if (pressed !== undefined) return pressed;
  const use = round.takes[0]?.use;
  if (round.choices.length > 0 || use === "choices") return "vote";
  if (round.parts.length > 0 || use === "parts") return "list";
  return "write";
}

/** The uses open to a kind, in the order the table serves them. */
export function usesFor(uses: CarryUse[], kind: RoundKind): CarryUse[] {
  return uses.filter((entry) => entry.kinds.includes(kind));
}

/** The one sentence the table gives a use. */
export function sentenceOf(uses: CarryUse[], use: string): string {
  return uses.find((entry) => entry.use === use)?.sentence ?? "";
}

const FIRST_USE: Record<RoundKind, string> = {
  write: "context",
  list: "context",
  vote: "choices",
};

/** The use a kind takes when a source is first chosen, if the table opens it. */
export function firstUse(uses: CarryUse[], kind: RoundKind): string {
  const open = usesFor(uses, kind);
  const wanted = FIRST_USE[kind];
  return open.some((entry) => entry.use === wanted)
    ? wanted
    : (open[0]?.use ?? wanted);
}

let served: CarryUse[] | null = null;
let asking: Promise<CarryUse[]> | null = null;

/** The table of uses, read once and shared by every round on the page. */
export function useCarryUses(): CarryUse[] {
  const [uses, setUses] = useState<CarryUse[]>(served ?? []);

  useEffect(() => {
    if (served !== null) return;
    let live = true;
    const read = (asking ??= api["/live/relays/uses"]({}).then((result) =>
      isApiError(result) ? [] : result.uses,
    ));
    void read.then((table) => {
      if (table.length === 0) asking = null;
      else served = table;
      if (live) setUses(table);
    });
    return () => {
      live = false;
    };
  }, []);

  return uses;
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

/**
 * A group's values, each read once. A room writes the same word many times, so
 * a group that carries into a later round is shown as the words it holds.
 */
export function distinctValues(values: string[]): string[] {
  const read = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (read.has(key)) continue;
    read.add(key);
    kept.push(trimmed);
  }
  return kept;
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

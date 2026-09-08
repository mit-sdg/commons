/**
 * What a round may carry from an earlier one: the table of uses, one home for
 * the editor, the explainer, and the drafting passage; and the small reads the
 * capture makes of a source wall when a round shows what was picked.
 */

import { cardId } from "./live-rounds.ts";

/** The kinds a round can be: one box, several boxes, or choices. */
export type RoundKind = "write" | "list" | "vote";

/** The words a leg's kind may hold. */
export const KINDS: readonly RoundKind[] = ["write", "list", "vote"];

export interface CarryUse {
  /** The word Relaying's draw stores as its use. */
  use: "context" | "choices" | "parts";
  /** The kinds of round the use is open to. */
  kinds: RoundKind[];
  /** The one sentence the editor shows beside the use. */
  sentence: string;
}

export const CARRY_USES: readonly CarryUse[] = [
  {
    use: "context",
    kinds: ["write", "list", "vote"],
    sentence: "The picked piles appear above the prompt.",
  },
  { use: "choices", kinds: ["vote"], sentence: "The picked piles are the choices." },
  { use: "parts", kinds: ["list"], sentence: "The picked piles are the boxes, one each." },
];

export const USE_WORDS: readonly string[] = CARRY_USES.map((entry) => entry.use);

export function carryUses(_inputs: Record<string, never>): CarryUse[] {
  return [...CARRY_USES];
}

export function isCarryUse(use: string): use is CarryUse["use"] {
  return USE_WORDS.includes(use);
}

/**
 * Whether a use is open to the round as it stands: `open` when the leg's word
 * carries it, or, for a leg with no word, when its choices or parts make a kind
 * that carries it or it holds nothing yet and the take is what makes it a
 * kind; `closed` when the table shuts the use to that kind; `unknown` when the
 * word names no use.
 */
export function useFit({
  use,
  kind,
  choices,
  parts,
}: {
  use: string;
  kind: string;
  choices: string[];
  parts: string[];
}): string {
  if (!isCarryUse(use)) return "unknown";
  const entry = CARRY_USES.find((candidate) => candidate.use === use);
  const word = KINDS.find((candidate) => candidate === kind);
  if (word !== undefined)
    return entry !== undefined && entry.kinds.includes(word) ? "open" : "closed";
  // A leg with no word holding neither choices nor parts is the kind its take makes it.
  if (choices.length === 0 && parts.length === 0) return "open";
  const made = roundKind({ choices, parts, use: "" });
  return entry !== undefined && entry.kinds.includes(made) ? "open" : "closed";
}

/**
 * Whether a leg's kind can be launched: `bare` when the planner's word is
 * `vote` and the round offers no choice of its own, `filled` otherwise. A bare
 * vote that takes its choices from an earlier round is filled by the take,
 * which the view around this computation reads.
 */
export function voteStanding({ kind, choices }: { kind: string; choices: string[] }): string {
  return kind === "vote" && choices.length === 0 ? "bare" : "filled";
}

/**
 * The priority a pile picked after `count` others takes: the first pile picked
 * stands highest, so the picked read back in the order they were taken.
 */
export function pickPriority({ count }: { count: number }): number {
  return -count;
}

/** Whether a card is one of the wall's cards: `known` or `unknown`. */
/** How long a failed ask holds the sort tick before it asks again. */
const FAILURE_FRESH_MS = 30_000;

/** Whether a failure is fresh enough to hold the next ask, or stale enough to try again. */
export function failureStanding({ failedAt, at }: { failedAt: unknown; at: unknown }): string {
  const failed = new Date(String(failedAt)).getTime();
  const now = new Date(String(at)).getTime();
  if (Number.isNaN(failed) || Number.isNaN(now)) return "stale";
  return now - failed < FAILURE_FRESH_MS ? "fresh" : "stale";
}

export function cardStanding({ card, values }: { card: string; values: unknown }): string {
  const rows = Array.isArray(values) ? (values as { response?: unknown; item?: unknown }[]) : [];
  return rows.some(
    (row) =>
      typeof row.response === "string" &&
      typeof row.item === "string" &&
      cardId({ response: row.response, item: row.item }) === card,
  )
    ? "known"
    : "unknown";
}

/** Whether a request named a card at all: `given`, or `none` for a request that opens an empty pile. */
export function cardGiven({ card }: { card: string }): string {
  return card === "" ? "none" : "given";
}

/** Whether a request named a relay: `given`, or `none` for a request about the class itself. */
export function relayGiven({ relay }: { relay: string }): string {
  return relay === "" ? "none" : "given";
}

/** Whether a brief says anything: `given` or `blank`. */
export function briefStanding({ request }: { request: string }): string {
  return request.trim() === "" ? "blank" : "given";
}

/** The kind a round reads as, from what it offers and what it takes. */
export function roundKind({
  choices,
  parts,
  use,
}: {
  choices: string[];
  parts: string[];
  use: string;
}): RoundKind {
  if (choices.length > 0 || use === "choices") return "vote";
  if (parts.length > 0 || use === "parts") return "list";
  return "write";
}

interface PileWithItems {
  category: string;
  name: string;
  items: string[];
}

interface Value {
  response: string;
  item: string;
  value: string;
}

/**
 * Written cards keep the room's answers in hand-in order. A ballot instead
 * carries the examples attached to its original choice in the captured
 * question. The ballot text, not the pile's mutable name, identifies that
 * choice, so renaming and merging piles preserve their supporting examples.
 * Repeated ballots repeat no examples; repeated written answers remain.
 * An empty vote pile has no ballot identifying its original choice.
 */
export function pileCards({
  pile,
  categories,
  values,
  value,
}: {
  pile: string;
  categories: PileWithItems[];
  values: Value[];
  value: unknown;
}): string[] {
  const held = new Set(categories.find((entry) => entry.category === pile)?.items ?? []);
  const questions = ((value ?? {}) as Snapshot).questions ?? [];
  const examples = new Set<string>();
  const cards: string[] = [];
  for (const answer of values) {
    if (!held.has(cardId(answer))) continue;
    const question = questions.find((entry) => entry.item === answer.item);
    if (!(question?.choices ?? []).includes(answer.value)) {
      cards.push(answer.value);
      continue;
    }
    for (const source of question?.choiceSources ?? []) {
      if (source.name !== answer.value) continue;
      for (const card of source.cards) {
        if (examples.has(card)) continue;
        examples.add(card);
        cards.push(card);
      }
    }
  }
  return cards;
}

interface Snapshot {
  questions?: {
    item?: string;
    choices?: string[];
    choiceSources?: { name: string; cards: string[] }[];
  }[];
}

/** Whether an answer is one of the choices the round offered: `choice`, or `written`. */
export function answerKind({ value, answer }: { value: unknown; answer: string }): string {
  const questions = ((value ?? {}) as Snapshot).questions ?? [];
  const offered = questions.some((question) => (question.choices ?? []).includes(answer));
  return offered ? "choice" : "written";
}

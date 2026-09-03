/**
 * What a round may carry from an earlier one: the table of uses, one home for
 * the editor, the explainer, and the drafting passage; and the small reads the
 * capture makes of a source wall when a round shows what was picked.
 */

import { cardId } from "./live-rounds.ts";

/** The kinds a round can be, read off its question: one box, several boxes, or choices. */
export type RoundKind = "write" | "list" | "vote";

export interface CarryUse {
  /** The word Relaying's draw stores as its shape. */
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

/** Whether a word names a use this composition fills: `known` or `unknown`. */
export function useStanding({ use }: { use: string }): string {
  return isCarryUse(use) ? "known" : "unknown";
}

/**
 * Whether a use is open to the round as it stands: `open` when the round's kind
 * carries it, or the round holds nothing yet and the take is what makes it a
 * kind; `closed` when the table shuts it to the kind the round's choices or
 * parts already make it; `unknown` when the word names no use.
 */
export function useFit({
  use,
  choices,
  parts,
}: {
  use: string;
  choices: string[];
  parts: string[];
}): string {
  if (!isCarryUse(use)) return "unknown";
  // A round holding neither choices nor parts is the kind its take makes it.
  if (choices.length === 0 && parts.length === 0) return "open";
  const kind = roundKind({ choices, parts, use: "" });
  const entry = CARRY_USES.find((candidate) => candidate.use === use);
  return entry !== undefined && entry.kinds.includes(kind) ? "open" : "closed";
}

/** Which of the named piles stand on this wall, in the order named; the rest are dropped. */
export function pilesOnWall({
  piles,
  categories,
}: {
  piles: string[];
  categories: unknown;
}): string[] {
  const standing = new Set(
    (Array.isArray(categories) ? (categories as { category?: unknown }[]) : []).map((pile) =>
      typeof pile.category === "string" ? pile.category : "",
    ),
  );
  const named = Array.isArray(piles) ? piles.filter((pile) => typeof pile === "string") : [];
  return [...new Set(named)].filter((pile) => standing.has(pile));
}

/** Whether a card is one of the wall's cards: `known` or `unknown`. */
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

/** Mirrors the wall's card identity; the two must agree, so the wall's own is reused. */
/**
 * The values of a pile's cards, in the order the room handed them in. A card
 * that only repeats the pile's name — a ballot on a vote wall — says nothing
 * above the name and is left out.
 */
export function pileCards({
  pile,
  categories,
  values,
}: {
  pile: string;
  categories: PileWithItems[];
  values: Value[];
}): string[] {
  const held = new Set(categories.find((entry) => entry.category === pile)?.items ?? []);
  const name = categories
    .find((entry) => entry.category === pile)
    ?.name.trim()
    .toLowerCase();
  return values
    .filter(({ response, item }) => held.has(cardId({ response, item })))
    .map(({ value }) => value)
    .filter((value) => value.trim().toLowerCase() !== name);
}

interface Snapshot {
  questions?: { choices?: string[] }[];
}

/** Whether an answer is one of the choices the round offered: `choice`, or `written`. */
export function answerKind({ value, answer }: { value: unknown; answer: string }): string {
  const questions = ((value ?? {}) as Snapshot).questions ?? [];
  const offered = questions.some((question) => (question.choices ?? []).includes(answer));
  return offered ? "choice" : "written";
}

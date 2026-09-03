import { publicErrorMessage } from "@/lib/api";

/**
 * The live refusals, each said in one plain sentence. The boundary answers a
 * refusal with its category only, so the screen that sent the request says
 * which word stands behind the category from what it can see — which round is
 * open, what a round takes from, whether this phone handed in — and the
 * sentence is the word's. When the boundary passes the word itself, the
 * reading goes and the table stays.
 */
export type RefusalWord =
  | "ROUND_OPEN"
  | "ROUND_DONE"
  | "SOURCE_OPEN"
  | "SOURCE_UNRUN"
  | "NOTHING_PICKED"
  | "CLOSED"
  | "ROUND_CLOSED"
  | "RUN_OPEN"
  | "LEG_DRAWN_ON"
  | "FORWARD_DRAW"
  | "ALREADY_SUBMITTED"
  | "NO_OPEN_ROUND"
  | "INCOMPLETE"
  | "PILE_GONE"
  | "CARD_GONE"
  | "ROUND_GONE";

/** What the sentence names: the round the refusal is about, when it has one. */
export interface RefusalAbout {
  round?: number;
  /** The round this one takes from, when the sentence is about that side. */
  source?: number;
}

const SENTENCES: Record<RefusalWord, (about: RefusalAbout) => string> = {
  ROUND_OPEN: ({ round }) =>
    round === undefined
      ? "Close the open round first."
      : `Close round ${round} first.`,
  ROUND_DONE: ({ round }) =>
    round === undefined
      ? "This round already ran."
      : `Round ${round} already ran.`,
  SOURCE_OPEN: ({ round }) =>
    round === undefined
      ? "Close the round it takes from first."
      : `Close round ${round} first. This one takes from it.`,
  SOURCE_UNRUN: ({ round }) =>
    round === undefined
      ? "Open the round it takes from first."
      : `Run round ${round} first. This one takes from it.`,
  NOTHING_PICKED: () => "Pick at least one pile.",
  CLOSED: () => "No more rounds.",
  ROUND_CLOSED: ({ round }) =>
    round === undefined ? "The round is closed." : `Round ${round} is closed.`,
  RUN_OPEN: ({ round }) =>
    round === undefined
      ? "This round is in the run. It stays as it is."
      : `Round ${round} is in the run. It stays as it is.`,
  LEG_DRAWN_ON: ({ round }) =>
    round === undefined
      ? "Another round still takes from this one."
      : `Round ${round} still takes from this one.`,
  FORWARD_DRAW: ({ round, source }) =>
    source !== undefined
      ? `This one takes from round ${source}, so it stays after it.`
      : round === undefined
        ? "A round takes only from an earlier one."
        : `Round ${round} takes from this one, so this one stays before it.`,
  ALREADY_SUBMITTED: () => "You already handed in.",
  NO_OPEN_ROUND: () => "No round is open.",
  INCOMPLETE: () => "Answer every box first.",
  PILE_GONE: () => "That pile is gone.",
  CARD_GONE: () => "That card is gone.",
  ROUND_GONE: () => "That round is gone.",
};

export function refusalSentence(
  word: RefusalWord,
  about: RefusalAbout = {},
): string {
  return SENTENCES[word](about);
}

/**
 * What to say for a refused request: the word's sentence when the screen has
 * read one, the boundary's own message otherwise.
 */
export function saidRefusal(
  error: string,
  word: RefusalWord | null,
  about: RefusalAbout = {},
): string {
  return word === null
    ? publicErrorMessage(error)
    : refusalSentence(word, about);
}

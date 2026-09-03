import { api, isApiError, type Output } from "@/lib/api";

type FetchedRelay = NonNullable<Output<"/live/relays/get">["relay"]>;

/** One round as copying replays it; a take names its source by number. */
export interface CopyableRound {
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
  takes?: { from: number; shape: string };
}

/** A standing relay, read into the shape copying replays. */
export function roundsToCopy(relay: FetchedRelay): CopyableRound[] {
  return relay.rounds.map((round) => {
    const takes = round.takes[0];
    return {
      title: round.title,
      prompt: round.prompt,
      parts: round.parts,
      cap: round.cap,
      choices: round.choices,
      takes:
        takes === undefined
          ? undefined
          : { from: takes.sourceNumber, shape: takes.shape },
    };
  });
}

/**
 * Copying plays the same requests a staff member would send by hand, in order:
 * each round, then what each round takes. The relay is planned first, so its
 * title is the one the author typed rather than the source's.
 */
export async function copyRounds(
  relay: string,
  source: CopyableRound[],
): Promise<{ relay: string } | { error: string }> {
  const legs: string[] = [];
  for (const round of source) {
    const added = await api["/live/relays/add-round"]({
      relay,
      title: round.title,
      prompt: round.prompt,
      parts: round.parts,
      cap: round.cap,
      choices: round.choices,
    });
    if (isApiError(added)) return added;
    legs.push(added.leg);
  }

  for (const [index, round] of source.entries()) {
    const takes = round.takes;
    if (takes === undefined || takes.shape === "") continue;
    const from = legs[takes.from - 1];
    const leg = legs[index];
    if (from === undefined || leg === undefined) continue;
    const drawn = await api["/live/relays/set-takes"]({
      leg,
      source: from,
      shape: takes.shape,
    });
    if (isApiError(drawn)) return drawn;
  }

  return { relay };
}

/**
 * The same move for a questionnaire: the source's questions, in order, added
 * to a questionnaire the create endpoint has already made.
 */
export async function copyQuestionnaire(
  questionnaire: string,
  source: string,
): Promise<{ questionnaire: string } | { error: string }> {
  const read = await api["/live/quizzes/get"]({ questionnaire: source });
  if (isApiError(read)) return read;
  const sheet = read.questionnaire;
  if (sheet === null) return { error: "NOT_FOUND" };

  for (const question of sheet.questions) {
    const added = await api["/live/quizzes/add-question"]({
      questionnaire,
      prompt: question.prompt,
      choices: question.choices,
      expected: question.expected,
      explanation: question.explanation,
    });
    if (isApiError(added)) return added;
  }

  return { questionnaire };
}

const TAIL = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "over",
  "so",
  "than",
  "that",
  "the",
  "then",
  "to",
  "when",
  "while",
  "with",
  "yet",
]);

/** The words joined, the last one without the mark it ends on. */
function phrase(words: string[]): string {
  const kept = [...words];
  const last = kept.length - 1;
  if (last >= 0) kept[last] = (kept[last] ?? "").replace(/[,;:.!?—–-]+$/, "");
  return kept.join(" ");
}

/** How far into the words a whole phrase reaches: the last clause break, else the last word that can end one. */
function clause(words: string[]): string {
  for (let index = words.length - 1; index >= 1; index--) {
    if (/[,;:.]$/.test(words[index] ?? "")) {
      return phrase(words.slice(0, index + 1));
    }
  }
  const kept = [...words];
  while (kept.length > 1) {
    const last = phrase([kept[kept.length - 1] ?? ""]).toLowerCase();
    if (last !== "" && !TAIL.has(last)) break;
    kept.pop();
  }
  return phrase(kept);
}

/** The relay a brief names, before the model has drafted anything into it. */
export function titleFromBrief(brief: string): string {
  const words = brief.trim().split(/\s+/).filter(Boolean);
  const head = words.slice(0, 6);
  const title = (words.length > 6 ? clause(head) : phrase(head))
    .slice(0, 60)
    .trim();
  return title === "" ? "New relay" : title;
}

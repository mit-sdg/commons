import { api, isApiError, type Output } from "@/lib/api";

type FetchedRelay = NonNullable<Output<"/live/relays/get">["relay"]>;

/** A relay as copying reads it: a title, its rounds, and takes by round number. */
export interface CopyableRelay {
  title: string;
  rounds: {
    title: string;
    prompt: string;
    parts: string[];
    cap: number;
    choices: string[];
    takes?: { from: number; shape: string };
  }[];
}

/** The deck and a standing relay both reach copying through the same shape. */
export function relayToCopy(relay: FetchedRelay): CopyableRelay {
  return {
    title: relay.title,
    rounds: relay.rounds.map((round) => {
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
    }),
  };
}

/**
 * Copying plays the same requests a staff member would send by hand, in order:
 * the relay, each round, then what each round takes. The new relay comes back
 * so the caller can go on to its setup page.
 */
export async function copyRelay(
  source: CopyableRelay,
): Promise<{ relay: string } | { error: string }> {
  const planned = await api["/live/relays/plan"]({ title: source.title });
  if (isApiError(planned)) return planned;
  const relay = planned.relay;

  const legs: string[] = [];
  for (const round of source.rounds) {
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

  for (const [index, round] of source.rounds.entries()) {
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

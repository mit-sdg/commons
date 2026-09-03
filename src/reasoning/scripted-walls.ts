/**
 * The deterministic replies to the wall's three passages, for tests and
 * keyless demos. Each reply is read out of the passage itself — the labelled
 * cards, the piles as they stand, the boxes to answer — so the scripted room
 * behaves like a room the reasoner answered.
 */

import { LID_OPENING, PARTICIPANT_OPENING, PLACING_OPENING } from "../computations/live-walls.ts";

/** The piles the scripted mind sorts into, in the order it reaches for them. */
const BUCKETS = ["Pace", "Examples", "Questions"];

const PHRASES = [
  "more worked examples",
  "the pace was fast",
  "clearer slides",
  "more practice problems",
  "a short summary",
  "an unsortable scribble",
  "office hours would help",
];

function seedOf(text: string): number {
  let seed = 0;
  for (const character of text) seed = (seed * 31 + character.codePointAt(0)!) % 100_003;
  return seed;
}

function section(passage: string, heading: string): string {
  const rest = passage.split(`${heading}\n`)[1];
  if (rest === undefined) return "";
  return rest.split("\n\n")[0] ?? "";
}

function placingReply(passage: string): string {
  const cards = [...section(passage, "The cards to place:").matchAll(/^(c\d+)\. (.*)$/gm)].map(
    ([, label, value]) => ({ label: label as string, value: value as string }),
  );
  if (cards.length === 0) {
    return JSON.stringify({ kind: "placed", placements: [] });
  }
  const repairing = passage.includes("came back unusable");
  const unsortable = cards.find((card) => card.value.includes("unsortable"));
  if (!repairing && unsortable !== undefined) {
    return JSON.stringify({
      kind: "placed",
      placements: [{ card: "c0", pile: "Somewhere else" }],
    });
  }
  return JSON.stringify({
    kind: "placed",
    placements: cards.map((card) => {
      const name = BUCKETS[seedOf(card.value) % BUCKETS.length] as string;
      return { card: card.label, pile: name };
    }),
  });
}

function lidReply(passage: string): string {
  const pile = passage.split("The pile id: ")[1]?.split("\n")[0] ?? "";
  const name = passage.split("The pile's name: ")[1]?.split("\n")[0] ?? "";
  return JSON.stringify({
    kind: "lid",
    pile,
    sentence: `These answers all say something about ${name.toLowerCase()}.`,
  });
}

function participantReply(passage: string): string {
  const participant = passage.split("You are participant ")[1]?.split("\n")[0]?.replace(/\.$/, "");
  const seed = seedOf(participant ?? "");
  const offered = passage.split("Choose from: ")[1]?.split("\n")[0];
  const choices = offered === undefined ? [] : offered.split(" | ");
  const listed = passage.split("The boxes to answer, one line each:\n")[1] ?? "";
  const boxes = [...listed.matchAll(/^(\S+) — /gm)].map(([, item]) => item as string);
  return JSON.stringify({
    kind: "answers",
    answers: boxes.map((item, index) => ({
      item,
      value:
        choices.length === 0
          ? (PHRASES[(seed + index) % PHRASES.length] as string)
          : (choices[(seed + index) % choices.length] as string),
    })),
  });
}

export function scriptedWallReply(passage: string): string | undefined {
  if (passage.startsWith(PLACING_OPENING)) return placingReply(passage);
  if (passage.startsWith(LID_OPENING)) return lidReply(passage);
  if (passage.startsWith(PARTICIPANT_OPENING)) return participantReply(passage);
  return undefined;
}

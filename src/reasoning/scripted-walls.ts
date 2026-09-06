/**
 * The deterministic replies to the wall's passages and the editor's sample, for tests and
 * keyless demos. Each reply is read out of the passage itself — the labelled
 * cards, the piles as they stand, the boxes to answer — so the scripted room
 * behaves like a room the reasoner answered.
 */

import { SAMPLING_OPENING } from "../computations/live-sampling.ts";
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
  const listed =
    passage.split("The questions, each followed by its boxes to answer, one line each:\n\n")[1] ??
    "";
  const answers = listed.split("\n\n").flatMap((block) => {
    const offered = block.split("Choose from: ")[1]?.split("\n")[0];
    const choices = offered === undefined ? [] : offered.split(" | ");
    const boxes = [...block.matchAll(/^(\S+) — /gm)].map(([, item]) => item as string);
    return boxes.map((item, index) => ({
      item,
      value:
        choices.length === 0
          ? (PHRASES[(seed + index) % PHRASES.length] as string)
          : (choices[(seed + index) % choices.length] as string),
    }));
  });
  return JSON.stringify({ kind: "answers", answers });
}

/**
 * A sample: one answer per participant listed, each in a pile. A vote's answers
 * are its choices and sort under them; a written round's answers are the
 * scripted phrases, filed first into the piles the round already stands on,
 * then into the buckets, so every standing pile appears in the sample.
 */
function sampledReply(passage: string): string {
  const count = [...section(passage, "The participants, one answer each:").matchAll(/^\d+\. /gm)]
    .length;
  const offered = passage.split("Choose from: ")[1]?.split("\n")[0];
  const choices = offered === undefined ? [] : offered.split(" | ");
  const standing = [...section(passage, "The piles as they stand:").matchAll(/^- ([^:\n]+)/gm)].map(
    ([, name]) => (name as string).trim(),
  );
  const piles = [...standing, ...BUCKETS];
  return JSON.stringify({
    kind: "sampled",
    answers: Array.from({ length: count }, (_, index) =>
      choices.length === 0
        ? {
            value: PHRASES[index % PHRASES.length] as string,
            pile: piles[index % piles.length] as string,
          }
        : { value: choices[index % choices.length], pile: choices[index % choices.length] },
    ),
  });
}

export function scriptedWallReply(passage: string): string | undefined {
  if (passage.startsWith(SAMPLING_OPENING)) return sampledReply(passage);
  if (passage.startsWith(PLACING_OPENING)) return placingReply(passage);
  if (passage.startsWith(LID_OPENING)) return lidReply(passage);
  if (passage.startsWith(PARTICIPANT_OPENING)) return participantReply(passage);
  return undefined;
}

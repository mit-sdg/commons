"use client";

import {
  QuestionCard,
  type RoundQuestion,
} from "@/components/live/phone-question";
import type { RelayRound } from "@/components/live/rounds";

/** The disc a round is named by, as the token draws it. */
const DISCS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** Three piles a round might carry, so the face reads as it will run. */
const PILES = [
  { name: "Pace", count: 12 },
  { name: "Questions", count: 9 },
  { name: "Examples", count: 5 },
];

const CARDS = ["card", "another card"];

/**
 * The stand-in piles a round would carry, each named the way the wall names
 * one: the source round's disc, the pile's name, and its count.
 */
export function fillerPiles(source: number): string[] {
  const disc = DISCS[source - 1] ?? String(source);
  return PILES.map((pile) => `${disc} ${pile.name} · ${pile.count}`);
}

/** The round's question as a phone would meet it, with filler for what it takes. */
export function RoundPreview({ round }: { round: RelayRound }) {
  const takes = round.takes[0] ?? null;
  const use = takes?.shape ?? "";
  const carried = fillerPiles(takes?.sourceNumber ?? 0);
  const question: RoundQuestion = {
    question: round.leg,
    prompt: round.prompt,
    choices: use === "choices" ? carried : round.choices,
    parts: use === "parts" ? carried : use === "choices" ? [] : round.parts,
    cap: use === "parts" || use === "choices" ? 0 : round.cap,
    context:
      use === "context" ? carried.map((name) => ({ name, cards: CARDS })) : [],
    position: 1,
  };

  return (
    <div className="max-w-[360px] rounded-xl border border-border p-3">
      <QuestionCard
        question={question}
        answers={{}}
        onAnswer={() => undefined}
        onDraft={() => undefined}
      />
    </div>
  );
}

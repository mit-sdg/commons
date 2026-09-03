"use client";

import {
  QuestionCard,
  type RoundQuestion,
} from "@/components/live/phone-question";
import type { RelayRound } from "@/components/live/rounds";

/** The stand-in groups a round would carry, so the face reads as it will run. */
function piles(source: number): string[] {
  return ["", " (2)", " (3)"].map((tail) => `Pile from round ${source}${tail}`);
}

const CARDS = ["card", "another card"];

/** The round's question as a phone would meet it, with filler for what it takes. */
export function RoundPreview({ round }: { round: RelayRound }) {
  const takes = round.takes[0] ?? null;
  const use = takes?.shape ?? "";
  const carried = piles(takes?.sourceNumber ?? 0);
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

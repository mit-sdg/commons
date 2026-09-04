"use client";

import {
  QuestionCard,
  type RoundQuestion,
} from "@/components/live/phone-question";
import { RoundToken } from "@/components/live/round-token";
import type { RelayRound } from "@/components/live/rounds";
import { cn } from "@/lib/utils";

/**
 * The groups a round carries in when nobody has picked them yet. The piles are
 * sorted in class, so before it they have no names, only a count and a shape.
 */
export const UNNAMED_PILES = ["a pile you pick", "another", "another"];

/** The round a column shows: the one selected, or the first when none is. */
export function shownRound(
  rounds: RelayRound[],
  selected: string | null,
): RelayRound | null {
  return rounds.find((round) => round.leg === selected) ?? rounds[0] ?? null;
}

/** The round a round takes from, when it takes from one. */
export function sourceOf(
  round: RelayRound,
  rounds: RelayRound[],
): RelayRound | null {
  const takes = round.takes[0];
  if (takes === undefined) return null;
  return rounds.find((entry) => entry.leg === takes.source) ?? null;
}

/**
 * The groups a source hands on. A vote's choices and a list's parts are written
 * before class, so a later round can name them; everything else is piles the
 * room's answers are sorted into, which do not exist until the round runs.
 */
export function carriedGroups(source: RelayRound | null): string[] {
  if (source === null) return UNNAMED_PILES;
  if (source.choices.length > 0) return source.choices;
  if (source.parts.length > 0) return source.parts;
  return UNNAMED_PILES;
}

/**
 * The question a phone would meet on this round, with what it takes read off
 * the round it actually takes from.
 */
export function previewQuestion(
  round: RelayRound,
  rounds: RelayRound[],
): RoundQuestion {
  const use = round.takes[0]?.use ?? "";
  const carried = use === "" ? [] : carriedGroups(sourceOf(round, rounds));
  return {
    question: round.leg,
    prompt: round.prompt,
    choices: use === "choices" ? carried : round.choices,
    parts: use === "parts" ? carried : use === "choices" ? [] : round.parts,
    cap: use === "parts" || use === "choices" ? 0 : round.cap,
    context:
      use === "context" ? carried.map((name) => ({ name, cards: [] })) : [],
    position: 1,
  };
}

/**
 * The phone beside the rounds: one round, as a class will meet it. `column`
 * stands beside the round cards on a wide screen and follows the round the
 * reader is on; `drawer` folds the same phone under one card on a narrow one.
 */
export function PhoneColumn({
  rounds,
  selected,
  variant,
}: {
  rounds: RelayRound[];
  /** The round shown, by leg; the first round stands when none is selected. */
  selected: string | null;
  variant: "column" | "drawer";
}) {
  const round = shownRound(rounds, selected);
  if (round === null) return null;
  const source = sourceOf(round, rounds);
  const named = round.title.trim();

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        variant === "column" && "max-w-[360px]",
      )}
    >
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        {variant === "column" ? (
          <RoundToken
            number={round.number}
            title={named === "" ? undefined : named}
            standing="plain"
            size="sm"
          />
        ) : null}
        {source === null ? null : (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-xs">
            <span>from</span>
            <RoundToken
              number={source.number}
              title={source.title}
              standing="plain"
              size="sm"
            />
            <span>· {source.prompt}</span>
          </p>
        )}
        <QuestionCard
          key={round.leg}
          question={previewQuestion(round, rounds)}
          answers={{}}
          onAnswer={() => undefined}
          onDraft={() => undefined}
        />
      </div>
    </div>
  );
}

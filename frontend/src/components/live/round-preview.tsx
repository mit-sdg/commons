"use client";

import {
  QuestionCard,
  type RoundQuestion,
} from "@/components/live/phone-question";
import { refusalSentence } from "@/components/live/refusals";
import { RoundToken } from "@/components/live/round-token";
import {
  kindOf,
  type RelayRound,
  type Wall as WallShape,
} from "@/components/live/rounds";
import {
  type SampleAnswer,
  type SampleGroup,
  sampleWall,
  useSample,
} from "@/components/live/sample";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * The groups a round carries in when nobody has picked them yet. The piles are
 * sorted in class, so before it they have no names, only a count and a shape.
 */
export const UNNAMED_PILES = ["a pile you pick", "another", "another"];

/**
 * The one accent everything sampled wears. Pine is the editor's spare colour:
 * nothing else on the page takes it, so what the model wrote is never read as
 * what the room will write.
 */
const SAMPLED = "text-brand-pine";

/**
 * Where the sample's names stand inside the phone card: a vote's choices, a
 * list's box labels, and the groups above the prompt. The card is the
 * participant's own component, so the accent reaches its names by where they
 * sit in it rather than by a class of their own.
 */
const SAMPLED_NAMES = [
  "[&_button[aria-pressed]]:border-brand-pine/40",
  "[&_button[aria-pressed]]:text-brand-pine",
  "[&_span.font-mono]:text-brand-pine",
  "[&_p.font-medium]:text-brand-pine",
].join(" ");

/** How far the accent fades on a sample the round has moved out from under. */
const DIMMED = "opacity-60";

/** A vote with nothing to vote on, which is refused a launch. */
export function bareVote(round: RelayRound): boolean {
  return (
    kindOf(round) === "vote" &&
    round.choices.length === 0 &&
    round.takes[0]?.use !== "choices"
  );
}

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
 * The groups a source hands on: the piles picked off its wall. A vote's choices
 * are its wall's piles and are written before class, so a later round can name
 * them; every other source sorts the room's answers into piles that do not
 * exist until the round runs — a list's boxes are what its answers were written
 * in, never what they were sorted into — and where a sample of the source
 * stands, its piles stand in their place.
 */
export function carriedGroups(
  source: RelayRound | null,
  sampled: string[] = [],
): string[] {
  if (source === null) return UNNAMED_PILES;
  if (kindOf(source) === "vote" && source.choices.length > 0) {
    return source.choices;
  }
  return sampled.length > 0 ? sampled : UNNAMED_PILES;
}

/**
 * The question a phone would meet on this round, with what it takes read off
 * the round it actually takes from.
 */
export function previewQuestion(
  round: RelayRound,
  rounds: RelayRound[],
  sampled: string[] = [],
  groups: SampleGroup[] = [],
): RoundQuestion {
  const kind = kindOf(round);
  const ownChoices = kind === "vote" ? round.choices : [];
  const ownParts = kind === "list" ? round.parts : [];
  const ownCap = kind === "list" ? round.cap : 0;
  const use = round.takes[0]?.use ?? "";
  const carried =
    use === "" ? [] : carriedGroups(sourceOf(round, rounds), sampled);
  return {
    question: round.leg,
    prompt: round.prompt,
    choices: use === "choices" ? carried : ownChoices,
    parts: use === "parts" ? carried : use === "choices" ? [] : ownParts,
    cap: use === "parts" || use === "choices" ? 0 : ownCap,
    context:
      use === ""
        ? []
        : carried.map((name) => ({
            name,
            cards: groups.find((group) => group.name === name)?.cards ?? [],
          })),
    position: 1,
  };
}

/** Whether the card is showing sampled names where the class's piles would be. */
export function showsNames(
  round: RelayRound,
  rounds: RelayRound[],
  sampled: string[],
): boolean {
  if (round.takes[0] === undefined || sampled.length === 0) return false;
  return carriedGroups(sourceOf(round, rounds)) === UNNAMED_PILES;
}

/**
 * Whether the sample stands under the question as the round's own wall. A
 * round that takes its choices is answered by picking one of the names it
 * already shows; every other round is answered in writing, and the wall is
 * where what was written lands.
 */
export function showsWall(round: RelayRound): boolean {
  return round.takes[0]?.use !== "choices";
}

/**
 * The wall the preview stands under: the round's standing piles, which a run's
 * wall opens with, standing and empty, and after them the piles the sample
 * opened for itself. A standing pile the sample placed cards in keeps its
 * place and its sentence and carries them.
 */
export function previewWall(
  round: RelayRound,
  answers: SampleAnswer[],
): WallShape {
  const sampled = sampleWall(round, answers);
  const standing = round.piles.map((pile, index) => {
    const placed = sampled.piles.find((one) => one.name === pile.name);
    return {
      pile: placed?.pile ?? `standing-pile-${index + 1}`,
      name: pile.name,
      description: pile.description,
      count: placed?.count ?? 0,
      picked: null,
    };
  });
  const named = new Set(standing.map((pile) => pile.name));
  return {
    ...sampled,
    piles: [
      ...standing,
      ...sampled.piles.filter((pile) => !named.has(pile.name)),
    ],
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
  return (
    <Phone key={round.leg} round={round} rounds={rounds} variant={variant} />
  );
}

function Phone({
  round,
  rounds,
  variant,
}: {
  round: RelayRound;
  rounds: RelayRound[];
  variant: "column" | "drawer";
}) {
  const sampling = useSample(round, rounds);
  const source = sourceOf(round, rounds);
  const named = round.title.trim();
  const answers = sampling.sample?.answers ?? [];
  const namesShown = showsNames(round, rounds, sampling.names);
  const wall = answers.length > 0 ? previewWall(round, answers) : null;

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
        <Tabs defaultValue="participant">
          <TabsList className="w-full">
            <TabsTrigger value="participant">Participant view</TabsTrigger>
            <TabsTrigger value="results">Example results</TabsTrigger>
          </TabsList>
          <TabsContent value="participant" className="space-y-3">
            {source === null ? null : (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                <span>{namesShown ? "Example input from" : "From"}</span>
                <RoundToken
                  number={source.number}
                  title={source.title}
                  standing="plain"
                  size="sm"
                />
                <span>{source.prompt}</span>
              </p>
            )}
            {bareVote(round) ? (
              <p className="rounded-2xl border border-border border-dashed bg-card p-5 text-muted-foreground text-sm">
                {refusalSentence("NO_CHOICES")}
              </p>
            ) : (
              // Keep example inputs disabled while allowing source groups to expand.
              <fieldset
                disabled
                className={cn(
                  namesShown && SAMPLED_NAMES,
                  namesShown && sampling.dim && DIMMED,
                )}
              >
                <QuestionCard
                  key={round.leg}
                  question={previewQuestion(
                    round,
                    rounds,
                    sampling.names,
                    sampling.groups,
                  )}
                  answers={{}}
                  onAnswer={() => undefined}
                  onDraft={() => undefined}
                />
              </fieldset>
            )}
          </TabsContent>
          <TabsContent value="results" className="space-y-2">
            {wall === null ? (
              <p className="py-4 text-muted-foreground text-sm">
                Generate example responses to preview the results.
              </p>
            ) : (
              <div className={cn("space-y-2", sampling.dim && DIMMED)}>
                <p className="text-brand-pine text-xs">
                  AI-generated examples
                  {sampling.dim ? " — regenerate to reflect your changes" : ""}
                </p>
                {source !== null && kindOf(source) === "vote" ? (
                  <p className="text-muted-foreground text-xs">
                    These examples use the previous vote’s labels.
                  </p>
                ) : null}
                {wall.piles.map((pile) => (
                  <details
                    key={pile.pile}
                    className="rounded-lg border border-brand-pine/30 bg-brand-pine/5 px-3 py-2"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {pile.name}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {pile.count}{" "}
                        {pile.count === 1 ? "response" : "responses"}
                      </span>
                    </summary>
                    {pile.description ? (
                      <p className="mt-2 text-muted-foreground text-xs">
                        {pile.description}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-2">
                      {wall.cards
                        .filter((card) => card.pile === pile.pile)
                        .map((card) => (
                          <li
                            key={card.card}
                            className="rounded-md bg-card px-3 py-2 text-sm whitespace-pre-wrap break-words"
                          >
                            {card.value}
                          </li>
                        ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        {sampling.offered ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sampling.asking}
                onClick={sampling.ask}
                className={cn("border-brand-pine/40", SAMPLED)}
              >
                {sampling.asking
                  ? "Generating…"
                  : answers.length > 0
                    ? "Regenerate examples"
                    : "Generate example responses"}
              </Button>
              {answers.length === 0 ? null : (
                <span
                  className={cn(
                    "font-mono text-[11px] tracking-[0.04em]",
                    SAMPLED,
                    sampling.dim && DIMMED,
                  )}
                >
                  examples
                </span>
              )}
            </div>
            {sampling.line === null ? null : (
              <p className="text-muted-foreground text-xs">{sampling.line}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

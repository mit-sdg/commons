"use client";

import { ChevronRight, Layers } from "lucide-react";
import { useState } from "react";
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
  sampled?: string[],
): string[] {
  if (sampled !== undefined) return sampled;
  if (source === null) return UNNAMED_PILES;
  if (kindOf(source) === "vote" && source.choices.length > 0) {
    return source.choices;
  }
  return UNNAMED_PILES;
}

/**
 * The question a phone would meet on this round, with what it takes read off
 * the round it actually takes from.
 */
export function previewQuestion(
  round: RelayRound,
  rounds: RelayRound[],
  sampled: string[] | undefined = undefined,
  groups: SampleGroup[] = [],
): RoundQuestion {
  const source = sourceOf(round, rounds);
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
    choices: use === "choices" ? carried : use === "parts" ? [] : ownChoices,
    parts: use === "parts" ? carried : use === "choices" ? [] : ownParts,
    cap: use === "parts" || use === "choices" ? 0 : ownCap,
    context:
      use === ""
        ? []
        : carried.map((name) => ({
            name,
            cards: groups.find((group) => group.name === name)?.cards ?? [],
          })),
    contextUse: use,
    ...(source
      ? { contextSource: { number: source.number, title: source.title } }
      : {}),
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
      description: "",
      definition: pile.description,
      legacyText: "",
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
  retired = false,
}: {
  rounds: RelayRound[];
  /** The round shown, by leg; the first round stands when none is selected. */
  selected: string | null;
  variant: "column" | "drawer";
  retired?: boolean;
}) {
  const round = shownRound(rounds, selected);
  if (round === null) return null;
  const phone = (
    <Phone
      key={round.leg}
      round={round}
      rounds={rounds}
      variant={variant}
      retired={retired}
    />
  );
  return variant === "column" ? (
    phone
  ) : (
    <details
      key={round.leg}
      className="group/preview min-w-0 rounded-xl border border-border bg-background"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Preview round {round.number}
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open/preview:rotate-90"
        />
      </summary>
      {phone}
    </details>
  );
}

function Phone({
  round,
  rounds,
  variant,
  retired,
}: {
  round: RelayRound;
  rounds: RelayRound[];
  variant: "column" | "drawer";
  retired: boolean;
}) {
  const sampling = useSample(round, rounds);
  const [tab, setTab] = useState("participant");
  const source = sourceOf(round, rounds);
  const named = round.title.trim();
  const answers = sampling.sample?.answers ?? [];
  const fresh = sampling.sample?.standing === "fresh";
  const wall = fresh && answers.length > 0 ? previewWall(round, answers) : null;
  const groups = sampling.groups;
  const voteChoices =
    round.takes[0]?.use === "choices"
      ? groups.map((group) => group.name)
      : round.choices;

  return (
    <div
      data-preview={variant}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-3 [overflow-anchor:none]",
        variant === "column"
          ? "max-h-[var(--preview-height,calc(100dvh-146px))]"
          : "rounded-none border-0 border-t",
      )}
    >
      <RoundToken
        number={round.number}
        title={named === "" ? undefined : named}
        standing="plain"
        size="sm"
      />
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="participant">Participant view</TabsTrigger>
          <TabsTrigger value="results">Example results</TabsTrigger>
        </TabsList>
        <div
          data-preview-scroll
          className={cn(
            "min-h-0 min-w-0",
            variant === "column" && "overflow-y-auto overscroll-contain",
          )}
        >
          <TabsContent value="participant" className="space-y-3">
            {source === null ? null : (
              <div className="space-y-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                <p className="text-muted-foreground">
                  Simulated input from round {source.number}
                </p>
                <details>
                  <summary className="cursor-pointer font-medium">
                    Preview picks ({sampling.selected.length})
                  </summary>
                  <p className="my-2 text-muted-foreground">
                    Preview only. In a live run, you choose which groups
                    continue.
                  </p>
                  <div className="flex flex-col gap-1">
                    {sampling.available.map((name) => (
                      <label
                        key={name}
                        className="flex min-h-9 items-center gap-2 rounded-md border border-border px-2 py-1 [overflow-wrap:anywhere] has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          checked={sampling.selected.includes(name)}
                          disabled={retired || sampling.asking}
                          onChange={(event) =>
                            sampling.pick(
                              event.target.checked
                                ? [...sampling.selected, name]
                                : sampling.selected.filter(
                                    (entry) => entry !== name,
                                  ),
                            )
                          }
                        />
                        <Layers className="size-3 shrink-0" />
                        {name}
                      </label>
                    ))}
                  </div>
                </details>
                {sampling.sourceStanding === "fresh" ? null : (
                  <p role="status" className="text-muted-foreground">
                    {sampling.sourceStanding === "empty"
                      ? "Choose at least one group for this preview."
                      : sampling.sourceStanding === "stale"
                        ? "Source input changed—refresh the preview."
                        : "Generate a preview to supply example input."}
                  </p>
                )}
              </div>
            )}
            {bareVote(round) ? (
              <p className="rounded-2xl border border-dashed p-5 text-muted-foreground text-sm">
                {refusalSentence("NO_CHOICES")}
              </p>
            ) : source !== null && groups.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-5 text-muted-foreground text-sm">
                Participant view needs selected source groups.
              </p>
            ) : (
              <div data-participant-frame>
                <QuestionCard
                  readOnly
                  key={`${round.leg}-${sampleKeyForQuestion(round, groups)}`}
                  question={previewQuestion(
                    round,
                    rounds,
                    groups.map((group) => group.name),
                    groups,
                  )}
                  answers={{}}
                  onAnswer={() => undefined}
                  onDraft={() => undefined}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value="results" className="space-y-2">
            {wall === null ? (
              <p className="py-4 text-muted-foreground text-sm" role="status">
                {sampling.sample !== null && !fresh
                  ? "Preview changed—refresh to see current results."
                  : "Generate a preview to see example results."}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-brand-pine text-xs">AI-generated examples</p>
                {kindOf(round) === "vote" ? (
                  <dl className="divide-y divide-border">
                    {voteChoices.map((choice) => {
                      const votes = answers.filter(
                        (answer) => answer.value === choice,
                      ).length;
                      return (
                        <div
                          key={choice}
                          className="flex items-baseline justify-between gap-3 py-3 text-sm"
                        >
                          <dt
                            className="min-w-0 [overflow-wrap:anywhere]"
                            dir="auto"
                          >
                            {choice}
                          </dt>
                          <dd className="shrink-0 tabular-nums text-muted-foreground">
                            {votes} {votes === 1 ? "vote" : "votes"}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  wall.piles.map((pile) => (
                    <details
                      key={pile.pile}
                      className="min-w-0 rounded-lg border border-brand-pine/30 bg-brand-pine/5 px-3 py-2"
                    >
                      <summary className="cursor-pointer text-sm font-medium [overflow-wrap:anywhere]">
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
                              className="rounded-md bg-card px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]"
                            >
                              {card.value}
                            </li>
                          ))}
                      </ul>
                    </details>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retired || sampling.asking}
          onClick={() => {
            void sampling.ask();
          }}
          className="self-start border-brand-pine/40 text-brand-pine"
        >
          {sampling.asking
            ? "Generating…"
            : sampling.sample !== null
              ? "Refresh preview"
              : "Generate preview"}
        </Button>
        {sampling.line === null ? null : (
          <p role="status" className="text-muted-foreground text-xs">
            {sampling.line}
          </p>
        )}
      </div>
    </div>
  );
}

function sampleKeyForQuestion(round: RelayRound, groups: SampleGroup[]) {
  return JSON.stringify([
    round.kind,
    round.parts,
    round.choices,
    round.cap,
    round.takes,
    groups,
  ]);
}

"use client";

import type { Output } from "@/lib/api";
import { cn } from "@/lib/utils";

type Results = Output<"/live/runs/results">;

/** The board of one run: what was asked, and every value handed in. */
export type RunBoardView = NonNullable<Results["board"]>;
export type RunBoardQuestion = RunBoardView["questions"][number];
/** Scores ride along only for a keyed run; a survey's board arrives alone. */
export type RunScoresView = NonNullable<
  Extract<Results, { scores: unknown }>["scores"]
>;

export function scoresOf(result: Results): RunScoresView | null {
  return "scores" in result ? result.scores : null;
}

export interface ChoiceTally {
  label: string;
  count: number;
  /** A value nobody was offered — a written answer to a question that changed. */
  other: boolean;
}

/**
 * The room's answers counted against the choices it was offered. Anything that
 * matches no choice is gathered under one heading rather than dropped, so the
 * bars always add up to the answers actually given.
 */
export function tallyChoices(
  choices: string[],
  values: string[],
): ChoiceTally[] {
  const counts = new Map<string, number>();
  for (const choice of choices) counts.set(choice, 0);
  let other = 0;
  for (const value of values) {
    const standing = counts.get(value);
    if (standing === undefined) other += 1;
    else counts.set(value, standing + 1);
  }
  const rows = choices.map((choice) => ({
    label: choice,
    count: counts.get(choice) ?? 0,
    other: false,
  }));
  return other === 0
    ? rows
    : [...rows, { label: "Something else", count: other, other: true }];
}

export interface ScoreBand {
  score: number;
  count: number;
}

/** Every score that was earned, low to high, with how many earned it. */
export function scoreDistribution(
  results: { score: number; outOf: number }[],
): ScoreBand[] {
  const counts = new Map<number, number>();
  for (const result of results) {
    counts.set(result.score, (counts.get(result.score) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((left, right) => left.score - right.score);
}

/** One figure, sized to be read from the back of the room. */
export function RunCount({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-5 py-4",
        className,
      )}
    >
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-display text-4xl font-semibold tabular-nums sm:text-5xl">
        {value}
      </p>
    </div>
  );
}

function Bar({
  label,
  count,
  total,
  max,
  muted = false,
}: {
  label: string;
  count: number;
  total: number;
  max: number;
  muted?: boolean;
}) {
  const share = total === 0 ? 0 : Math.round((count / total) * 100);
  const width = max === 0 ? 0 : (count / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={cn(
            "text-base sm:text-lg",
            muted && "text-muted-foreground italic",
          )}
        >
          {label}
        </span>
        <span className="shrink-0 font-semibold text-base tabular-nums sm:text-lg">
          {count}
          <span className="ml-2 font-normal text-muted-foreground text-sm">
            {share}%
          </span>
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            muted ? "bg-muted-foreground/40" : "bg-primary",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** One question's standing: bars where choices were offered, words where not. */
export function RunQuestionBoard({
  index,
  question,
}: {
  index: number;
  question: RunBoardQuestion;
}) {
  const values = question.values.map((entry) => entry.value);
  const choices = question.choices;
  const tally = tallyChoices(choices, values);
  const max = tally.reduce((high, row) => Math.max(high, row.count), 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h3 className="mb-4 font-display text-xl font-semibold text-balance sm:text-2xl">
        <span className="mr-3 text-muted-foreground tabular-nums">
          {index + 1}.
        </span>
        {question.prompt}
      </h3>
      {choices.length > 0 ? (
        <div className="space-y-4">
          {tally.map((row, rowIndex) => (
            <Bar
              key={`${row.label}-${rowIndex}`}
              label={row.label}
              count={row.count}
              total={values.length}
              max={max}
              muted={row.other}
            />
          ))}
          <p className="text-muted-foreground text-sm">
            {values.length} answer{values.length === 1 ? "" : "s"} handed in
          </p>
        </div>
      ) : values.length === 0 ? (
        <p className="text-muted-foreground">No written answers yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {question.values.map((entry) => (
            <span
              key={entry.participant}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-base sm:text-lg"
            >
              {entry.value}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** How the room scored, once a keyed run has anything to score. */
export function RunScoreBoard({ scores }: { scores: RunScoresView }) {
  const results = scores.results;
  if (results.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h3 className="font-display text-xl font-semibold sm:text-2xl">
          Scores
        </h3>
        <p className="mt-2 text-muted-foreground">
          Nothing has been graded yet.
        </p>
      </section>
    );
  }

  const outOf = results.reduce((high, row) => Math.max(high, row.outOf), 0);
  const bands = scoreDistribution(results);
  const max = bands.reduce((high, band) => Math.max(high, band.count), 0);
  const total = results.reduce((sum, row) => sum + row.score, 0);
  const mean = total / results.length;

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-semibold sm:text-2xl">
          Scores
        </h3>
        <p className="text-muted-foreground">
          Average{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {mean.toFixed(1)} / {outOf}
          </span>{" "}
          across {results.length} response{results.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="space-y-4">
        {bands.map((band) => (
          <Bar
            key={band.score}
            label={`${band.score} / ${outOf}`}
            count={band.count}
            total={results.length}
            max={max}
          />
        ))}
      </div>
    </section>
  );
}

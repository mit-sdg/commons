"use client";

import { Check, ChevronRight } from "lucide-react";
import type { Output } from "@/lib/api";
import { cn } from "@/lib/utils";

type Results = Output<"/live/runs/results">;

/** The board of one run: what was asked, and every value handed in. */
type RunBoardView = NonNullable<Results["board"]>;
export type RunBoardQuestion = RunBoardView["questions"][number];
/** Scores ride along only for a keyed run; a survey's board arrives alone. */
export type RunScoresView = NonNullable<
  Extract<Results, { scores: unknown }>["scores"]
>;

export function scoresOf(result: Results): RunScoresView | null {
  return "scores" in result ? result.scores : null;
}

interface ChoiceTally {
  label: string;
  count: number;
  /** A value nobody was offered — a written answer to a question that changed. */
  other: boolean;
  /** The choice the question expected; never set on a survey, which expects none. */
  expected: boolean;
}

/**
 * The room's answers counted against the choices it was offered. Anything that
 * matches no choice is gathered under one heading rather than dropped, so the
 * bars always add up to the answers actually given.
 */
function tallyChoices(
  choices: string[],
  values: string[],
  expected: string,
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
    expected: expected !== "" && choice === expected,
  }));
  return other === 0
    ? rows
    : [
        ...rows,
        { label: "Something else", count: other, other: true, expected: false },
      ];
}

interface WrittenTally {
  /** The most common casing the room actually typed. */
  label: string;
  count: number;
  /** Trimmed and case-folded — one key for every way of writing the answer. */
  key: string;
}

/**
 * Written answers gathered by what they say rather than how they were typed:
 * two people who wrote the same words in different case are one entry, shown in
 * the casing most of them used. Loudest first, and ties keep the order the room
 * handed them in.
 */
function tallyWritten(values: string[]): WrittenTally[] {
  const groups = new Map<
    string,
    { order: number; count: number; casings: Map<string, number> }
  >();
  for (const value of values) {
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    let group = groups.get(key);
    if (group === undefined) {
      group = { order: groups.size, count: 0, casings: new Map() };
      groups.set(key, group);
    }
    group.count += 1;
    group.casings.set(label, (group.casings.get(label) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      let label = "";
      let standing = 0;
      // Insertion order breaks a tie, so the casing seen first stands.
      for (const [casing, count] of group.casings) {
        if (count > standing) {
          label = casing;
          standing = count;
        }
      }
      return { label, count: group.count, key, order: group.order };
    })
    .sort((left, right) => right.count - left.count || left.order - right.order)
    .map(({ label, count, key }) => ({ label, count, key }));
}

interface ScoreBand {
  score: number;
  count: number;
}

/** Every score that was earned, low to high, with how many earned it. */
function scoreDistribution(
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

/**
 * One row of a tally. The bar carries exactly the share its label states — a bar
 * scaled to the leading row would draw a three-way tie as three full bars — so
 * an eye at the back of the room reads the same figure the label does.
 */
function Bar({
  label,
  count,
  total,
  muted = false,
  expected = false,
}: {
  label: string;
  count: number;
  total: number;
  muted?: boolean;
  expected?: boolean;
}) {
  const share = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div
      className={cn(
        "space-y-1.5",
        expected && "-mx-3 rounded-lg bg-primary/5 px-3 py-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={cn(
            "min-w-0 text-base sm:text-lg",
            muted && "text-muted-foreground italic",
            expected && "font-medium",
          )}
        >
          {expected ? (
            <Check className="me-2 inline-block size-5 align-text-bottom text-primary" />
          ) : null}
          <span dir="auto">{label}</span>
          {expected ? (
            <span className="sr-only"> (expected answer)</span>
          ) : null}
        </span>
        <span className="shrink-0 font-semibold text-base tabular-nums sm:text-lg">
          {count}
          <span className="ml-2 font-semibold text-base text-muted-foreground">
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
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

/**
 * One question's standing: bars where choices were offered, words where not.
 * The expected choice is marked only once the run has closed — this board is
 * projected to the room, and the standard is revealed when the moment has
 * passed, not while the room is still answering.
 */
export function RunQuestionBoard({
  index,
  question,
  revealExpected,
}: {
  index: number;
  question: RunBoardQuestion;
  revealExpected: boolean;
}) {
  const values = question.values.map((entry) => entry.value);
  const choices = question.choices;
  const tally = tallyChoices(
    choices,
    values,
    revealExpected ? question.expected : "",
  );
  const written = tallyWritten(values);

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h3
        dir="auto"
        className="mb-4 font-display text-xl font-semibold text-balance sm:text-2xl"
      >
        <span className="me-3 text-muted-foreground tabular-nums">
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
              muted={row.other}
              expected={row.expected}
            />
          ))}
          <p className="font-medium text-base text-muted-foreground">
            {values.length} answer{values.length === 1 ? "" : "s"} handed in
          </p>
        </div>
      ) : values.length === 0 ? (
        <p className="text-muted-foreground">No written answers yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {written.map((row) => (
            <span
              key={row.key}
              className="flex items-baseline gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-base sm:text-lg"
            >
              <span dir="auto" className="min-w-0">
                {row.label}
              </span>
              {row.count > 1 ? (
                <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
                  ×{row.count}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}
      {/* A written answer is measured against nothing, so what the author kept
          beside the question is offered as a reference, not a verdict. */}
      {choices.length === 0 && revealExpected && question.expected !== "" ? (
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Reference:{" "}
          <span dir="auto" className="font-medium text-foreground">
            {question.expected}
          </span>
        </p>
      ) : null}
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
          />
        ))}
      </div>

      {/* Individual results stay behind a deliberate click: this board is
          projected, and nobody's score belongs on the wall by accident. */}
      <details className="group mt-4">
        {/* A thumb-sized row on the phone, with the marker drawn by the same
            icon set as the rest of the feature. */}
        <summary className="flex cursor-pointer list-none items-center gap-1.5 py-2.5 text-muted-foreground text-sm hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          Results by participant
        </summary>
        <ul className="mt-3 space-y-1">
          {results.map((row) => (
            <li
              key={row.submission}
              className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/40 px-3 py-1.5 text-sm"
            >
              <span dir="auto" className="min-w-0 flex-1 truncate">
                {row.name ?? "Anonymous device"}
              </span>
              <span className="font-medium tabular-nums">
                {row.score} / {row.outOf}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

"use client";

import { Fragment, type ReactNode } from "react";
import {
  type CriterionRow,
  type PointPaper,
  type PointsRow,
  type Scores,
  scoreText,
  type TotalRow,
} from "@/lib/grade-analysis";
import { cn } from "@/lib/utils";
import { EACH_PAPER, NO_GRADER, RING, ROW_GRID, score } from "./common";
import { hoverable } from "./hover";
import type { Naming } from "./names";
import { PaperCard } from "./paper";

const DOT = 10;
const PITCH = 12;

export function maxOf(row: PointsRow | TotalRow) {
  return row.kind === "TOTAL" ? row.outOf : row.maxPoints;
}

function ticksOf(max: number): number[] {
  const rough = max / 10;
  const step =
    [1, 2, 5, 10, 20, 25, 50, 100].find((candidate) => candidate >= rough) ??
    Math.ceil(rough);
  const ticks: number[] = [];
  for (let value = 0; value < max; value += step) ticks.push(value);
  if (max - (ticks.at(-1) ?? 0) < step / 2) ticks.pop();
  return [...ticks, max];
}

const at = (value: number, max: number) =>
  `${max > 0 ? (value / max) * 100 : 0}%`;

export function Axis({ max }: { max: number }) {
  return (
    <div
      aria-hidden
      className="relative mx-1.5 h-4 text-[0.68rem] tabular-nums text-muted-foreground"
    >
      {ticksOf(max).map((value) => (
        <span
          key={value}
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: at(value, max) }}
        >
          {score(value)}
        </span>
      ))}
    </div>
  );
}

function Plot({
  max,
  height,
  mark,
  children,
}: {
  max: number;
  height: number;
  mark: number | null;
  children: ReactNode;
}) {
  return (
    <div
      className="relative mx-1.5 mb-2.5 min-w-0 border-b border-border"
      style={{ height }}
    >
      {ticksOf(max).map((value) => (
        <span
          key={value}
          aria-hidden
          className="absolute inset-y-0 w-px bg-border/70"
          style={{ left: at(value, max) }}
        />
      ))}
      {children}
      {mark !== null ? (
        <span
          aria-hidden
          className="absolute -bottom-[11px] z-[3] size-0 -translate-x-1/2 border-x-[6px] border-b-[8px] border-x-transparent border-b-foreground"
          style={{ left: at(mark, max) }}
        />
      ) : null}
    </div>
  );
}

function stacksOf<P extends { score: number }>(papers: readonly P[]) {
  const stacks = new Map<number, P[]>();
  for (const paper of papers)
    stacks.set(paper.score, [...(stacks.get(paper.score) ?? []), paper]);
  return [...stacks.entries()].sort(([left], [right]) => left - right);
}

/**
 * A row's papers on its axis: a dot per paper, each opening its paper, or
 * past `EACH_PAPER`, a bar per score, each opening its learners.
 */
export function Scores({
  papers,
  max,
  mark,
  names,
  onPaper,
  onLearners,
  dots = papers.length <= EACH_PAPER,
  height,
}: {
  papers: readonly PointPaper[];
  max: number;
  mark: number | null;
  names: Naming;
  onPaper: (submission: string) => void;
  onLearners: (learners: string[], value: number) => void;
  /** Whether each paper is a dot; a grader's row follows its class row. */
  dots?: boolean;
  height?: number;
}) {
  const stacks = stacksOf(papers);
  const tallest = Math.max(1, ...stacks.map(([, own]) => own.length));
  if (dots)
    return (
      <Plot
        max={max}
        height={height ?? Math.max(24, tallest * PITCH + 4)}
        mark={mark}
      >
        {stacks.map(([value, own]) => (
          <span
            key={value}
            className="absolute bottom-0.5 flex -translate-x-1/2 flex-col-reverse"
            style={{ left: at(value, max) }}
          >
            {own.map((paper) => (
              <button
                key={paper.learner}
                type="button"
                data-grader={paper.grader ?? NO_GRADER}
                data-dot
                aria-label={`${names.grader(paper.grader)}, ${score(paper.score)} of ${score(max)}`}
                onClick={() => onPaper(paper.submission)}
                className={cn(
                  "group flex shrink-0 items-center justify-center rounded-full",
                  RING,
                )}
                style={{ width: PITCH, height: PITCH }}
                {...hoverable(() => (
                  <PaperCard
                    paper={paper}
                    names={names}
                    heading={`${score(paper.score)} of ${score(max)}`}
                    label="Overall feedback"
                  />
                ))}
              >
                <span
                  className="rounded-full bg-foreground/75 group-hover:bg-foreground group-focus-visible:bg-foreground"
                  style={{ width: DOT, height: DOT }}
                />
              </button>
            ))}
          </span>
        ))}
      </Plot>
    );
  const room = height ?? 44;
  const width = Math.max(0.6, 70 / Math.max(1, max));
  const leftOf = (value: number) =>
    Math.min(
      Math.max((max > 0 ? (value / max) * 100 : 0) - width / 2, 0),
      100 - width,
    );
  return (
    <Plot max={max} height={room} mark={mark}>
      {stacks.map(([value, own]) => (
        <button
          key={value}
          type="button"
          aria-label={`${own.length} at ${score(value)}`}
          title={`${own.length} at ${score(value)}`}
          onClick={() =>
            onLearners(
              own.map((paper) => paper.learner),
              value,
            )
          }
          className={cn(
            "absolute bottom-0 rounded-t-sm bg-foreground/30 hover:bg-foreground/60",
            RING,
          )}
          style={{
            left: `${leftOf(value)}%`,
            width: `${width}%`,
            height: (own.length / tallest) * (room - 4),
          }}
        />
      ))}
    </Plot>
  );
}

export type Statistic = "median" | "mean";

export function axesOf(rows: readonly CriterionRow[]): (number | null)[] {
  let last: number | null = null;
  return rows.map((row) => {
    if (row.kind === "COMPETENCY") return null;
    const max = maxOf(row);
    const starts = max !== last;
    last = max;
    return starts ? max : null;
  });
}

function statText(statistic: Statistic, value: number | null) {
  if (value === null) return "";
  return statistic === "mean"
    ? scoreText(Number(value.toFixed(1)))
    : scoreText(value);
}

function Stats({ scores }: { scores: Scores }) {
  const lines: [string, string][] = [
    ["Median", statText("median", scores.median)],
    ["Mean", statText("mean", scores.mean)],
    [
      "Lowest to highest",
      `${score(scores.lowest)} to ${score(scores.highest)}`,
    ],
    ...(scores.full > 0
      ? [["Full marks", String(scores.full)] as [string, string]]
      : []),
    ...(scores.zero > 0
      ? [["Zero", String(scores.zero)] as [string, string]]
      : []),
    ["Scored", String(scores.count)],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
      {lines.map(([term, value]) => (
        <Fragment key={term}>
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="text-right font-semibold tabular-nums">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function StatisticText({
  statistic,
  scores,
}: {
  statistic: Statistic;
  scores: Scores;
}) {
  if (scores.count === 0)
    return <span className="text-muted-foreground">No scores</span>;
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows the same statistics the pointer does
    <span
      tabIndex={0}
      className={cn(
        "tabular-nums text-muted-foreground underline decoration-foreground/30 decoration-dotted underline-offset-4",
        RING,
      )}
      {...hoverable(() => <Stats scores={scores} />)}
    >
      {statistic}{" "}
      <span className="font-semibold text-foreground">
        {statText(statistic, scores[statistic])}
      </span>
    </span>
  );
}

/**
 * By grader under a points row: each grader's papers on the row's axis, in
 * the row's form (dots, or past `EACH_PAPER` bars), with their statistic.
 */
export function GraderScores({
  row,
  statistic,
  names,
  onPaper,
  onLearners,
}: {
  row: PointsRow | TotalRow;
  statistic: Statistic;
  names: Naming;
  onPaper: (submission: string) => void;
  onLearners: (
    learners: string[],
    value: number,
    grader: string | null,
  ) => void;
}) {
  const max = maxOf(row);
  const dots = row.papers.length <= EACH_PAPER;
  return (
    <div className="space-y-1.5 pt-2">
      {row.byGrader.map((own) => {
        const { grader } = own;
        const key = grader ?? NO_GRADER;
        return (
          <div
            key={key}
            data-grader={key}
            data-lights
            className={cn(
              "grid items-center gap-x-4 gap-y-1 rounded-md text-sm",
              ROW_GRID,
            )}
          >
            <span
              className={cn(
                "text-muted-foreground sm:pl-5",
                names.mine(grader) && "font-semibold text-foreground",
              )}
            >
              {names.grader(grader)}
            </span>
            <Scores
              papers={row.papers.filter((paper) => paper.grader === grader)}
              max={max}
              mark={own[statistic]}
              names={names}
              onPaper={onPaper}
              onLearners={(learners, value) =>
                onLearners(learners, value, grader)
              }
              dots={dots}
              height={dots ? undefined : 28}
            />
            <span>
              <StatisticText statistic={statistic} scores={own} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

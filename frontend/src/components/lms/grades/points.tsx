"use client";

import {
  Fragment,
  type ReactNode,
  type Ref,
  useCallback,
  useState,
} from "react";
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
import { acrossOf, ceilingOf, layoutOf, leftOf, pilesOf } from "./piles";

/** The height of a pile's folded count. */
const COUNT = 14;
/** The folded papers a count lists when pointed at. */
const FOLDED_LISTED = 8;

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
  measure,
  children,
}: {
  max: number;
  height: number;
  mark: number | null;
  measure?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={measure}
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

function useWidth() {
  const [width, setWidth] = useState(0);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width ?? 0),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [width, measure] as const;
}

/** The papers a pile folds away, for pointing at its count. */
function FoldedCard({
  papers,
  max,
  names,
  heading,
}: {
  papers: readonly PointPaper[];
  max: number;
  names: Naming;
  heading: string;
}) {
  const listed = papers.slice(0, FOLDED_LISTED);
  return (
    <>
      <span className="font-semibold">{heading}</span>
      <ul className="grid gap-1">
        {listed.map((paper) => (
          <li
            key={paper.learner}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3"
          >
            <span className="truncate text-muted-foreground">
              {names.student(paper) ?? names.grader(paper.grader)}
            </span>
            <span className="tabular-nums">
              {score(paper.score)} of {score(max)}
            </span>
            <span className="col-span-2 line-clamp-1">
              {paper.feedback.trim() || "No feedback"}
            </span>
          </li>
        ))}
      </ul>
      {papers.length > listed.length ? (
        <span className="text-muted-foreground">
          {papers.length - listed.length} more in Submissions
        </span>
      ) : null}
    </>
  );
}

/**
 * A row's papers on its axis, a dot per paper, each showing its feedback and
 * opening its paper. A pile stacks up to the row's ceiling and spreads
 * sideways past it, and a pile past `MOST_LAYERS` folds its highest scores
 * into a count that opens those learners.
 */
export function Scores({
  papers,
  max,
  mark,
  names,
  onPaper,
  onLearners,
  among = papers,
}: {
  papers: readonly PointPaper[];
  max: number;
  mark: number | null;
  names: Naming;
  onPaper: (submission: string) => void;
  onLearners: (learners: string[], lowest: number, highest: number) => void;
  /** The papers that size the dots and piles; a grader's row follows its class row. */
  among?: readonly PointPaper[];
}) {
  const [width, measure] = useWidth();
  const many = among.length > EACH_PAPER;
  const dot = many ? 6 : 10;
  const pitch = many ? 8 : 12;
  const reference = pilesOf(among, max, width, pitch);
  const across = acrossOf(reference, width, pitch);
  const ceiling = ceilingOf(reference, across);
  const piles = pilesOf(papers, max, width, pitch, among).map((pile) => ({
    ...pile,
    ...layoutOf(pile.papers, ceiling, across),
  }));
  const layers = Math.max(
    1,
    ...piles.map(({ shown, wide }) => Math.ceil(shown.length / wide)),
  );
  const folds = piles.some(({ folded }) => folded.length > 0);
  const place = (x: number, wide: number) =>
    width > 0
      ? { left: leftOf(x, wide, width, pitch) }
      : { left: `${x * 100}%`, transform: "translateX(-50%)" };
  return (
    <Plot
      max={max}
      height={Math.max(24, layers * pitch + (folds ? COUNT : 0) + 4)}
      mark={mark}
      measure={measure}
    >
      {piles.map(({ x, shown, folded, wide }) => {
        const lowest = folded[0]?.score ?? 0;
        const highest = folded.at(-1)?.score ?? 0;
        const range =
          lowest === highest
            ? score(lowest)
            : `${score(lowest)} to ${score(highest)}`;
        return (
          <span
            key={x}
            className="absolute bottom-0.5 flex flex-col-reverse items-center"
            style={{ width: wide * pitch, ...place(x, wide) }}
          >
            <span className="flex w-full flex-wrap-reverse justify-center">
              {shown.map((paper) => (
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
                  style={{ width: pitch, height: pitch }}
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
                    style={{ width: dot, height: dot }}
                  />
                </button>
              ))}
            </span>
            {folded.length > 0 ? (
              <button
                type="button"
                data-more
                aria-label={`${folded.length} more at ${range}`}
                onClick={() =>
                  onLearners(
                    folded.map((paper) => paper.learner),
                    lowest,
                    highest,
                  )
                }
                className={cn(
                  "shrink-0 rounded px-0.5 text-[0.68rem] leading-none font-semibold whitespace-nowrap tabular-nums text-muted-foreground hover:text-foreground",
                  RING,
                )}
                style={{ height: COUNT }}
                {...hoverable(() => (
                  <FoldedCard
                    papers={folded}
                    max={max}
                    names={names}
                    heading={`${folded.length} more at ${range}`}
                  />
                ))}
              >
                +{folded.length}
              </button>
            ) : null}
          </span>
        );
      })}
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
 * By grader under a points row: each grader's papers on the row's axis, with
 * the class row's dots and pile width, and their statistic.
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
    lowest: number,
    highest: number,
    grader: string | null,
  ) => void;
}) {
  const max = maxOf(row);
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
              onLearners={(learners, lowest, highest) =>
                onLearners(learners, lowest, highest, grader)
              }
              among={row.papers}
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

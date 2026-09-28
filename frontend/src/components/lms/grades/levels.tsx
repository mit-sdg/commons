"use client";

import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import {
  type CompetencyPaper,
  type CompetencyRow,
  type CompetencyTally,
  type CriterionRow,
  isBlank,
  LEVELS,
  type Level,
  NOT_ASSESSED,
} from "@/lib/grade-analysis";
import { cn } from "@/lib/utils";
import {
  EACH_PAPER,
  LEVEL_FILL,
  LEVEL_NAMES,
  NO_GRADER,
  type Rating,
  RING,
} from "./common";
import { hoverable } from "./hover";
import type { Naming } from "./names";
import { PaperButton, PaperCard } from "./paper";

const below = (tally: CompetencyTally) =>
  tally.levels.DEFICIENT + tally.levels.EMERGENT;
const above = (tally: CompetencyTally) => tally.competentOrAbove;

interface Scale {
  center: number;
  classUnit: number;
  graderUnit: number;
  cells: boolean;
}

export function scaleOf(rows: readonly CompetencyRow[]): Scale {
  const most = (pick: (tally: CompetencyTally) => number) =>
    Math.max(1, ...rows.map((row) => pick(row.tally)));
  const left = most(below);
  const right = most(above);
  const center = left / (left + right);
  const classUnit = 1 / (left + right);
  const cells = rows.every((row) => row.tally.rated <= EACH_PAPER);
  if (cells) return { center, classUnit, graderUnit: classUnit, cells };
  const piles = rows.flatMap((row) => row.byGrader.map((own) => own.tally));
  const pileLeft = Math.max(1, ...piles.map(below));
  const pileRight = Math.max(1, ...piles.map(above));
  return {
    center,
    classUnit,
    graderUnit: Math.min(center / pileLeft, (1 - center) / pileRight),
    cells,
  };
}

export function LevelBar({
  tally,
  label,
  center,
  unit,
  cells,
  compact,
  onLevel,
}: {
  tally: CompetencyTally;
  label: string;
  center: number;
  unit: number;
  cells: boolean;
  compact?: boolean;
  onLevel: (level: Level) => void;
}) {
  const at = (share: number) => `${share * 100}%`;
  const segments: { level: Level; start: number; n: number }[] = [];
  const place = (level: Level, from: number, side: -1 | 1) => {
    const n = tally.levels[level];
    if (n > 0)
      segments.push({
        level,
        n,
        start: side < 0 ? center - (from + n) * unit : center + from * unit,
      });
  };
  place("EMERGENT", 0, -1);
  place("DEFICIENT", tally.levels.EMERGENT, -1);
  place("COMPETENT", 0, 1);
  place("EXPERT", tally.levels.COMPETENT, 1);
  const left = below(tally);
  const right = above(tally);
  return (
    <div className="px-9">
      <div
        role="group"
        aria-label={`${label}: ${left} below Competent, ${right} Competent or above`}
        className={cn("relative", compact ? "h-2.5" : "h-4")}
      >
        {segments.map(({ level, start, n }) => {
          const side = level === "COMPETENT" || level === "EXPERT" ? 2 : -2;
          const style = {
            left: `calc(${at(start)} + ${side}px)`,
            width: at(n * unit),
          };
          const fill = cn(
            "absolute inset-y-0 rounded-[1.5px] group-hover:brightness-110",
            LEVEL_FILL[level],
          );
          const fills = cells ? (
            Array.from({ length: n }, (_, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: a level's cells are identical
                key={index}
                className={fill}
                style={{
                  left: `${(index / n) * 100}%`,
                  width: `calc(${100 / n}% - 1px)`,
                }}
              />
            ))
          ) : (
            <span
              className={fill}
              style={{ left: 0, width: "calc(100% - 1px)" }}
            />
          );
          const said = `${n} ${LEVEL_NAMES[level]}`;
          return (
            <button
              key={level}
              type="button"
              aria-label={said}
              title={said}
              onClick={(event) => {
                event.stopPropagation();
                onLevel(level);
              }}
              className={cn("group absolute inset-y-0", RING)}
              style={style}
            >
              {fills}
            </button>
          );
        })}
        <span
          aria-hidden
          className={cn(
            "absolute w-0.5 -translate-x-1/2 bg-foreground",
            compact ? "-inset-y-[3px]" : "-inset-y-1",
          )}
          style={{ left: at(center) }}
        />
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-y-1/2 whitespace-nowrap tabular-nums",
            compact ? "text-xs text-muted-foreground" : "text-sm",
          )}
          style={{ right: `calc(${at(1 - (center - left * unit))} + 7px)` }}
        >
          {left}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-y-1/2 whitespace-nowrap tabular-nums",
            compact ? "text-xs text-muted-foreground" : "text-sm",
          )}
          style={{ left: `calc(${at(center + right * unit)} + 7px)` }}
        >
          {right}
        </span>
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <ul
      aria-label="Rating levels"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground"
    >
      {LEVELS.map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5">
          {level === "COMPETENT" ? (
            <span aria-hidden className="mr-2 h-3.5 w-0.5 bg-foreground" />
          ) : null}
          <span
            aria-hidden
            className={cn("size-2.5 rounded-[2px]", LEVEL_FILL[level])}
          />
          {LEVEL_NAMES[level]}
        </li>
      ))}
    </ul>
  );
}

export function NotRated({ row }: { row: CompetencyRow }) {
  const marked = row.tally.notAssessed;
  const pending = row.unrated.length;
  if (marked + pending === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {marked + pending} not rated
      {marked > 0 ? (
        <InlineHelp label="Not rated">
          <span className="flex flex-col gap-1">
            <span>{marked} marked Not assessed</span>
            {pending > 0 ? <span>{pending} not rated yet</span> : null}
          </span>
        </InlineHelp>
      ) : null}
    </span>
  );
}

function ratingsOf(row: CompetencyRow): Rating[] {
  return row.tally.notAssessed > 0 ? [...LEVELS, NOT_ASSESSED] : [...LEVELS];
}

function ColumnHead({ row, rating }: { row: CompetencyRow; rating: Rating }) {
  const n =
    rating === NOT_ASSESSED ? row.tally.notAssessed : row.tally.levels[rating];
  return (
    <>
      <h3 className="flex items-center gap-2 font-sans text-sm font-semibold">
        {rating !== NOT_ASSESSED ? (
          <span
            aria-hidden
            className={cn(
              "size-2.5 shrink-0 rounded-[2px]",
              LEVEL_FILL[rating],
            )}
          />
        ) : null}
        {LEVEL_NAMES[rating]}
        <span className="font-normal tabular-nums text-muted-foreground">
          {n}
        </span>
      </h3>
      {rating !== NOT_ASSESSED && row.descriptions[rating] ? (
        <p
          className="line-clamp-2 text-xs text-muted-foreground"
          title={row.descriptions[rating]}
        >
          {row.descriptions[rating]}
        </p>
      ) : null}
    </>
  );
}

export const columnId = (row: CriterionRow, rating: Rating) =>
  `${row.key}-column-${rating}`;

export function LevelColumns({
  row,
  names,
  onPaper,
}: {
  row: CompetencyRow;
  names: Naming;
  onPaper: (submission: string) => void;
}) {
  const ratings = ratingsOf(row);
  return (
    <div
      className={cn(
        "grid gap-2.5 pt-3.5 sm:grid-cols-2",
        ratings.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {ratings.map((rating) => {
        const papers = row.papers.filter((paper) => paper.rating === rating);
        return (
          <section
            key={rating}
            id={columnId(row, rating)}
            aria-label={LEVEL_NAMES[rating]}
            className={cn(
              "min-w-0 self-start overflow-hidden rounded-lg border border-border bg-card",
              rating === "COMPETENT" &&
                "lg:shadow-[-3px_0_0_-1px_var(--foreground)]",
            )}
          >
            <header className="space-y-0.5 border-b border-border px-3 py-2">
              <ColumnHead row={row} rating={rating} />
            </header>
            {papers.length > 0 ? (
              <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto overscroll-contain p-1.5">
                {papers.map((paper) => (
                  <li key={paper.learner}>
                    <PaperButton
                      paper={paper}
                      names={names}
                      onPaper={onPaper}
                      lettered
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function GraderGrid({
  row,
  names,
  chosen,
  onChoose,
  onPaper,
}: {
  row: CompetencyRow;
  names: Naming;
  chosen: string | null;
  onChoose: (grader: string | null) => void;
  onPaper: (submission: string) => void;
}) {
  const ratings = ratingsOf(row);
  const text = row.tally.rated + row.tally.notAssessed <= EACH_PAPER;
  const piles = row.byGrader;
  const cell = (rating: Rating) =>
    cn(
      "min-w-0 border-t border-border px-2.5 py-2",
      rating === "COMPETENT" && "shadow-[inset_2px_0_0_var(--foreground)]",
    );
  return (
    <div className="overflow-x-auto pt-3.5">
      <div
        className="grid min-w-[46rem] rounded-lg border border-border bg-card"
        style={{
          gridTemplateColumns: `7.5rem repeat(${ratings.length}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {ratings.map((rating) => (
          <div
            key={rating}
            id={columnId(row, rating)}
            className={cn(cell(rating), "space-y-0.5 border-t-0")}
          >
            <ColumnHead row={row} rating={rating} />
          </div>
        ))}
        {piles.map(({ grader }) => {
          const key = grader ?? NO_GRADER;
          const open = text || chosen === key;
          return (
            <Fragment key={key}>
              <div
                data-grader={key}
                data-lights
                className={cn(
                  "border-t border-border px-2.5 py-2 text-sm text-muted-foreground",
                  names.mine(grader) && "font-semibold text-foreground",
                )}
              >
                {text ? (
                  names.grader(grader)
                ) : (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => onChoose(chosen === key ? null : key)}
                    className={cn("flex items-start gap-1 text-left", RING)}
                  >
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "mt-0.5 size-4 shrink-0 transition-transform",
                        open && "rotate-90",
                      )}
                    />
                    {names.grader(grader)}
                  </button>
                )}
              </div>
              {ratings.map((rating) => {
                const papers = row.papers.filter(
                  (paper) => paper.grader === grader && paper.rating === rating,
                );
                return (
                  <div
                    key={rating}
                    className={cn(cell(rating), !text && open && "bg-muted/60")}
                  >
                    {papers.length === 0 ? null : open ? (
                      <ul className="-mx-1.5 space-y-0.5">
                        {papers.map((paper) => (
                          <li key={paper.learner}>
                            <PaperButton
                              paper={paper}
                              names={names}
                              onPaper={onPaper}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="flex flex-wrap items-center gap-[3px]">
                        {papers.map((paper) => (
                          <PaperSquare
                            key={paper.learner}
                            paper={paper}
                            names={names}
                            onPaper={onPaper}
                          />
                        ))}
                        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                          {papers.length}
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function PaperSquare({
  paper,
  names,
  onPaper,
}: {
  paper: CompetencyPaper;
  names: Naming;
  onPaper: (submission: string) => void;
}) {
  const blank = isBlank(paper.feedback);
  return (
    <button
      type="button"
      aria-label={`${names.grader(paper.grader)}, ${LEVEL_NAMES[paper.rating]}${blank ? ", no feedback" : ""}`}
      onClick={() => onPaper(paper.submission)}
      className={cn(
        "size-[11px] rounded-[2px] hover:bg-foreground",
        blank
          ? "shadow-[inset_0_0_0_1.5px_var(--foreground)] opacity-75"
          : "bg-foreground/75",
        RING,
      )}
      {...hoverable(() => (
        <PaperCard
          paper={paper}
          names={names}
          heading={LEVEL_NAMES[paper.rating]}
          label="Feedback"
        />
      ))}
    />
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useRemembered } from "@/hooks/use-remembered";
import type {
  CompetencyRow,
  CriterionRow,
  GradeAnalysis,
  Level,
} from "@/lib/grade-analysis";
import { cn } from "@/lib/utils";
import { NO_GRADER, RING, ROW_GRID, score } from "./common";
import { HoverCard, setHovered } from "./hover";
import {
  columnId,
  GraderGrid,
  Legend,
  LevelBar,
  LevelColumns,
  NotRated,
  scaleOf,
} from "./levels";
import { NamesButton, naming } from "./names";
import { PaperDialog } from "./paper";
import {
  Axis,
  axesOf,
  GraderScores,
  maxOf,
  Scores,
  type Statistic,
  StatisticText,
} from "./points";
import { GraderTable, Summary } from "./readiness";

export interface GradesView {
  byGrader: boolean;
  criterion: string | null;
  grader: string | null;
}

function rowLabel(row: CriterionRow): ReactNode {
  if (row.kind === "COMPETENCY")
    return (
      <>
        {row.name}
        {row.edition !== null ? (
          <span className="text-muted-foreground">, edition {row.edition}</span>
        ) : null}
      </>
    );
  return (
    <>
      {row.kind === "TOTAL" ? "Total" : row.name}{" "}
      <span className="font-normal text-muted-foreground">
        out of {score(maxOf(row))}
      </span>
    </>
  );
}

const FRESH_MS = 10_000;

export function GradesTab({
  analysis,
  viewer,
  view,
  onView,
  loadedAt,
  onRefresh,
  onOpenLearners,
  onOpenPaper,
  paperText,
  hasSetup,
  refreshError,
}: {
  analysis: GradeAnalysis;
  viewer: string | null;
  view: GradesView;
  onView: (view: GradesView, mode: "push" | "replace") => void;
  loadedAt: number | null;
  onRefresh: () => void;
  onOpenLearners: (learners: string[], said: string) => void;
  onOpenPaper: (submission: string) => void;
  paperText: (submission: string) => string[] | null;
  hasSetup: boolean;
  refreshError: boolean;
}) {
  const [reading, setReading] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [graderNames, setGraderNames] = useRemembered(
    "commons.grades.grader-names",
  );
  const [studentNames, setStudentNames] = useRemembered(
    "commons.grades.student-names",
  );
  const [gradersShown, setGradersShown] = useRemembered(
    "commons.grades.graders",
  );
  const [meanChosen, setMeanChosen] = useRemembered("commons.grades.mean");
  const statistic: Statistic = meanChosen ? "mean" : "median";
  const names = naming(analysis.graders, viewer, graderNames, studentNames);
  const rows = analysis.rows;
  const competency = rows.filter(
    (row): row is CompetencyRow => row.kind === "COMPETENCY",
  );
  const open = competency.find((row) => row.key === view.criterion) ?? null;
  const scale = scaleOf(competency);
  const hasPoints = rows.some((row) => row.kind !== "COMPETENCY");
  const twoMethods = competency.length > 0 && hasPoints;
  const lit = useRef<HTMLStyleElement>(null);
  const flashing = useRef<string | null>(null);

  const latest = useRef({ loadedAt, onRefresh, reading });
  useEffect(() => {
    latest.current = { loadedAt, onRefresh, reading };
  });
  useEffect(() => {
    let woke = 0;
    function wake() {
      const { loadedAt, onRefresh, reading } = latest.current;
      if (document.visibilityState !== "visible" || reading !== null) return;
      const now = Date.now();
      if (loadedAt !== null && now - loadedAt < FRESH_MS) return;
      if (now - woke < FRESH_MS) return;
      woke = now;
      onRefresh();
    }
    wake();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  const arrived = useRef(false);
  const openKey = open?.key;
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    if (openKey)
      document
        .getElementById(`criterion-${openKey}`)
        ?.scrollIntoView({ block: "start" });
  }, [openKey]);

  useEffect(() => {
    const id = flashing.current;
    if (!id) return;
    flashing.current = null;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      target.animate(
        [
          {
            backgroundColor:
              "color-mix(in oklch, var(--foreground) 16%, transparent)",
          },
          { backgroundColor: "transparent" },
        ],
        { duration: 1200, easing: "ease-out" },
      );
  });

  function light(target: EventTarget) {
    if (!lit.current || !(target instanceof Element)) return;
    const source = target.closest("[data-grader]");
    const grader = source?.getAttribute("data-grader");
    const selector = grader ? `[data-grader="${CSS.escape(grader)}"]` : null;
    const fade = source?.hasAttribute("data-lights")
      ? "[data-dot]>span{opacity:.3}"
      : "";
    const rule = selector
      ? `${selector}[data-lights]{background:color-mix(in oklch,var(--foreground) 7%,transparent)}${fade}${selector}[data-dot]>span{opacity:1;background:var(--foreground)}`
      : "";
    if (lit.current.textContent !== rule) lit.current.textContent = rule;
  }

  function choose(criterion: string | null, grader: string | null) {
    onView({ ...view, criterion, grader }, "push");
  }

  function toggle(row: CriterionRow) {
    choose(view.criterion === row.key ? null : row.key, null);
  }

  function openAt(row: CompetencyRow, level: Level, grader: string | null) {
    flashing.current = columnId(row, level);
    choose(row.key, grader);
  }

  function openScored(
    row: CriterionRow,
    learners: string[],
    lowest: number,
    highest: number,
    grader?: string | null,
  ) {
    const on =
      row.kind === "TOTAL"
        ? "the total"
        : row.kind === "POINTS"
          ? row.name
          : "";
    const by =
      grader === undefined ? "" : `, graded by ${names.grader(grader)}`;
    const range =
      lowest === highest
        ? score(lowest)
        : `${score(lowest)} to ${score(highest)}`;
    onOpenLearners(
      learners,
      `${learners.length} scored ${range} on ${on}${by}`,
    );
  }

  function readPaper(submission: string) {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setHovered(null);
    setReading(submission);
  }

  const axes = axesOf(rows);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: lighting a grader follows the pointer and focus; it changes nothing
    <div
      className="space-y-6 [overflow-wrap:anywhere]"
      onPointerOver={(event) => light(event.target)}
      onPointerLeave={(event) => light(event.currentTarget)}
      onFocus={(event) => light(event.target)}
    >
      <style ref={lit} />
      {refreshError ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 text-sm text-destructive"
        >
          Grades could not be refreshed.
          <Button
            size="sm"
            variant="outline"
            className={RING}
            onClick={onRefresh}
          >
            Retry
          </Button>
        </p>
      ) : null}

      <Summary
        readiness={analysis.readiness}
        dropped={analysis.dropped}
        onOpen={onOpenLearners}
        graders={gradersShown}
        onGraders={setGradersShown}
        names={
          <NamesButton
            graderNames={graderNames}
            studentNames={studentNames}
            onGraderNames={setGraderNames}
            onStudentNames={setStudentNames}
          />
        }
      />
      {gradersShown ? (
        <GraderTable
          analysis={analysis}
          viewer={viewer}
          names={names}
          onOpen={onOpenLearners}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-3.5">
            <h2 className="font-medium">Criteria</h2>
            <Segmented
              label="Criteria view"
              value={view.byGrader ? "grader" : "class"}
              options={[
                ["class", "Class"],
                ["grader", "By grader"],
              ]}
              onChange={(chosen) =>
                onView({ ...view, byGrader: chosen === "grader" }, "replace")
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {competency.length > 0 ? <Legend /> : null}
            {hasPoints ? (
              <Segmented
                label="Statistic"
                value={statistic}
                options={[
                  ["median", "Median"],
                  ["mean", "Mean"],
                ]}
                onChange={(chosen) => setMeanChosen(chosen === "mean")}
              />
            ) : null}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {analysis.readiness.counted === 0
              ? "No submitted work yet."
              : !hasSetup
                ? "No grading setup yet."
                : analysis.readiness.counted ===
                    analysis.readiness.excused.length
                  ? "Everyone is excused."
                  : "No ratings yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {rows.map((row, index) => {
              const isOpen = row.key === open?.key;
              const previous = rows[index - 1];
              const heading =
                twoMethods &&
                (!previous ||
                  (previous.kind === "COMPETENCY") !==
                    (row.kind === "COMPETENCY"));
              const max = axes[index] ?? null;
              return (
                <Fragment key={row.key}>
                  {heading ? (
                    <li className="pt-4 pb-1 text-sm font-medium text-muted-foreground">
                      {row.kind === "COMPETENCY"
                        ? "Rated by level"
                        : "Scored in points"}
                    </li>
                  ) : null}
                  {max !== null ? (
                    <li aria-hidden className="border-b-0 pt-2.5">
                      <div className={cn("grid gap-x-4", ROW_GRID)}>
                        <span />
                        <Axis max={max} />
                      </div>
                    </li>
                  ) : null}
                  <li id={`criterion-${row.key}`} className="py-3">
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: the name button is the keyboard control; the row is a larger target for the same action */}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: the row is a larger pointer target for its name button */}
                    <div
                      className={cn(
                        "grid items-center gap-x-4 gap-y-2",
                        row.kind === "COMPETENCY" && "cursor-pointer",
                        ROW_GRID,
                      )}
                      onClick={
                        row.kind === "COMPETENCY"
                          ? () => toggle(row)
                          : undefined
                      }
                    >
                      {row.kind === "COMPETENCY" ? (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle(row);
                          }}
                          className={cn(
                            "flex min-w-0 items-baseline gap-1.5 text-left font-medium",
                            RING,
                          )}
                        >
                          <ChevronRight
                            aria-hidden
                            className={cn(
                              "size-4 shrink-0 self-center text-muted-foreground transition-transform",
                              isOpen && "rotate-90",
                            )}
                          />
                          <span className="min-w-0">{rowLabel(row)}</span>
                        </button>
                      ) : (
                        <span className="min-w-0 pl-[1.375rem] font-medium">
                          {rowLabel(row)}
                        </span>
                      )}
                      {row.kind === "COMPETENCY" ? (
                        <LevelBar
                          tally={row.tally}
                          label={row.name}
                          center={scale.center}
                          unit={scale.classUnit}
                          cells={scale.cells}
                          onLevel={(level) => openAt(row, level, null)}
                        />
                      ) : (
                        <Scores
                          papers={row.papers}
                          max={maxOf(row)}
                          mark={row.scores[statistic]}
                          names={names}
                          onPaper={readPaper}
                          onLearners={(learners, lowest, highest) =>
                            openScored(row, learners, lowest, highest)
                          }
                        />
                      )}
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                        {row.kind === "COMPETENCY" ? (
                          <NotRated row={row} />
                        ) : (
                          <>
                            <StatisticText
                              statistic={statistic}
                              scores={row.scores}
                            />
                            {row.kind === "TOTAL" &&
                            row.withoutTotal.length > 0 ? (
                              <span className="text-muted-foreground">
                                {row.withoutTotal.length} without a total
                              </span>
                            ) : null}
                            {row.kind === "POINTS" && row.unrated.length > 0 ? (
                              <span className="text-muted-foreground">
                                {row.unrated.length} not scored
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>
                    </div>
                    {row.kind === "COMPETENCY" && view.byGrader ? (
                      <div className="space-y-1.5 pt-2">
                        {row.byGrader.map(({ grader, tally }) => {
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
                              <button
                                type="button"
                                onClick={() =>
                                  choose(
                                    isOpen && view.grader === key
                                      ? null
                                      : row.key,
                                    isOpen && view.grader === key ? null : key,
                                  )
                                }
                                className={cn(
                                  "text-left text-muted-foreground hover:text-foreground sm:pl-5",
                                  names.mine(grader) &&
                                    "font-semibold text-foreground",
                                  RING,
                                )}
                              >
                                {names.grader(grader)}
                              </button>
                              <LevelBar
                                tally={tally}
                                label={names.grader(grader)}
                                center={scale.center}
                                unit={scale.graderUnit}
                                cells={scale.cells}
                                compact
                                onLevel={(level) => openAt(row, level, key)}
                              />
                              <span />
                            </div>
                          );
                        })}
                      </div>
                    ) : view.byGrader && row.kind !== "COMPETENCY" ? (
                      <GraderScores
                        row={row}
                        statistic={statistic}
                        names={names}
                        onPaper={readPaper}
                        onLearners={(learners, lowest, highest, grader) =>
                          openScored(row, learners, lowest, highest, grader)
                        }
                      />
                    ) : null}
                    {!isOpen ||
                    row.kind !== "COMPETENCY" ? null : view.byGrader ? (
                      <GraderGrid
                        row={row}
                        names={names}
                        chosen={view.grader}
                        onChoose={(grader) => choose(row.key, grader)}
                        onPaper={readPaper}
                      />
                    ) : (
                      <LevelColumns
                        row={row}
                        names={names}
                        onPaper={readPaper}
                      />
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </section>
      <HoverCard />
      <PaperDialog
        result={
          reading === null
            ? null
            : (analysis.learners.find(
                (learner) =>
                  learner.attempt &&
                  String(learner.attempt.submission) === reading,
              ) ?? null)
        }
        text={reading === null ? null : paperText(reading)}
        names={names}
        opener={opener}
        onClose={() => setReading(null)}
        onOpenInSubmissions={(submission) => {
          setReading(null);
          onOpenPaper(submission);
        }}
      />
    </div>
  );
}

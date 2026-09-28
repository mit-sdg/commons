"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import type { GradeAnalysis, Readiness } from "@/lib/grade-analysis";
import { cn } from "@/lib/utils";
import { NO_GRADER, RING } from "./common";
import type { Naming } from "./names";

function Opens({
  learners,
  said,
  onOpen,
  className,
  children,
}: {
  learners: string[];
  said: string;
  onOpen: (learners: string[], said: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={learners.length === 0}
      onClick={() => onOpen(learners, said)}
      className={cn(
        "tabular-nums underline decoration-foreground/30 decoration-dotted underline-offset-4 hover:decoration-current hover:decoration-solid disabled:no-underline",
        RING,
        className,
      )}
    >
      {children}
    </button>
  );
}

function Part({
  mark,
  n,
  noun,
  learners,
  onOpen,
  help,
}: {
  mark?: string;
  n: number;
  noun: string;
  learners: string[];
  onOpen: (learners: string[], said: string) => void;
  help?: ReactNode;
}) {
  if (n === 0) return null;
  const said = `${n} ${noun}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      {mark ? (
        <span aria-hidden className={cn("h-1.5 w-3.5 rounded-full", mark)} />
      ) : null}
      <Opens learners={learners} said={said} onOpen={onOpen}>
        <span className="font-semibold">{n}</span>{" "}
        <span className="text-muted-foreground">{noun}</span>
      </Opens>
      {help}
    </span>
  );
}

export function Summary({
  readiness,
  dropped,
  onOpen,
  graders,
  onGraders,
  names,
}: {
  readiness: Readiness;
  dropped: string[];
  onOpen: (learners: string[], said: string) => void;
  graders: boolean;
  onGraders: (on: boolean) => void;
  names: ReactNode;
}) {
  const { gradable, drafts, toFinish } = readiness;
  const share = (n: number) => `${gradable > 0 ? (n / gradable) * 100 : 0}%`;
  const complete = `${readiness.complete.length} of ${gradable} complete`;
  const apart: [string[], string][] = [
    [readiness.excused, `${readiness.excused.length} excused`],
    [dropped, `${dropped.length} dropped`],
  ];
  const parts: [string[], string][] = [
    [readiness.incomplete, `${readiness.incomplete.length} incomplete`],
    [readiness.notStarted, `${readiness.notStarted.length} not started`],
    [
      readiness.newAttempts,
      `${readiness.newAttempts.length} new ${readiness.newAttempts.length === 1 ? "attempt" : "attempts"}`,
    ],
  ];
  const helpList = (entries: [string[], string][]) => (
    <span className="flex flex-col items-start gap-1">
      {entries
        .filter(([learners]) => learners.length > 0)
        .map(([learners, said]) => (
          <Opens key={said} learners={learners} said={said} onOpen={onOpen}>
            {said}
          </Opens>
        ))}
    </span>
  );
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Opens
            learners={readiness.complete}
            said={complete}
            onOpen={onOpen}
            className="font-display text-xl font-semibold"
          >
            {complete}
          </Opens>
          {apart.some(([learners]) => learners.length > 0) ? (
            <InlineHelp label="Not counted">
              <span className="block pb-1 text-muted-foreground">
                Not counted
              </span>
              {helpList(apart)}
            </InlineHelp>
          ) : null}
        </div>
        {names}
      </div>
      <div
        role="img"
        aria-label={`${readiness.released.length} released, ${drafts.length} complete drafts, ${toFinish.length} to finish`}
        className="flex h-2 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="h-full bg-foreground/80"
          style={{ width: share(readiness.released.length) }}
        />
        <span
          className="h-full bg-foreground/35"
          style={{ width: share(drafts.length) }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <Part
          mark="bg-foreground/80"
          n={readiness.released.length}
          noun="released"
          learners={readiness.released}
          onOpen={onOpen}
        />
        <Part
          mark="bg-foreground/35"
          n={drafts.length}
          noun={drafts.length === 1 ? "complete draft" : "complete drafts"}
          learners={drafts}
          onOpen={onOpen}
        />
        <Part
          mark="bg-border"
          n={toFinish.length}
          noun="to finish"
          learners={toFinish}
          onOpen={onOpen}
          help={<InlineHelp label="To finish">{helpList(parts)}</InlineHelp>}
        />
        {readiness.withoutFeedback.length > 0 ||
        readiness.withoutGrader.length > 0 ? (
          <span aria-hidden className="h-4 w-px bg-border max-sm:hidden" />
        ) : null}
        <Part
          n={readiness.withoutFeedback.length}
          noun="without feedback"
          learners={readiness.withoutFeedback}
          onOpen={onOpen}
        />
        <Part
          n={readiness.withoutGrader.length}
          noun="without a grader"
          learners={readiness.withoutGrader}
          onOpen={onOpen}
        />
        <button
          type="button"
          aria-expanded={graders}
          onClick={() => onGraders(!graders)}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md py-0.5 pr-2 pl-1 text-muted-foreground hover:bg-muted hover:text-foreground",
            RING,
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 transition-transform",
              graders && "rotate-90",
            )}
          />
          Graders
        </button>
      </div>
    </div>
  );
}

export function GraderTable({
  analysis,
  viewer,
  names,
  onOpen,
}: {
  analysis: GradeAnalysis;
  viewer: string | null;
  names: Naming;
  onOpen: (learners: string[], said: string) => void;
}) {
  const lines = analysis.readinessByGrader;
  const idle = analysis.graders.filter(
    (grader) =>
      grader.grader === viewer &&
      !lines.some((line) => line.grader === grader.grader),
  );
  return (
    <div className="overflow-x-auto">
      <table className="text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-6 font-medium">Grader</th>
            <th className="py-1.5 pr-6 font-medium">Complete</th>
            <th className="py-1.5 pr-6 text-right font-medium">To finish</th>
            <th className="py-1.5 text-right font-medium">Without feedback</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ grader, readiness }) => {
            const { gradable, toFinish } = readiness;
            const who = names.grader(grader);
            return (
              <tr
                key={grader ?? NO_GRADER}
                data-grader={grader ?? NO_GRADER}
                data-lights
                className="border-b border-border"
              >
                <td
                  className={cn(
                    "py-1.5 pr-6 whitespace-nowrap",
                    grader === null && "text-muted-foreground",
                    names.mine(grader) && "font-semibold",
                  )}
                >
                  {who}
                </td>
                <td className="py-1.5 pr-6">
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full bg-foreground/80"
                        style={{
                          width: `${gradable > 0 ? (readiness.complete.length / gradable) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <Opens
                      learners={readiness.complete}
                      said={`${who}, ${readiness.complete.length} complete`}
                      onOpen={onOpen}
                    >
                      {readiness.complete.length} of {gradable}
                    </Opens>
                  </span>
                </td>
                <td className="py-1.5 pr-6 text-right">
                  {toFinish.length > 0 ? (
                    <Opens
                      learners={toFinish}
                      said={`${who}, ${toFinish.length} to finish`}
                      onOpen={onOpen}
                    >
                      {toFinish.length}
                    </Opens>
                  ) : null}
                </td>
                <td className="py-1.5 text-right">
                  {readiness.withoutFeedback.length > 0 ? (
                    <Opens
                      learners={readiness.withoutFeedback}
                      said={`${who}, ${readiness.withoutFeedback.length} without feedback`}
                      onOpen={onOpen}
                    >
                      {readiness.withoutFeedback.length}
                    </Opens>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {idle.map((grader) => (
            <tr key={grader.grader} className="border-b border-border">
              <td className="py-1.5 pr-6 font-semibold whitespace-nowrap">
                {names.grader(grader.grader)}
              </td>
              <td className="py-1.5 text-muted-foreground" colSpan={3}>
                No submitted work yet
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import {
  type RunBoardQuestion,
  splitValues,
} from "@/components/live/run-board";
import { cn } from "@/lib/utils";

/** Every response begun under a seat, whether or not it was handed in. */
type ModelResponses = { response: string }[];

/**
 * The levels that let the room learn the answers afterward. Disclosure is
 * frozen into a run's key at launch, so the mark on this screen is the one the
 * author chose before the room began.
 */
export function marksExpected(disclosure: string): boolean {
  return disclosure === "answers" || disclosure === "explanations";
}

/**
 * How many columns the questions stand in. A room's screen is one height and
 * nobody is there to scroll it, so a longer questionnaire goes wider rather
 * than taller.
 */
export function columnsFor(questions: number): 1 | 2 | 3 {
  if (questions <= 2) return 1;
  if (questions <= 6) return 2;
  return 3;
}

const COLUMNS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
};

export interface ProjectedTally {
  label: string;
  count: number;
  /** A value nobody was offered, gathered under one heading rather than dropped. */
  other: boolean;
  /** The choice the question expected; never set on a survey, which expects none. */
  expected: boolean;
}

/**
 * The room's answers counted against the choices it was offered. Anything that
 * matches no choice is gathered under one heading, so the bars always add up to
 * the answers actually given.
 */
export function tallyRoom(
  choices: string[],
  values: string[],
  expected: string,
): ProjectedTally[] {
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

/**
 * One row of a tally, sized to be read from the back of the room. The bar
 * carries exactly the share of the room's answers the choice took, and the
 * figure beside it is the count.
 */
function Bar({
  label,
  count,
  total,
  muted,
  expected,
}: {
  label: string;
  count: number;
  total: number;
  muted: boolean;
  expected: boolean;
}) {
  const share = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div
      className={cn(
        "space-y-[clamp(0.2rem,0.6dvh,0.4rem)]",
        expected && "-mx-2 rounded-lg bg-primary/5 px-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={cn(
            "line-clamp-1 min-w-0 text-[clamp(1rem,2dvh,1.5rem)]",
            muted && "text-muted-foreground italic",
            expected && "font-medium",
          )}
        >
          {expected ? (
            <Check className="me-2 inline-block size-[1em] align-baseline text-primary" />
          ) : null}
          <span dir="auto">{label}</span>
          {expected ? (
            <span className="sr-only"> (expected answer)</span>
          ) : null}
        </span>
        <span className="shrink-0 font-semibold text-[clamp(1rem,2dvh,1.5rem)] tabular-nums">
          {count}
        </span>
      </div>
      <div className="h-[clamp(0.5rem,1.2dvh,0.9rem)] w-full overflow-hidden rounded-full bg-muted">
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

/** One question on the room's screen: bars where choices were offered, a count where not. */
function QuestionPanel({
  question,
  modelResponses,
  markExpected,
}: {
  question: RunBoardQuestion;
  modelResponses: ModelResponses;
  markExpected: boolean;
}) {
  const { room } = splitValues(question.values, modelResponses);
  const values = room.map((entry) => entry.value);
  const rows = tallyRoom(
    question.choices,
    values,
    markExpected ? question.expected : "",
  );

  return (
    <section className="flex min-h-0 flex-col gap-[clamp(0.4rem,1.2dvh,1rem)] overflow-hidden rounded-xl border border-border bg-card px-[clamp(0.75rem,1.5vw,1.5rem)] py-[clamp(0.5rem,1.5dvh,1.25rem)]">
      <h2
        dir="auto"
        className="line-clamp-2 text-balance font-display text-[clamp(1.05rem,2.4dvh,1.9rem)] font-semibold"
      >
        {question.prompt}
      </h2>
      {question.choices.length > 0 ? (
        <div className="flex min-h-0 flex-col gap-[clamp(0.35rem,1dvh,0.8rem)] overflow-hidden">
          {rows.map((row, index) => (
            <Bar
              key={`${row.label}-${index}`}
              label={row.label}
              count={row.count}
              total={values.length}
              muted={row.other}
              expected={row.expected}
            />
          ))}
        </div>
      ) : (
        <div>
          <p className="text-[clamp(0.8rem,1.4dvh,1.05rem)] tracking-wide text-muted-foreground uppercase">
            Written answers
          </p>
          <p className="font-display text-[clamp(1.75rem,4.5dvh,3.5rem)] font-semibold tabular-nums">
            {values.length}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * What a closed run shows the room: every question's tallies in the room's own
 * figure. No score, no name, no written text, and no model figure.
 */
export function QuizResults({
  questions,
  modelResponses,
  markExpected,
}: {
  questions: RunBoardQuestion[];
  modelResponses: ModelResponses;
  /** The run's disclosure lets the room learn the answers, so the expected choice is marked. */
  markExpected: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-h-0 w-full flex-1 auto-rows-fr gap-[clamp(0.5rem,1.5dvh,1.25rem)] overflow-hidden text-start",
        COLUMNS[columnsFor(questions.length)],
      )}
    >
      {questions.map((question) => (
        <QuestionPanel
          key={question.question}
          question={question}
          modelResponses={modelResponses}
          markExpected={markExpected}
        />
      ))}
    </div>
  );
}

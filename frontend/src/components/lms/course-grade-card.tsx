"use client";

import { useId } from "react";
import { InlineHelp } from "@/components/ui/inline-help";
import type { CourseGradeCard as Card } from "@/lib/course-grades";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const RATING_WORDS = {
  DEFICIENT: "Deficient",
  EMERGENT: "Emergent",
  COMPETENT: "Competent",
  EXPERT: "Expert",
} as const;
type Rating = keyof typeof RATING_WORDS;

function number(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

/** The rating whose value is `value`, for naming the ends of the scale. */
function ratingAt(card: Card, value: number): string | null {
  const entry = (Object.entries(card.rules.ratings) as [Rating, number][]).find(
    ([, at]) => at === value,
  );
  return entry ? RATING_WORDS[entry[0]] : null;
}

function end(card: Card, value: number): string {
  const name = ratingAt(card, value);
  return name ? `${number(value)} (${name})` : number(value);
}

/** Each group's share of the weights, as a whole percent. */
function share(weight: number, groups: NonNullable<Card["groups"]>): number {
  const total = groups.reduce(
    (sum, group) => sum + Math.max(group.weight, 0),
    0,
  );
  return total > 0 ? Math.round((weight / total) * 100) : 0;
}

/**
 * A student's course grade as released: the number on the rating scale, the
 * cutoff, the letter when released, and the breakdown when released. Before
 * any release, and after a release is hidden, it says so.
 */
export function CourseGradeCard(
  props:
    | { card: Card; className?: string }
    | { state: "none" | "withdrawn"; className?: string },
) {
  const title = useId();
  return (
    <section
      aria-labelledby={title}
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-4 sm:p-5",
        props.className,
      )}
    >
      {"card" in props ? (
        <Released card={props.card} title={title} />
      ) : (
        <>
          <h2 id={title} className="text-base font-semibold">
            Course grade
          </h2>
          <p className="text-sm text-muted-foreground">
            {props.state === "withdrawn"
              ? "Course grade withdrawn for review."
              : "No course grade released yet."}
          </p>
        </>
      )}
    </section>
  );
}

function Released({ card, title }: { card: Card; title: string }) {
  if (card.status === "held")
    return (
      <>
        <h2 id={title} className="text-base font-semibold">
          Course grade
        </h2>
        <p className="text-sm">
          Staff will contact you about your course grade.
        </p>
      </>
    );
  const rows = (card.groups ?? []).map((group) => ({
    ...group,
    rows: group.rows.filter((row) => row.value !== null || row.note !== null),
  }));
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 id={title} className="text-base font-semibold">
          Course grade
        </h2>
        <InlineHelp label="How the course grade counts">
          <Rules card={card} />
        </InlineHelp>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {card.average === null ? (
          <span className="text-sm text-muted-foreground">
            No work counted yet
          </span>
        ) : (
          <span className="text-4xl leading-none font-semibold tabular-nums">
            {card.average.toFixed(2)}
          </span>
        )}
        {card.letter && (
          <span
            className="rounded-md border border-foreground px-2 text-base font-semibold"
            aria-label={`Letter grade ${card.letter}`}
          >
            {card.letter}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          on a scale from {end(card, card.scale.low)} to{" "}
          {end(card, card.scale.high)}
        </span>
        <span>Work due by {shortDate(card.dueBy)}</span>
        {card.lectures && (
          <span>
            Lectures {card.lectures.attended} of {card.lectures.total}
          </span>
        )}
      </div>
      {card.groups && (
        <div className="grid gap-3 border-t pt-3">
          {rows.map((group) => (
            <div key={group.name} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{group.name}</span>
                  <span className="text-muted-foreground">
                    {group.value === null
                      ? "Not due yet"
                      : `${share(group.weight, card.groups!)}% weight`}
                  </span>
                </span>
                {group.value !== null && (
                  <span className="font-semibold tabular-nums">
                    {group.value.toFixed(2)}
                  </span>
                )}
              </div>
              {group.rows.length > 0 && (
                <ul className="grid gap-1 text-sm">
                  {group.rows.map((row) => (
                    <li
                      key={row.title}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 text-muted-foreground">
                        {row.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-right tabular-nums",
                          row.note && "text-muted-foreground",
                        )}
                      >
                        {row.note ?? row.points ?? row.value?.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Rules({ card }: { card: Card }) {
  const { ratings, missing, late } = card.rules;
  return (
    <div className="grid gap-1.5">
      <p>
        {(Object.keys(RATING_WORDS) as Rating[])
          .map((name) => `${RATING_WORDS[name]} ${number(ratings[name])}`)
          .join(", ")}
        .
      </p>
      <p>Missing work counts as {number(missing)}.</p>
      <p>
        {late === "missing"
          ? `Late work without late days counts as ${number(missing)}.`
          : "Late work without late days counts as graded."}
      </p>
      <p>Excused work is left out.</p>
    </div>
  );
}

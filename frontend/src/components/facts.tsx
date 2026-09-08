import type { ReactNode } from "react";

import { StatusBadge } from "@/components/lms/status-badge";
import { Tag } from "@/components/tag";
import {
  count as countOf,
  dateTime,
  dueTime,
  fullTime,
  rangeTime,
  relativeTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Facts on one line. Each child names its kind, and each kind has one form,
 * so the eye separates the facts by their forms and never by a glyph: a
 * kind is a quiet tag, a status a filled badge, a provenance time relative
 * and muted, a due time absolute and heavier with its countdown, a range one
 * span with an en dash, a count a number and its noun. The rule is in the
 * README under "Interface conventions".
 */
export function Facts({
  children,
  className,
  as: Element = "p",
}: {
  children: ReactNode;
  className?: string;
  /** The element the line is, where a paragraph cannot stand (inside a button or a summary). */
  as?: "p" | "span" | "div" | "li";
}) {
  return (
    <Element
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-0.5",
        className,
      )}
    >
      {children}
    </Element>
  );
}

/** The kind of the thing: essay, quiz, student, a role. */
function Kind({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={className}>{children}</Tag>;
}

/** A state the thing is in, as the one filled element on its line. */
function Status({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return <StatusBadge status={status} label={label} className={className} />;
}

/**
 * When something came to be: relative and muted, the absolute on hover, the
 * verb only where the line does not already say it ("Sent", "Queued",
 * "Latest"). A row that is a record — an attempt, a note — takes the
 * absolute form instead, still muted.
 */
function When({
  at,
  verb,
  form = "relative",
  className,
}: {
  at: unknown;
  verb?: string;
  form?: "relative" | "absolute";
  className?: string;
}) {
  const said = form === "relative" ? relativeTime(at) : dateTime(at);
  if (said === "") return null;
  return (
    <time
      dateTime={typeof at === "string" ? at : undefined}
      title={form === "relative" ? dateTime(at) : undefined}
      className={cn("text-muted-foreground", className)}
    >
      {verb ? `${verb} ${said}` : said}
    </time>
  );
}

/**
 * A due or scheduled time: the absolute in the text colour with the class's
 * zone, then the countdown muted at a tighter gap than facts keep between
 * them. `verb` says which moment this is where the line does not ("Due").
 */
function Due({
  at,
  verb,
  precision = "minute",
  className,
}: {
  at: unknown;
  verb?: string;
  precision?: "minute" | "day";
  className?: string;
}) {
  const absolute = dueTime(at, precision);
  if (absolute === "") return null;
  return (
    <span className={cn("text-foreground", className)}>
      <time
        dateTime={typeof at === "string" ? at : undefined}
        className="font-medium"
      >
        {verb ? `${verb} ${absolute}` : absolute}
      </time>
      <span className="ml-1.5 text-muted-foreground">{relativeTime(at)}</span>
    </span>
  );
}

/**
 * From one moment to another, as one fact; open-ended while it runs. The span
 * is a `<time>` dated at its start, and hovering it gives both ends in full,
 * with the year and the zone the short form drops.
 */
function Range({
  from,
  to,
  verb,
  className,
}: {
  from: unknown;
  to: unknown;
  verb?: string;
  className?: string;
}) {
  const said = rangeTime(from, to);
  if (said === "") return null;
  const start = fullTime(from);
  const end = fullTime(to);
  return (
    <time
      dateTime={typeof from === "string" ? from : undefined}
      title={end === "" ? start : `${start} – ${end}`}
      className={className}
    >
      {verb ? `${verb} ${said}` : said}
    </time>
  );
}

/** A number and its noun, in figures that line up. Pass children to say it your own way. */
function Count({
  n,
  noun,
  plural,
  children,
  className,
}: {
  n?: number;
  noun?: string;
  plural?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {children ?? (n !== undefined && noun ? countOf(n, noun, plural) : null)}
    </span>
  );
}

/** Where the thing lives: "in Course Launch Tasks", muted. */
function Where({
  children,
  preposition = "in",
  className,
}: {
  children: ReactNode;
  preposition?: string;
  className?: string;
}) {
  return (
    <span className={cn("text-muted-foreground", className)}>
      {preposition} {children}
    </span>
  );
}

export const Fact = { Kind, Status, When, Due, Range, Count, Where };

import { courseTimezone } from "@/lib/course";

export function toDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, secs] of UNITS) {
    if (abs >= secs) return rtf.format(Math.round(seconds / secs), unit);
  }
  return "just now";
}

export function fullTime(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: courseTimezone(),
    timeZoneName: "short",
  });
}

/** The year a moment falls in, in the class's zone. */
function yearOf(date: Date, timeZone: string): string {
  return date.toLocaleString(undefined, { year: "numeric", timeZone });
}

/** "Sep 5" this year, "Sep 5, 2019" in another, in the class's zone. */
function dayOf(date: Date, timeZone: string): string {
  const year = yearOf(date, timeZone) !== yearOf(new Date(), timeZone);
  return date.toLocaleDateString(undefined, {
    ...(year ? { year: "numeric" } : {}),
    month: "short",
    day: "numeric",
    timeZone,
  });
}

/** "1:16 PM", or "1:16 PM EDT" with the zone named. */
function clockOf(date: Date, timeZone: string, zone: boolean): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(zone ? { timeZoneName: "short" } : {}),
    timeZone,
  });
}

/**
 * "Sep 5, 1:16 PM": an absolute moment for a fact that is a record or a
 * hover, in the class's zone. The year appears only when it is not this
 * year, and the zone is never named — the due forms name it, because there
 * the zone is what the reader checks. The day and the clock are joined by
 * hand so every locale's joiner reads the same.
 */
export function dateTime(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  const timeZone = courseTimezone();
  return `${dayOf(date, timeZone)}, ${clockOf(date, timeZone, false)}`;
}

/**
 * "Sep 10, 1:16 PM EDT": a due or scheduled moment, the class's zone named
 * because the reader plans against it. The year appears only when it is
 * not this year. `day` gives the day alone, for a line too small for the
 * hour.
 */
export function dueTime(
  value: unknown,
  precision: "minute" | "day" = "minute",
): string {
  const date = toDate(value);
  if (!date) return "";
  const timeZone = courseTimezone();
  const day = dayOf(date, timeZone);
  return precision === "day" ? day : `${day}, ${clockOf(date, timeZone, true)}`;
}

/**
 * "Sep 5, 12:24 PM – 2:10 PM", or "Sep 5, 12:24 PM – Sep 6, 9:00 AM" when
 * the end falls on another day: a span of time as one fact, an en dash
 * between its ends. Without an end it is still running and reads
 * "since Sep 5, 12:24 PM".
 */
export function rangeTime(from: unknown, to: unknown): string {
  const start = toDate(from);
  if (!start) return "";
  const end = toDate(to);
  if (!end) return `since ${dateTime(start)}`;
  const timeZone = courseTimezone();
  const tail =
    dayOf(start, timeZone) === dayOf(end, timeZone)
      ? clockOf(end, timeZone, false)
      : dateTime(end);
  return `${dateTime(start)} – ${tail}`;
}

/** "Sep 4": the day alone, in the class's zone as the fuller times are. */
export function shortDate(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  return dayOf(date, courseTimezone());
}

/**
 * What a relay's runs come to in one line: "Ran 3 times, last on Sep 4",
 * counting the runs that closed and dating the last of them. Before the first
 * run closes there is nothing to say and the line is empty.
 */
export function ranSentence(runs: readonly { closedAt?: unknown }[]): string {
  const closed = runs
    .map((run) => toDate(run.closedAt))
    .filter((date): date is Date => date !== null);
  if (closed.length === 0) return "";
  const last = closed.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
  const times = closed.length === 1 ? "once" : `${closed.length} times`;
  return `Ran ${times}, last on ${shortDate(last)}`;
}

export function toZonedInput(
  value: unknown,
  timeZone = courseTimezone(),
): string {
  const date = toDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function fromZonedInput(
  value: string,
  timeZone = courseTimezone(),
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Invalid local date and time");
  const wall = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = wall;
  for (let pass = 0; pass < 2; pass++) {
    const represented = toZonedInput(new Date(instant), timeZone);
    const representedUtc = Date.parse(`${represented}:00Z`);
    instant -= representedUtc - wall;
  }
  return new Date(instant).toISOString();
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ACCENTS = [
  "oklch(0.62 0.15 32)",
  "oklch(0.58 0.1 150)",
  "oklch(0.55 0.11 250)",
  "oklch(0.6 0.13 330)",
  "oklch(0.62 0.12 95)",
  "oklch(0.55 0.09 200)",
  "oklch(0.58 0.14 12)",
  "oklch(0.5 0.09 285)",
];

export function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length];
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

export function titleFromContent(content: string): string {
  const line =
    content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  return (
    line
      .replace(/^#{1,6}\s+/, "")
      .replace(/[*_`>#]/g, "")
      .trim() || "(untitled)"
  );
}

export function excerpt(content: string, max = 180): string {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~]/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function bodyExcerpt(content: string, max = 180): string {
  const lines = content.split("\n");
  const titleLine = lines.findIndex((line) => line.trim().length > 0);
  if (titleLine === -1) return "";
  return excerpt(lines.slice(titleLine + 1).join("\n"), max);
}

export function count(n: number, noun: string, plural?: string): string {
  return `${n} ${n === 1 ? noun : (plural ?? `${noun}s`)}`;
}

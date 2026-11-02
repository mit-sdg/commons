import type { Output } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";
import { count } from "@/lib/format";
import {
  handedInAttempt,
  lateDayCap,
  lateness,
  studentDue,
} from "../../../src/computations/coursework.ts";

export {
  effectiveDue,
  handedInAttempt,
  overdue,
} from "../../../src/computations/coursework.ts";

type Row<T> = T extends readonly (infer Element)[] ? Element : never;
type Release = Row<Output<"/assignments/for-me">["assignments"]>;
type Attempt = Row<Output<"/submissions/for-student">["submissions"]>;
type Use = Row<Output<"/late-days/list">["uses"]>;

/** One assignment on the late days page or card. */
export interface LateDayRow {
  assignment: string;
  /** Null for an archived assignment, whose title students can't read. */
  title: string | null;
  /** The student's due date before late days; null for an archived assignment. */
  dueAt: number | null;
  /** When the latest submitted attempt was handed in. */
  handedInAt: string | null;
  lateMs: number;
  daysNeeded: number;
  /** Days on the standing use; 0 with no standing use. */
  days: number;
  standing: boolean;
  /** The most days this assignment can hold now. */
  cap: number;
}

export interface LateDayTerms {
  unitHours: number;
  perItemLimit: number;
  remaining: number;
}

/**
 * Every published assignment that accepts submissions, in due order, then a
 * row for each standing use on an assignment no longer listed.
 */
export function lateDayRows({
  releases,
  attempts,
  uses,
  terms,
}: {
  releases: readonly Release[];
  attempts: readonly Attempt[];
  uses: readonly Use[];
  terms: LateDayTerms;
}): LateDayRow[] {
  const standing = new Map(
    uses
      .filter((use) => use.status === "APPLIED")
      .map((use) => [String(use.item), use.days]),
  );
  const listed = releases
    .filter((release) => release.acceptsSubmissions)
    .map((release): LateDayRow => {
      const handedIn = handedInAttempt(
        attempts.filter(
          (attempt) =>
            String(attempt.assignment) === String(release.assignment),
        ),
      );
      const late = handedIn
        ? lateness({
            submittedAt: handedIn.submittedAt,
            dueAt: release.dueAt,
            dueOverride: release.dueOverride,
            unitHours: terms.unitHours,
          })
        : { lateMs: 0, daysNeeded: 0 };
      const days = standing.get(String(release.assignment)) ?? 0;
      return {
        assignment: String(release.assignment),
        title: release.title,
        dueAt: studentDue(release.dueAt, release.dueOverride),
        handedInAt: handedIn ? String(handedIn.submittedAt) : null,
        ...late,
        days,
        standing: standing.has(String(release.assignment)),
        cap: lateDayCap({
          perItemLimit: terms.perItemLimit,
          remaining: terms.remaining,
          applied: days,
        }),
      };
    })
    .sort((left, right) => (left.dueAt ?? 0) - (right.dueAt ?? 0));
  const shown = new Set(listed.map((row) => row.assignment));
  const archived = [...standing]
    .filter(([assignment]) => !shown.has(assignment))
    .map(
      ([assignment, days]): LateDayRow => ({
        assignment,
        title: null,
        dueAt: null,
        handedInAt: null,
        lateMs: 0,
        daysNeeded: 0,
        days,
        standing: true,
        cap: days,
      }),
    );
  return [...listed, ...archived];
}

/** The row for one assignment, or null when it has none. */
export function lateDayRowFor(
  assignment: string,
  input: Parameters<typeof lateDayRows>[0],
): LateDayRow | null {
  return (
    lateDayRows(input).find((row) => row.assignment === assignment) ?? null
  );
}

/** The terms the rows need, from the uses list and the balance. */
export function lateDayTerms(
  list: Pick<Output<"/late-days/list">, "unitHours" | "maxDaysPerItem">,
  balance: { remaining: number },
): LateDayTerms {
  return {
    unitHours: list.unitHours,
    perItemLimit: list.maxDaysPerItem,
    remaining: balance.remaining,
  };
}

/** "7 of 10 left". */
export function daysLeft(balance: {
  granted: number;
  remaining: number;
}): string {
  return `${balance.remaining} of ${balance.granted} left`;
}

/** "1 day 3 hours", "5 hours", "12 minutes": real time, not late days. */
export function lateBy(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return count(minutes, "minute");
  const hours = Math.round(minutes / 60);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return count(rest, "hour");
  return rest === 0
    ? count(days, "day")
    : `${count(days, "day")} ${count(rest, "hour")}`;
}

/** The call that sets an assignment's late days to `target`. */
export type LateDayMove =
  | { action: "apply"; days: number }
  | { action: "change"; days: number }
  | { action: "cancel" };

export function moveTo(row: LateDayRow, target: number): LateDayMove | null {
  if (target === row.days && row.standing === target > 0) return null;
  if (target <= 0) return row.standing ? { action: "cancel" } : null;
  return row.standing
    ? { action: "change", days: target }
    : { action: "apply", days: target };
}

/** Why a handed-in late assignment can't be covered, or null when it can. */
export function cannotCover(
  row: LateDayRow,
  terms: LateDayTerms,
): string | null {
  if (row.daysNeeded <= row.days) return null;
  if (row.daysNeeded > terms.perItemLimit)
    return `Needs ${count(row.daysNeeded, "late day")}, more than the ${terms.perItemLimit} one assignment can take.`;
  if (row.daysNeeded > row.cap)
    return `Needs ${count(row.daysNeeded, "late day")}. You have ${terms.remaining} left.`;
  return null;
}

/** Sends a move; resolves to an error message or null. */
export async function sendMove(
  assignment: string,
  move: LateDayMove,
): Promise<string | null> {
  const result =
    move.action === "apply"
      ? await api["late-days"].apply({ assignment, days: move.days })
      : move.action === "change"
        ? await api["late-days"].change({ assignment, days: move.days })
        : await api["late-days"].cancel({ assignment });
  return "error" in result ? publicErrorMessage(result.error) : null;
}

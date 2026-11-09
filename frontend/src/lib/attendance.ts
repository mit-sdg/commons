import type { Output } from "@/lib/api";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { fileSlug, toCsv } from "@/lib/csv";
import {
  type Lecture,
  lectureAttendance,
  lectureDate,
} from "../../../src/computations/lectures.ts";

export type { Lecture };
export type AttendanceRead = Output<"/live/lectures/attendance">;
export type PastRunsRead = Output<"/live/lectures/runs">;

export async function loadAttendance(): Promise<AttendanceRead> {
  return unwrap(await api.live["lectures/attendance"]({}));
}

export async function loadPastRuns(): Promise<PastRunsRead> {
  return unwrap(await api.live["lectures/runs"]({}));
}

/** One student's row in the grid. */
export interface AttendanceRow {
  user: string;
  name: string;
  email: string;
  section: string | null;
  /** The lecture dates the student was present at. */
  present: Set<string>;
  /** Present lectures out of all lectures, 0 to 100, rounded; null with no lectures. */
  percent: number | null;
}

export interface AttendanceGrid {
  timezone: string | null;
  lectures: Lecture[];
  rows: AttendanceRow[];
}

/** The grid: lectures in date order, students in name order. */
export function attendanceGrid(read: AttendanceRead): AttendanceGrid {
  const { lectures, attended } = lectureAttendance({
    runs: read.runs.map((run) => ({ ...run, openedAt: String(run.openedAt) })),
    students: read.students.map((student) => String(student.user)),
    timezone: read.timezone,
  });
  const rows = read.students
    .map((student): AttendanceRow => {
      const present = attended.get(String(student.user)) ?? new Set<string>();
      return {
        user: String(student.user),
        name: student.displayName || student.email,
        email: student.email,
        section: student.section === null ? null : String(student.section),
        present,
        percent:
          lectures.length === 0
            ? null
            : Math.round((present.size / lectures.length) * 100),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  return { timezone: read.timezone, lectures, rows };
}

/** "Oct 7" for a lecture date. Dates are already in the class time zone. */
export function lectureLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
}

/** One row per student: name, email, section, each lecture as 1 or 0, the count, and the percent. */
export function attendanceCsv(
  grid: AttendanceGrid,
  sectionNames: ReadonlyMap<string, string>,
  title: string,
): { filename: string; csv: string } {
  const header = [
    "Student name",
    "Email",
    "Section",
    ...grid.lectures.map((lecture) => lecture.date),
    "Lectures attended",
    "Lectures",
    "Percent",
  ];
  const rows = grid.rows.map((row) => [
    row.name,
    row.email,
    row.section === null ? "" : (sectionNames.get(row.section) ?? ""),
    ...grid.lectures.map((lecture) => (row.present.has(lecture.date) ? 1 : 0)),
    row.present.size,
    grid.lectures.length,
    row.percent ?? "",
  ]);
  return {
    filename: `${fileSlug(title, "class")}-attendance.csv`,
    csv: toCsv([header, ...rows]),
  };
}

/** One past run on the marking list. */
export interface PastRun {
  run: string;
  title: string;
  /** `quiz`, `survey`, or `relay`. */
  kind: string;
  open: boolean;
  openedAt: string;
  closedAt: string | null;
  /** The opening date in the class time zone, which names its lecture. */
  date: string;
  lecture: boolean;
}

/** Every quiz, survey, and relay run, newest first. */
export function pastRuns(
  read: PastRunsRead,
  timezone: string | null,
): PastRun[] {
  const runs = [
    ...read.questionnaires.flatMap((questionnaire) =>
      questionnaire.runs.map((run) => ({
        ...run,
        title: questionnaire.title,
        kind: questionnaire.kind,
      })),
    ),
    ...read.relays.flatMap((relay) =>
      relay.runs.map((run) => ({ ...run, title: relay.title, kind: "relay" })),
    ),
  ];
  return runs
    .map(
      (run): PastRun => ({
        run: String(run.run),
        title: run.title,
        kind: run.kind,
        open: run.open,
        openedAt: String(run.openedAt),
        closedAt: run.closedAt === null ? null : String(run.closedAt),
        date: lectureDate(String(run.openedAt), timezone),
        lecture: run.lecture,
      }),
    )
    .sort(
      (left, right) =>
        new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime(),
    );
}

/** Marks or unmarks a run as a lecture; resolves to an error message or null. */
export async function setLecture(
  run: string,
  lecture: boolean,
): Promise<string | null> {
  const result = lecture
    ? await api.live["lectures/mark"]({ run })
    : await api.live["lectures/unmark"]({ run });
  return "error" in result ? publicErrorMessage(result.error) : null;
}

/** The grid with only one section's students, or every student when `section` is null. */
export function gridForSection(
  grid: AttendanceGrid,
  section: string | null,
): AttendanceGrid {
  if (section === null) return grid;
  return { ...grid, rows: grid.rows.filter((row) => row.section === section) };
}

/** "1:16 PM": the clock time a run opened, in the class time zone, or UTC without one. */
export function openedTime(
  openedAt: string | Date,
  timezone: string | null,
): string {
  return new Date(openedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? "UTC",
  });
}

/** Past runs under their opening dates, keeping the order they came in. */
export function runsByDate(
  runs: readonly PastRun[],
): { date: string; runs: PastRun[] }[] {
  const groups: { date: string; runs: PastRun[] }[] = [];
  for (const run of runs) {
    const last = groups.at(-1);
    if (last?.date === run.date) last.runs.push(run);
    else groups.push({ date: run.date, runs: [run] });
  }
  return groups;
}

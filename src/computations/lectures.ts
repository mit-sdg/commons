/**
 * Lecture attendance: which runs make up one lecture, and who was there. A
 * lecture is a date in the class's time zone, and every run marked as a
 * lecture that opened that date belongs to it. The attendance grid, its CSV,
 * and course grades read lectures from here.
 */

/** The date a run opened, as `YYYY-MM-DD` in the time zone, or UTC without one. */
export function lectureDate(openedAt: string | Date, timezone: string | null): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(openedAt));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The class's time zone, or null before the class is configured. */
export function classTimezone({ detail }: { detail: { timezone: string } | null }): string | null {
  return detail?.timezone ?? null;
}

/** The subjects a run's participants respond to: the run itself and each of its rounds. */
export function lectureSubjects({ run, parts }: { run: string; parts: string[] }): string[] {
  return [run, ...parts];
}

/** The participants who joined without an account, leaving out the run's model seats. */
export function signedOutJoiners({
  participants,
  accounts,
  seats,
}: {
  participants: string[];
  accounts: string[];
  seats: string[];
}): string[] {
  const known = new Set([...accounts, ...seats]);
  return participants.filter((participant) => !known.has(participant));
}

/** A run's title: its questionnaire's, else its relay's. */
export function runTitle({
  quizTitle,
  relayTitle,
}: {
  quizTitle: string | null;
  relayTitle: string | null;
}): string {
  return quizTitle ?? relayTitle ?? "";
}

/** A run's kind: its questionnaire's form, `quiz` or `survey`, or `relay`. */
export function runKind({
  quizForm,
  relayTitle,
}: {
  quizForm: string | null;
  relayTitle: string | null;
}): string {
  if (quizForm !== null) return quizForm;
  return relayTitle !== null ? "relay" : "";
}

export interface LectureRun {
  run: string;
  openedAt: string | Date;
  title: string;
  kind: string;
  /** Joiners who hold an active seat, students or not. */
  joined: readonly string[];
  signedOut: readonly string[];
}

export interface Lecture {
  date: string;
  runs: LectureRun[];
  /** The students who joined at least one of the lecture's runs. */
  present: string[];
  /** How many joined without signing in, each counted once across the lecture's runs. */
  signedOut: number;
}

/**
 * The lectures in date order, and for each student the dates they were
 * present. Only the given students are counted.
 */
export function lectureAttendance({
  runs,
  students,
  timezone,
}: {
  runs: readonly LectureRun[];
  students: readonly string[];
  timezone: string | null;
}): { lectures: Lecture[]; attended: Map<string, Set<string>> } {
  const roster = new Set(students);
  const byDate = new Map<string, LectureRun[]>();
  for (const run of runs) {
    const date = lectureDate(run.openedAt, timezone);
    byDate.set(date, [...(byDate.get(date) ?? []), run]);
  }
  const attended = new Map(students.map((student) => [student, new Set<string>()]));
  const lectures = [...byDate.keys()].sort().map((date): Lecture => {
    const dayRuns = byDate
      .get(date)!
      .sort(
        (left, right) => new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime(),
      );
    const present = [
      ...new Set(dayRuns.flatMap((run) => run.joined.filter((user) => roster.has(user)))),
    ];
    for (const student of present) attended.get(student)!.add(date);
    return {
      date,
      runs: dayRuns,
      present,
      signedOut: new Set(dayRuns.flatMap((run) => run.signedOut)).size,
    };
  });
  return { lectures, attended };
}

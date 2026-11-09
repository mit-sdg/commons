import { describe, expect, test } from "bun:test";
import { lectureDate } from "../../../src/computations/lectures.ts";
import {
  type AttendanceRead,
  attendanceCsv,
  attendanceGrid,
  gridForSection,
  lectureLabel,
  openedTime,
  type PastRunsRead,
  pastRuns,
  runsByDate,
} from "./attendance.ts";

const NEW_YORK = "America/New_York";

type Run = AttendanceRead["runs"][number];
type Student = AttendanceRead["students"][number];

function student(
  user: string,
  displayName: string | null,
  section: string | null,
): Student {
  return {
    user,
    displayName,
    email: `${user}@example.edu`,
    section,
  } as unknown as Student;
}

function run(
  id: string,
  openedAt: string,
  joined: string[],
  signedOut: string[] = [],
): Run {
  return {
    run: id,
    openedAt,
    title: `Run ${id}`,
    kind: "quiz",
    joined,
    signedOut,
  } as unknown as Run;
}

function read(runs: Run[], timezone: string | null = NEW_YORK): AttendanceRead {
  return {
    timezone,
    students: [
      student("ben", null, "s2"),
      student("ada", "Ada Lovelace", "s1"),
    ],
    runs,
  } as unknown as AttendanceRead;
}

// Oct 7 and Oct 9 in New York, each a morning class.
const OCT_7_A = "2026-10-07T14:00:00.000Z";
const OCT_7_B = "2026-10-07T15:30:00.000Z";
const OCT_9 = "2026-10-09T14:00:00.000Z";

describe("lectureDate", () => {
  test("a run opened late in the evening in New York is past midnight in UTC", () => {
    const openedAt = "2026-10-08T02:30:00.000Z";
    expect(lectureDate(openedAt, NEW_YORK)).toBe("2026-10-07");
    expect(lectureDate(openedAt, null)).toBe("2026-10-08");
    expect(lectureDate(openedAt, "UTC")).toBe("2026-10-08");
  });
});

describe("attendanceGrid", () => {
  test("a student who joined two runs on one date counts once", () => {
    const grid = attendanceGrid(
      read([
        run("a", OCT_7_A, ["ada"]),
        run("b", OCT_7_B, ["ada"]),
        run("c", OCT_9, ["ben"]),
      ]),
    );
    expect(grid.lectures.map((lecture) => lecture.date)).toEqual([
      "2026-10-07",
      "2026-10-09",
    ]);
    expect(grid.lectures[0]?.runs.map((entry) => entry.run)).toEqual([
      "a",
      "b",
    ]);
    const ada = grid.rows.find((row) => row.user === "ada");
    expect([...(ada?.present ?? [])]).toEqual(["2026-10-07"]);
    expect(ada?.percent).toBe(50);
  });

  test("a signed-out joiner and a non-student joiner never become rows", () => {
    const grid = attendanceGrid(
      read([
        run("a", OCT_7_A, ["ada", "staff"], ["guest-1"]),
        run("b", OCT_7_B, [], ["guest-1", "guest-2"]),
      ]),
    );
    expect(grid.rows.map((row) => row.user)).toEqual(["ada", "ben"]);
    expect(grid.lectures[0]?.present).toEqual(["ada"]);
    expect(grid.lectures[0]?.signedOut).toBe(2);
  });

  test("students are named by display name, else email, in name order", () => {
    const grid = attendanceGrid(read([]));
    expect(grid.rows.map((row) => row.name)).toEqual([
      "Ada Lovelace",
      "ben@example.edu",
    ]);
  });

  test("percent with zero lectures is null", () => {
    const grid = attendanceGrid(read([]));
    expect(grid.lectures).toEqual([]);
    expect(grid.rows.map((row) => row.percent)).toEqual([null, null]);
  });
});

describe("attendanceCsv", () => {
  const grid = attendanceGrid(
    read([run("a", OCT_7_A, ["ada"]), run("c", OCT_9, ["ada", "ben"])]),
  );
  const sections = new Map([
    ["s1", "Section 1"],
    ["s2", "Section 2"],
  ]);

  test("writes one row per student with each lecture as 1 or 0", () => {
    const { filename, csv } = attendanceCsv(grid, sections, "6.1040");
    expect(filename).toBe("6-1040-attendance.csv");
    expect(csv).toBe(
      "Student name,Email,Section,2026-10-07,2026-10-09,Lectures attended,Lectures,Percent\r\n" +
        "Ada Lovelace,ada@example.edu,Section 1,1,1,2,2,100\r\n" +
        "ben@example.edu,ben@example.edu,Section 2,0,1,1,2,50\r\n",
    );
  });

  test("a section filter keeps that section's students and every lecture", () => {
    const { filename, csv } = attendanceCsv(
      gridForSection(grid, "s2"),
      sections,
      "6.1040 Section 2",
    );
    expect(filename).toBe("6-1040-section-2-attendance.csv");
    expect(csv).toBe(
      "Student name,Email,Section,2026-10-07,2026-10-09,Lectures attended,Lectures,Percent\r\n" +
        "ben@example.edu,ben@example.edu,Section 2,0,1,1,2,50\r\n",
    );
    expect(gridForSection(grid, null).rows).toHaveLength(2);
  });
});

describe("pastRuns", () => {
  const runs = {
    questionnaires: [
      {
        questionnaire: "q",
        title: "Check-in",
        kind: "quiz",
        runs: [
          {
            run: "q1",
            open: false,
            openedAt: OCT_7_A,
            closedAt: OCT_7_B,
            lecture: true,
          },
          {
            run: "q2",
            open: true,
            openedAt: OCT_9,
            closedAt: null,
            lecture: false,
          },
        ],
      },
      {
        questionnaire: "s",
        title: "Feedback",
        kind: "survey",
        runs: [
          {
            run: "s1",
            open: false,
            openedAt: "2026-10-01T14:00:00.000Z",
            closedAt: "2026-10-01T15:00:00.000Z",
            lecture: false,
          },
        ],
      },
    ],
    relays: [
      {
        relay: "r",
        title: "Design relay",
        runs: [
          {
            run: "r1",
            open: false,
            openedAt: "2026-10-08T02:30:00.000Z",
            closedAt: "2026-10-08T03:00:00.000Z",
            lecture: false,
          },
        ],
      },
    ],
  } as unknown as PastRunsRead;

  test("merges quizzes, surveys, and relays, newest first", () => {
    const merged = pastRuns(runs, NEW_YORK);
    expect(merged.map((entry) => [entry.run, entry.kind, entry.title])).toEqual(
      [
        ["q2", "quiz", "Check-in"],
        ["r1", "relay", "Design relay"],
        ["q1", "quiz", "Check-in"],
        ["s1", "survey", "Feedback"],
      ],
    );
    expect(merged[0]).toMatchObject({ open: true, closedAt: null });
    expect(merged[2]).toMatchObject({ lecture: true, closedAt: OCT_7_B });
  });

  test("dates each run in the class time zone and groups them by date", () => {
    const groups = runsByDate(pastRuns(runs, NEW_YORK));
    expect(
      groups.map((group) => [group.date, group.runs.map((r) => r.run)]),
    ).toEqual([
      ["2026-10-09", ["q2"]],
      ["2026-10-07", ["r1", "q1"]],
      ["2026-10-01", ["s1"]],
    ]);
    expect(pastRuns(runs, null).find((entry) => entry.run === "r1")?.date).toBe(
      "2026-10-08",
    );
  });
});

describe("labels", () => {
  test("lectureLabel names the month and day", () => {
    expect(lectureLabel("2026-10-07")).toBe("Oct 7");
    expect(lectureLabel("2026-01-31")).toBe("Jan 31");
  });

  test("openedTime reads the clock in the class time zone", () => {
    const openedAt = "2026-10-08T02:30:00.000Z";
    expect(openedTime(openedAt, NEW_YORK)).toMatch(/^10:30\sPM$/);
    expect(openedTime(openedAt, null)).toMatch(/^2:30\sAM$/);
  });
});

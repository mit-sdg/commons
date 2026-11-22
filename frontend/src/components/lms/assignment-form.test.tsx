import { describe, expect, test } from "bun:test";
import type { Output } from "@/lib/api";
import {
  ownWorkOnTeams,
  teamsWithWork,
  toStudentsNotice,
  toTeamsNotice,
} from "./assignment-form";

type Work = Output<"/submissions/for-assignment">;
type Grades = Output<"/grades/for-item">["grades"];

function assigned(
  assignee: string,
  section: string | null,
  submitter = assignee,
): Work["assigned"][number] {
  return {
    assignee,
    submitter,
    section,
    displayName: assignee,
    dueOverride: null,
    email: null,
    enrolment: "ACTIVE",
    release: `release-${assignee}`,
    status: "ASSIGNED",
    username: assignee,
  };
}

function attempt(
  submitter: string,
  status = "SUBMITTED",
): Work["submissions"][number] {
  return {
    submitter,
    status,
    submission: `submission-${submitter}-${status}`,
    artifacts: [`post-${submitter}`],
    number: 1,
    submittedAt: "2026-11-01T00:00:00Z",
    submitterName: null,
  } as Work["submissions"][number];
}

function grade(learner: string, status = "RELEASED"): Grades[number] {
  return { learner, status } as Grades[number];
}

function work(rows: Work["assigned"], submissions: Work["submissions"]): Work {
  return { assigned: rows, submissions, unmoved: [] } as Work;
}

describe("ownWorkOnTeams", () => {
  const rows = [
    assigned("sam", "tidepool"),
    assigned("maya", "tidepool"),
    assigned("ben", "harbor"),
    assigned("ana", null),
    assigned("lee", "harbor"),
  ];

  test("counts students on teams with a submitted attempt of their own", () => {
    const counts = ownWorkOnTeams(
      work(rows, [
        attempt("sam"),
        attempt("maya"),
        attempt("ben"),
        attempt("ana"),
        attempt("lee", "WITHDRAWN"),
      ]),
      [grade("sam"), grade("ben", "DRAFT"), grade("maya", "EXCUSED")],
    );
    expect(counts).toEqual({ students: 3, teams: 2, graded: 2 });
  });

  test("leaves graded unknown when grades could not be read", () => {
    expect(ownWorkOnTeams(work(rows, [attempt("sam")]), null)).toEqual({
      students: 1,
      teams: 1,
      graded: null,
    });
  });
});

describe("teamsWithWork", () => {
  test("counts teams with a submitted attempt, not students submitting alone", () => {
    const rows = [
      assigned("sam", "tidepool", "tidepool"),
      assigned("maya", "tidepool", "tidepool"),
      assigned("ben", "harbor", "harbor"),
      assigned("ana", null),
    ];
    expect(
      teamsWithWork(
        work(rows, [
          attempt("tidepool"),
          attempt("tidepool"),
          attempt("harbor", "WITHDRAWN"),
          attempt("ana"),
        ]),
      ),
    ).toBe(1);
  });
});

describe("toTeamsNotice", () => {
  test("gives the counts", () => {
    expect(toTeamsNotice({ students: 12, teams: 9, graded: 5 })).toBe(
      "12 students on 9 teams have already submitted on their own, and 5 of those submissions are graded. Students stop seeing their own submission until it is moved to their team.",
    );
  });

  test("reads right for one student", () => {
    expect(toTeamsNotice({ students: 1, teams: 1, graded: 1 })).toBe(
      "1 student on 1 team has already submitted on their own, and that submission is graded. The student stops seeing their own submission until it is moved to their team.",
    );
    expect(toTeamsNotice({ students: 1, teams: 1, graded: 0 })).toBe(
      "1 student on 1 team has already submitted on their own. The student stops seeing their own submission until it is moved to their team.",
    );
  });

  test("reads right for one graded submission among several", () => {
    expect(toTeamsNotice({ students: 3, teams: 1, graded: 1 })).toBe(
      "3 students on 1 team have already submitted on their own, and 1 of those submissions is graded. Students stop seeing their own submission until it is moved to their team.",
    );
  });

  test("leaves out grades it could not read", () => {
    expect(toTeamsNotice({ students: 2, teams: 2, graded: null })).toBe(
      "2 students on 2 teams have already submitted on their own. Students stop seeing their own submission until it is moved to their team.",
    );
  });

  test("hides nothing when no student on a team submitted", () => {
    expect(toTeamsNotice({ students: 0, teams: 0, graded: 0 })).toBeNull();
  });

  test("gives no numbers when the work could not be read", () => {
    expect(toTeamsNotice(null)).toBe(
      "Students on teams who already submitted on their own stop seeing that submission until it is moved to their team.",
    );
  });
});

describe("toStudentsNotice", () => {
  test("gives the count", () => {
    expect(toStudentsNotice(9)).toBe(
      "9 teams have submitted. Students stop seeing their team's submissions.",
    );
    expect(toStudentsNotice(1)).toBe(
      "1 team has submitted. Students stop seeing their team's submissions.",
    );
  });

  test("hides nothing when no team submitted", () => {
    expect(toStudentsNotice(0)).toBeNull();
  });

  test("gives no numbers when the work could not be read", () => {
    expect(toStudentsNotice(null)).toBe(
      "Students on teams stop seeing their team's submissions.",
    );
  });
});

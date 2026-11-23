import { describe, expect, test } from "bun:test";
import type { AssignedLearner, ItemAssessment } from "./submissions-export.ts";
import {
  draftsThatDiffer,
  earlierSubmissions,
  releaseReach,
  submitterRows,
} from "./submitter-rows.ts";

const student = (
  name: string,
  submitter: string,
  rest: Partial<AssignedLearner> = {},
) =>
  ({
    assignee: name,
    submitter,
    displayName: name,
    username: name,
    email: `${name}@example.edu`,
    enrolment: "ACTIVE",
    section: submitter === name ? null : submitter,
    dueOverride: null,
    release: `release-${name}`,
    status: "ASSIGNED",
    ...rest,
  }) as AssignedLearner;

const draft = (learner: string, attempt: number, score: number) =>
  ({
    grade: `${learner}-${attempt}`,
    learner,
    evidence: `${learner}-attempt-${attempt}`,
    attempt,
    status: "DRAFT",
    method: "POINTS",
    scored: true,
    score,
    outOf: 10,
    judgments: [],
  }) as unknown as ItemAssessment;

const names = new Map([
  ["t1", "Tidepool"],
  ["t2", "Lantern"],
]);

describe("the rows of an assignment's staff page", () => {
  test("a team is one row named for the team, and a student on no team keeps their own", () => {
    const rows = submitterRows(
      [
        student("leo", "leo"),
        student("sam", "t1"),
        student("ben", "t2", { dueOverride: "2026-11-27T04:59:00.000Z" }),
        student("maya", "t1", { enrolment: "DROPPED" }),
        student("priya", "t2", { dueOverride: "2026-11-25T04:59:00.000Z" }),
      ],
      names,
      true,
    );
    expect(
      rows.map((row) => [row.assignee, row.displayName, row.team, row.noTeam]),
    ).toEqual([
      ["t2", "Lantern", true, false],
      ["t1", "Tidepool", true, false],
      ["leo", "leo", false, true],
    ]);
    expect(rows[0].members.map((member) => member.assignee)).toEqual([
      "ben",
      "priya",
    ]);
    expect(rows[0].dueOverride).toBe("2026-11-27T04:59:00.000Z");
    expect(rows[1].through).toBe("sam");
    expect(rows[1].enrolment).toBe("ACTIVE");
  });

  test("an assignment each student submits keeps one row per student, in the order given", () => {
    const rows = submitterRows(
      [student("sam", "sam"), student("ada", "ada")],
      names,
      false,
    );
    expect(
      rows.map((row) => [row.assignee, row.team, row.noTeam, row.through]),
    ).toEqual([
      ["sam", false, false, "sam"],
      ["ada", false, false, "ada"],
    ]);
  });

  test("a dropped member is not the one a request names while a teammate is enrolled", () => {
    const [row] = submitterRows(
      [student("maya", "t1", { enrolment: "DROPPED" }), student("sam", "t1")],
      names,
      true,
    );
    expect(row.through).toBe("sam");
  });
});

test("earlier submissions are counted with the teams that wait on them", () => {
  const counted = earlierSubmissions([
    { student: "sam", section: "t1", submission: "a" },
    { student: "maya", section: "t1", submission: "b" },
    { student: "ben", section: "t2", submission: "c" },
  ] as never);
  expect([counted.submissions, counted.teams]).toEqual([3, 2]);
  expect(counted.ofTeam.get("t1")).toBe(2);
});

describe("drafts on one team", () => {
  test("two drafts with different scores are returned, oldest attempt first", () => {
    const grades = [draft("t2", 2, 6), draft("t2", 1, 9), draft("t1", 1, 8)];
    expect(draftsThatDiffer(grades, "t2").map((grade) => grade.score)).toEqual([
      9, 6,
    ]);
    expect(draftsThatDiffer(grades, "t1")).toEqual([]);
  });

  test("two drafts that agree are not flagged", () => {
    expect(
      draftsThatDiffer([draft("t2", 1, 9), draft("t2", 2, 9)], "t2"),
    ).toEqual([]);
  });
});

test("releasing every draft counts the drafts, their teams, and the enrolled members", () => {
  const rows = submitterRows(
    [
      student("sam", "t1"),
      student("maya", "t1", { enrolment: "DROPPED" }),
      student("ben", "t2"),
      student("priya", "t2"),
      student("leo", "leo"),
    ],
    names,
    true,
  );
  expect(
    releaseReach(rows, [
      draft("t1", 1, 8),
      draft("t2", 1, 9),
      draft("t2", 2, 6),
      draft("leo", 1, 7),
      draft("someone-else", 1, 7),
    ]),
  ).toEqual({ drafts: 4, teams: 2, students: 4, differing: ["Lantern"] });
});

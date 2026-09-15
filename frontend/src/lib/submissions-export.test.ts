import { describe, expect, test } from "bun:test";
import type { SubmissionsExportSource } from "./submissions-export.ts";
import {
  SUBMISSIONS_CSV_COLUMNS,
  submissionsCsv,
} from "./submissions-export.ts";

const source = {
  assignment: "assignment-1",
  title: "Lab, one",
  dueAt: "2026-09-10T12:00:00Z",
  assigned: [
    {
      assignee: "learner-1",
      displayName: '=IMPORTXML("bad")',
      username: "priya",
      email: "priya@example.edu",
      section: "section-1",
      release: "release-1",
      dueOverride: null,
      status: "ASSIGNED",
    },
    {
      assignee: "learner-2",
      displayName: "Noah Patel",
      username: "noah",
      email: "noah@example.edu",
      section: null,
      release: "release-2",
      dueOverride: "2026-09-12T12:00:00Z",
      status: "ASSIGNED",
    },
    {
      assignee: "learner-3",
      displayName: "Amina Okafor",
      username: "amina",
      email: "amina@example.edu",
      section: null,
      release: "release-3",
      dueOverride: null,
      status: "ASSIGNED",
    },
  ],
  submissions: [
    {
      submitter: "learner-1",
      submitterName: "Priya",
      submission: "withdrawn-attempt",
      artifacts: [],
      submittedAt: "2026-09-09T11:00:00Z",
      number: 2,
      status: "WITHDRAWN",
    },
    {
      submitter: "learner-1",
      submitterName: "Priya",
      submission: "active-attempt",
      artifacts: [],
      submittedAt: "2026-09-11T13:00:00Z",
      number: 1,
      status: "SUBMITTED",
    },
    {
      submitter: "learner-2",
      submitterName: "Noah",
      submission: "withdrawn-only",
      artifacts: [],
      submittedAt: "2026-09-11T10:00:00Z",
      number: 1,
      status: "WITHDRAWN",
    },
  ],
  grades: [],
  delegations: [
    {
      learner: "learner-1",
      grader: "grader-old",
      graderName: "Former TA",
      graderUsername: "former",
    },
  ],
  graders: [],
  sectionNames: new Map([["section-1", "Studio, A"]]),
  lateDays: new Map([["learner-1", 1]]),
  lateDayUnitHours: 24,
  origin: "https://commons.example",
} as unknown as SubmissionsExportSource;

describe("submission export", () => {
  test("keeps one row per learner with submitted, withdrawn, and missing states", () => {
    const { filename, csv } = submissionsCsv(source);
    expect(filename).toBe("lab-one-submissions.csv");
    expect(csv.split("\r\n")).toHaveLength(5);
    expect(csv).toContain("Submitted,active-attempt,1");
    expect(csv).toContain("Withdrawn,withdrawn-only,1");
    expect(csv).toContain("Missing,,,,");
    expect(csv).not.toContain("withdrawn-attempt");
    expect(csv).not.toContain("?tab=submissions");
  });

  test("exports identity, due, delegation, and direct review details safely", () => {
    const { csv } = submissionsCsv(source);
    expect(csv).toStartWith(`${SUBMISSIONS_CSV_COLUMNS.join(",")}\r\n`);
    expect(csv).toContain("'=IMPORTXML");
    expect(csv).toContain('"Studio, A"');
    expect(csv).toContain("2026-09-11T12:00:00.000Z");
    expect(csv).toContain("Late,Former TA,former,grader-old,Unavailable");
    expect(csv).toContain(
      "https://commons.example/staff/assignments/assignment-1#attempt-active-attempt",
    );
  });

  test("does not claim late-day data when that staff capability is unavailable", () => {
    const { csv } = submissionsCsv({
      ...source,
      assigned: source.assigned.slice(0, 1),
      lateDays: null,
      lateDayUnitHours: null,
    });
    expect(csv).toContain(",,,Submitted,active-attempt,1,");
    expect(csv).toContain(",Unavailable,Former TA,");
  });

  test("does not attach an old assessment to a fresh ungraded resubmission", () => {
    const { csv } = submissionsCsv({
      ...source,
      assigned: source.assigned.slice(0, 1),
      submissions: [
        {
          ...source.submissions[0],
          submission: "old-attempt",
          number: 1,
          status: "SUBMITTED",
        },
        {
          ...source.submissions[0],
          submission: "fresh-attempt",
          number: 2,
          status: "SUBMITTED",
          submittedAt: "2026-09-12T13:00:00Z",
        },
      ],
      grades: [
        {
          grade: "old-grade",
          learner: "learner-1",
          evidence: "old-attempt",
          status: "RELEASED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
      ] as unknown as SubmissionsExportSource["grades"],
    });
    expect(csv).toContain("Submitted,fresh-attempt,2");
    expect(csv).not.toContain("old-grade");
    expect(csv).not.toContain("RELEASED");
  });

  test("labels assignment-level excusals separately from attempt assessments", () => {
    const { csv } = submissionsCsv({
      ...source,
      assigned: source.assigned.slice(2),
      grades: [
        {
          grade: "excusal-grade",
          learner: "learner-3",
          evidence: "",
          status: "EXCUSED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
      ] as unknown as SubmissionsExportSource["grades"],
    });
    expect(csv).toContain("Assignment excusal,EXCUSED,excusal-grade");
  });
});

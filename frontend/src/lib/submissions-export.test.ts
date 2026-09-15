import { describe, expect, test } from "bun:test";
import type { SubmissionsExportSource } from "./submissions-export.ts";
import {
  SUBMISSIONS_CSV_COLUMNS,
  selectExportAssessment,
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
  grading: { method: "COMPETENCY", revision: 0, maxPoints: 0 },
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
  test("selects a unified assessment by evidence before interpreting its saved method", () => {
    const assessments = [
      {
        grade: "point-assessment",
        learner: "learner-1",
        item: "assignment-1",
        evidence: "attempt-1",
        grader: "grader-1",
        method: "POINTS",
        setupRevision: 1,
        criteria: [
          {
            kind: "POINTS",
            criterion: "overall-10",
            name: "Overall",
            maxPoints: 10,
            position: 0,
          },
        ],
        judgments: [{ kind: "POINTS", criterion: "overall-10", score: 8 }],
        feedback: "Corrected after review.",
        score: 8,
        outOf: 10,
        scored: true,
        status: "RELEASED",
        version: 4,
        createdAt: "2026-09-11T00:00:00Z",
        updatedAt: "2026-09-11T01:00:00Z",
        releasedAt: "2026-09-11T01:00:00Z",
        history: [
          {
            revision: 1,
            grader: "grader-1",
            status: "RELEASED",
            judgments: [{ kind: "POINTS", criterion: "overall-10", score: 7 }],
            feedback: "First release.",
            releasedAt: "2026-09-11T00:30:00Z",
            score: 7,
            outOf: 10,
            scored: true,
          },
          {
            revision: 2,
            grader: "grader-1",
            status: "RELEASED",
            judgments: [{ kind: "POINTS", criterion: "overall-10", score: 8 }],
            feedback: "Corrected after review.",
            releasedAt: "2026-09-11T01:00:00Z",
            score: 8,
            outOf: 10,
            scored: true,
          },
        ],
      },
      {
        grade: "competency-assessment",
        learner: "learner-1",
        item: "assignment-1",
        evidence: "attempt-2",
        grader: "grader-2",
        method: "COMPETENCY",
        setupRevision: 2,
        criteria: [
          {
            kind: "COMPETENCY",
            criterion: "reasoning-edition",
            basis: "reasoning-edition",
            standard: "reasoning-standard",
            number: 1,
            name: "Reasoning",
            description: "Explain the design reasoning.",
            deficient: "Reasoning is absent.",
            emergent: "Reasoning is partial.",
            competent: "Reasoning supports the design.",
            expert: "Reasoning weighs alternatives.",
            referenceUrl: "https://commons.example/standards/reasoning",
            position: 0,
          },
        ],
        judgments: [
          {
            kind: "COMPETENCY",
            criterion: "reasoning-edition",
            rating: "COMPETENT",
            feedback: "",
          },
        ],
        feedback: "Draft assessment.",
        score: 0,
        outOf: 0,
        scored: false,
        status: "DRAFT",
        version: 1,
        createdAt: "2026-09-12T00:00:00Z",
        updatedAt: "2026-09-12T01:00:00Z",
        releasedAt: null,
        history: [],
      },
      {
        grade: "assignment-excusal",
        learner: "learner-1",
        item: "assignment-1",
        evidence: "",
        grader: "grader-3",
        method: "POINTS",
        setupRevision: 3,
        criteria: [
          {
            kind: "POINTS",
            criterion: "overall-100",
            name: "Overall",
            maxPoints: 100,
            position: 0,
          },
        ],
        judgments: [],
        feedback: "Excused from this assignment.",
        score: 0,
        outOf: 100,
        scored: false,
        status: "EXCUSED",
        version: 2,
        createdAt: "2026-09-13T00:00:00Z",
        updatedAt: "2026-09-13T01:00:00Z",
        releasedAt: "2026-09-13T01:00:00Z",
        history: [
          {
            revision: 1,
            grader: "grader-3",
            status: "EXCUSED",
            judgments: [],
            feedback: "Excused from this assignment.",
            releasedAt: "2026-09-13T01:00:00Z",
            score: 0,
            outOf: 100,
            scored: false,
          },
        ],
      },
    ];

    expect(
      selectExportAssessment(assessments, {
        submission: "attempt-1",
        number: 1,
      }),
    ).toMatchObject({
      scope: "Attempt 1",
      record: {
        grade: "point-assessment",
        method: "POINTS",
        score: 8,
        outOf: 10,
        history: [
          { revision: 1, score: 7, outOf: 10 },
          { revision: 2, score: 8, outOf: 10 },
        ],
      },
    });
    expect(
      selectExportAssessment(assessments, {
        submission: "attempt-2",
        number: 2,
      }),
    ).toMatchObject({
      scope: "Attempt 2",
      record: {
        grade: "competency-assessment",
        method: "COMPETENCY",
      },
    });
    expect(
      selectExportAssessment(assessments, {
        submission: "attempt-3",
        number: 3,
      }),
    ).toMatchObject({
      scope: "Assignment excusal",
      record: {
        grade: "assignment-excusal",
        status: "EXCUSED",
        judgments: [],
        score: 0,
        outOf: 100,
        scored: false,
      },
    });
  });

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
    expect(csv).toContain('learner-1,section-1,"Studio, A"');
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

  test("does not treat an older attempt excusal as an assignment excusal", () => {
    const { csv } = submissionsCsv({
      ...source,
      assigned: source.assigned.slice(0, 1),
      submissions: [
        {
          ...source.submissions[0],
          submission: "excused-attempt",
          number: 1,
          status: "SUBMITTED",
        },
        {
          ...source.submissions[0],
          submission: "later-attempt",
          number: 2,
          status: "SUBMITTED",
          submittedAt: "2026-09-12T13:00:00Z",
        },
      ],
      grades: [
        {
          grade: "attempt-excusal",
          learner: "learner-1",
          evidence: "excused-attempt",
          status: "EXCUSED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
      ] as unknown as SubmissionsExportSource["grades"],
    });
    expect(csv).toContain("Submitted,later-attempt,2");
    expect(csv).not.toContain("attempt-excusal");
    expect(csv).not.toContain("Assignment excusal");
    expect(csv).not.toContain("EXCUSED");
  });

  test("keeps an assessed point denominator after the current setup changes", () => {
    const { csv } = submissionsCsv({
      ...source,
      assigned: source.assigned.slice(0, 1),
      submissions: [
        {
          ...source.submissions[1],
          submitter: "learner-1",
          submission: "ten-point-attempt",
        },
      ],
      grading: { method: "POINTS", revision: 4, maxPoints: 20 },
      grades: [
        {
          grade: "ten-point-grade",
          learner: "learner-1",
          evidence: "ten-point-attempt",
          method: "POINTS",
          score: 8,
          scored: true,
          outOf: 10,
          status: "RELEASED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
      ] as unknown as SubmissionsExportSource["grades"],
    });
    expect(csv).toContain("Attempt 1,RELEASED,ten-point-grade");
    expect(csv).toContain(",8,10,https://commons.example/");
    expect(csv).not.toContain(",8,20,https://commons.example/");
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

  test("exports zero, resubmission, and retained-evidence point-grade states", () => {
    const numericSource = {
      ...source,
      title: "Numeric lab",
      grading: { method: "COMPETENCY", revision: 3, maxPoints: 0 },
      sectionNames: new Map(),
      assigned: [
        {
          ...source.assigned[0],
          displayName: "Priya Sharma",
        },
        ...source.assigned.slice(1),
        {
          assignee: "learner-4",
          displayName: "Iris Kim",
          username: "iris",
          email: "iris@example.edu",
          section: "section-unreadable",
          release: "release-4",
          dueOverride: null,
          status: "ASSIGNED",
        },
      ],
      submissions: [
        {
          ...source.submissions[1],
          submitter: "learner-1",
          submission: "released-attempt",
          number: 1,
        },
        {
          ...source.submissions[1],
          submitter: "learner-2",
          submission: "zero-attempt",
          number: 1,
        },
        {
          ...source.submissions[1],
          submitter: "learner-3",
          submission: "old-scored-attempt",
          number: 1,
        },
        {
          ...source.submissions[1],
          submitter: "learner-3",
          submission: "fresh-ungraded-attempt",
          number: 2,
          submittedAt: "2026-09-12T14:00:00Z",
        },
        {
          ...source.submissions[1],
          submitter: "learner-4",
          submission: "excusal-evidence-attempt",
          number: 1,
        },
        {
          ...source.submissions[1],
          submitter: "learner-4",
          submission: "after-excusal-attempt",
          number: 2,
          submittedAt: "2026-09-12T15:00:00Z",
        },
      ],
      grades: [
        {
          grade: "released-grade",
          learner: "learner-1",
          evidence: "released-attempt",
          method: "POINTS",
          score: 8.5,
          scored: true,
          outOf: 10,
          status: "RELEASED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
        {
          grade: "zero-draft-grade",
          learner: "learner-2",
          evidence: "zero-attempt",
          method: "POINTS",
          score: 0,
          scored: true,
          outOf: 10,
          status: "DRAFT",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
        {
          grade: "old-released-grade",
          learner: "learner-3",
          evidence: "old-scored-attempt",
          method: "POINTS",
          score: 7,
          scored: true,
          outOf: 10,
          status: "RELEASED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
        {
          grade: "assignment-excusal-grade",
          learner: "learner-4",
          evidence: "",
          method: "POINTS",
          score: 0,
          scored: false,
          outOf: 10,
          status: "EXCUSED",
          createdAt: "2026-09-11T00:00:00Z",
          updatedAt: "2026-09-11T01:00:00Z",
        },
      ],
    } as unknown as SubmissionsExportSource;

    const { csv } = submissionsCsv(numericSource);
    const [header, ...lines] = csv.trimEnd().split("\r\n");
    const columns = header?.split(",") ?? [];
    const row = (username: string) => {
      const values = lines
        .find((line) => line.split(",")[1] === username)
        ?.split(",");
      expect(values).toBeDefined();
      return Object.fromEntries(
        columns.map((column, index) => [column, values?.[index] ?? ""]),
      );
    };

    expect(row("priya")).toMatchObject({
      "Grading method": "Points",
      "Grade scope": "Attempt 1",
      "Grade status": "RELEASED",
      "Grade ID": "released-grade",
      Score: "8.5",
      "Maximum points": "10",
    });
    expect(row("noah")).toMatchObject({
      "Grade status": "DRAFT",
      "Grade ID": "zero-draft-grade",
      Score: "0",
      "Maximum points": "10",
    });
    expect(row("amina")).toMatchObject({
      "Submission ID": "fresh-ungraded-attempt",
      "Grade scope": "",
      "Grade status": "",
      "Grade ID": "",
      Score: "",
      "Maximum points": "",
    });
    expect(row("iris")).toMatchObject({
      "Section ID": "section-unreadable",
      "Section name": "",
      "Submission ID": "after-excusal-attempt",
      "Grade scope": "Assignment excusal",
      "Grade status": "EXCUSED",
      "Grade ID": "assignment-excusal-grade",
      Score: "",
      "Maximum points": "10",
    });
    expect(csv).not.toContain("old-released-grade");
  });
});

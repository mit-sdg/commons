import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type Assessment,
  AssessmentCard,
  AssessmentHistory,
  RubricDescription,
} from "./assessment-history";

const rubric = {
  kind: "COMPETENCY" as const,
  criterion: "criterion",
  basis: "edition",
  standard: "skill",
  name: "Reasoning",
  number: 1,
  position: 0,
  description: "Explain claims",
  deficient: "Absent",
  emergent: "Partial",
  competent: "Connected",
  expert: "Thorough",
  referenceUrl: "",
};

const assessment: Assessment = {
  grade: "first",
  learner: "learner",
  item: "assignment",
  evidence: "work1",
  grader: "staff",
  method: "COMPETENCY",
  setupRevision: 1,
  label: "Essay",
  attempt: 1,
  criteria: [rubric],
  judgments: [
    {
      kind: "COMPETENCY",
      criterion: "criterion",
      rating: "COMPETENT",
      feedback: "Good connection",
    },
  ],
  feedback: "Overall feedback",
  status: "RELEASED",
  version: 5,
  score: 0,
  outOf: 0,
  scored: false,
  createdAt: "2026-01-01T00:00:00Z",
  submittedAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-03-01T00:00:00Z",
  releasedAt: "2026-03-01T00:00:00Z",
  history: [
    {
      revision: 1,
      grader: "staff",
      judgments: [
        {
          kind: "COMPETENCY",
          criterion: "criterion",
          rating: "EMERGENT",
          feedback: "Earlier interpretation",
        },
      ],
      feedback: "Corrected later",
      status: "RELEASED",
      releasedAt: "2026-02-01T00:00:00Z",
      score: 0,
      outOf: 0,
      scored: false,
    },
    {
      revision: 2,
      grader: "staff",
      judgments: [
        {
          kind: "COMPETENCY",
          criterion: "criterion",
          rating: "COMPETENT",
          feedback: "Good connection",
        },
      ],
      feedback: "Overall feedback",
      status: "RELEASED",
      releasedAt: "2026-03-01T00:00:00Z",
      score: 0,
      outOf: 0,
      scored: false,
    },
  ],
};

const pointAssessment: Assessment = {
  ...assessment,
  grade: "points",
  method: "POINTS",
  setupRevision: 2,
  criteria: [
    {
      kind: "POINTS",
      criterion: "analysis",
      name: "Analysis",
      maxPoints: 6,
      position: 0,
    },
    {
      kind: "POINTS",
      criterion: "clarity",
      name: "Clarity",
      maxPoints: 4,
      position: 1,
    },
  ],
  judgments: [
    { kind: "POINTS", criterion: "analysis", score: 5 },
    { kind: "POINTS", criterion: "clarity", score: 3 },
  ],
  score: 8,
  outOf: 10,
  scored: true,
  history: [
    {
      revision: 1,
      grader: "staff",
      status: "RELEASED",
      judgments: [
        { kind: "POINTS", criterion: "analysis", score: 4 },
        { kind: "POINTS", criterion: "clarity", score: 3 },
      ],
      feedback: "First release",
      releasedAt: "2026-02-01T00:00:00Z",
      score: 7,
      outOf: 10,
      scored: true,
    },
    {
      revision: 2,
      grader: "staff",
      status: "RELEASED",
      judgments: [
        { kind: "POINTS", criterion: "analysis", score: 5 },
        { kind: "POINTS", criterion: "clarity", score: 3 },
      ],
      feedback: "Corrected release",
      releasedAt: "2026-03-01T00:00:00Z",
      score: 8,
      outOf: 10,
      scored: true,
    },
  ],
};

describe("assessment presentation", () => {
  test("orders attempts by evidence date despite a later correction release", () => {
    const later = {
      ...assessment,
      grade: "second",
      evidence: "work2",
      attempt: 2,
      submittedAt: "2026-01-02T00:00:00Z",
      releasedAt: "2026-01-03T00:00:00Z",
      history: [],
    };
    const html = renderToStaticMarkup(
      <AssessmentHistory assessments={[later, assessment]} />,
    );
    expect(html.indexOf('id="assessment-first"')).toBeLessThan(
      html.indexOf('id="assessment-second"'),
    );
    expect(html.match(/id="assessment-/g)?.length).toBe(2);
    expect(html).toContain("Correction history");
    expect(html).toContain("not additional assessed work");
    expect(html).toContain("#attempt-work1");
    expect(html).toContain("#attempt-work2");
  });

  test("renders a frozen multi-criterion 8/10 and its correction history", () => {
    const html = renderToStaticMarkup(
      <AssessmentHistory assessments={[pointAssessment]} />,
    );
    expect(html).toContain("8");
    expect(html).toContain("/ 10");
    expect(html).toContain("Analysis");
    expect(html).toContain("Clarity");
    expect(html).toContain("7 / 10");
    expect(html).toContain("Earlier release");
    expect(html).not.toContain("By skill");
  });

  test("explains skill filtering in mixed assessment history", () => {
    const html = renderToStaticMarkup(
      <AssessmentHistory assessments={[assessment, pointAssessment]} />,
    );
    expect(html).toContain("By skill");
    expect(html).toContain("Point assessments remain under By assignment.");
  });

  test("distinguishes assignment and attempt excusals", () => {
    const assignmentExcusal = renderToStaticMarkup(
      <AssessmentCard
        assessment={{
          ...assessment,
          evidence: "",
          attempt: null,
          status: "EXCUSED",
          judgments: [],
          history: [],
        }}
      />,
    );
    const attemptExcusal = renderToStaticMarkup(
      <AssessmentCard
        assessment={{
          ...assessment,
          status: "EXCUSED",
          judgments: [],
          history: [],
        }}
      />,
    );
    expect(assignmentExcusal).toContain("Assignment excused");
    expect(attemptExcusal).toContain("Attempt 1 excused");
    expect(attemptExcusal).toContain("No competency judgment was recorded");
  });

  test("distinguishes explicit not assessed from deficient", () => {
    const html = renderToStaticMarkup(
      <AssessmentCard
        assessment={{
          ...assessment,
          history: [],
          judgments: [
            {
              kind: "COMPETENCY",
              criterion: "criterion",
              rating: "NOT_ASSESSED",
              feedback: "",
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Not assessed");
    expect(html).not.toContain("Awaiting assessment");
  });

  test("renders descriptions as text and omits unsafe reference links", () => {
    const html = renderToStaticMarkup(
      <RubricDescription
        rubric={{
          ...rubric,
          description: '<script>alert("x")</script>',
          referenceUrl: "javascript:alert(1)",
        }}
      />,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });
});

test("release preview includes every retained release visible after correction", () => {
  const preview = renderToStaticMarkup(
    <AssessmentCard assessment={assessment} preview />,
  );
  const released = renderToStaticMarkup(
    <AssessmentCard assessment={assessment} />,
  );
  expect(preview.match(/Earlier release/g)?.length).toBe(2);
  expect(released.match(/Earlier release/g)?.length).toBe(1);
});

test("empty descriptions and feedback leave only levels", () => {
  const minimal = {
    ...rubric,
    description: "",
    deficient: "",
    emergent: "",
    competent: "",
    expert: "",
  };
  const html = renderToStaticMarkup(
    <AssessmentCard
      assessment={{
        ...assessment,
        criteria: [minimal],
        judgments: [
          {
            kind: "COMPETENCY",
            criterion: "criterion",
            rating: "COMPETENT",
            feedback: " ",
          },
        ],
        feedback: "",
        history: [],
      }}
    />,
  );
  expect(html).toContain("Competent");
  expect(html.match(/<details/g)?.length).toBe(1);
  expect(renderToStaticMarkup(<RubricDescription rubric={minimal} />)).toBe("");
});

test("overall and individual feedback can coexist in closed disclosures", () => {
  const html = renderToStaticMarkup(
    <AssessmentCard assessment={{ ...assessment, history: [] }} />,
  );
  expect(html).toContain("Good connection");
  expect(html).toContain("Overall feedback");
  expect(html).not.toContain('open=""');
});

test("assessment details retain their fixed rubric reference and edition", () => {
  const html = renderToStaticMarkup(
    <AssessmentCard
      assessment={{
        ...assessment,
        criteria: [
          {
            ...rubric,
            number: 2,
            description: "",
            deficient: "",
            emergent: "",
            competent: "",
            expert: "",
            referenceUrl: "https://example.edu/rubrics/edition-2",
          },
        ],
        feedback: "",
        judgments: [
          {
            kind: "COMPETENCY",
            criterion: "criterion",
            rating: "COMPETENT",
            feedback: "",
          },
        ],
        history: [],
      }}
    />,
  );
  expect(html).toContain('href="https://example.edu/rubrics/edition-2"');
  expect(html).toContain("edition 2");
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html.match(/<details/g)?.length).toBe(1);
});

test("skill grouping names the assignment without repeating the section skill", () => {
  const html = renderToStaticMarkup(
    <AssessmentCard
      assessment={{ ...assessment, history: [] }}
      skill="skill"
    />,
  );
  expect(html).toContain("Essay");
  expect(html).toContain("Competent");
  expect(html).not.toContain("Reasoning");
  expect(html).not.toContain("Feedback available");
});

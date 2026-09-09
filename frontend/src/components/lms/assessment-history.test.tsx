import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type Assessment,
  AssessmentCard,
  AssessmentHistory,
  RubricDescription,
} from "./assessment-history";

const rubric = {
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
  label: "Essay",
  attempt: 1,
  criteria: [rubric],
  judgments: [
    {
      criterion: "criterion",
      rating: "COMPETENT",
      feedback: "Good connection",
    },
  ],
  feedback: "Overall feedback",
  status: "RELEASED",
  version: 5,
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
          criterion: "criterion",
          rating: "EMERGENT",
          feedback: "Earlier interpretation",
        },
      ],
      feedback: "Corrected later",
      status: "RELEASED",
      releasedAt: "2026-02-01T00:00:00Z",
    },
    {
      revision: 2,
      grader: "staff",
      judgments: [
        {
          criterion: "criterion",
          rating: "COMPETENT",
          feedback: "Good connection",
        },
      ],
      feedback: "Overall feedback",
      status: "RELEASED",
      releasedAt: "2026-03-01T00:00:00Z",
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
  test("distinguishes excusal and explicit not assessed from deficient", () => {
    const excused = renderToStaticMarkup(
      <AssessmentCard
        assessment={{ ...assessment, status: "EXCUSED", history: [] }}
      />,
    );
    expect(excused).toContain("No competency judgment was made");
    expect(excused).not.toContain("Good connection");
    const unassessed = renderToStaticMarkup(
      <AssessmentCard
        assessment={{
          ...assessment,
          history: [],
          judgments: [
            { criterion: "criterion", rating: "NOT_ASSESSED", feedback: "" },
          ],
        }}
      />,
    );
    expect(unassessed).toContain("This skill was not assessed on this work");
    expect(unassessed).not.toContain("Awaiting assessment");
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

test("release preview shows every retained release that the learner will see after correction", () => {
  const preview = renderToStaticMarkup(
    <AssessmentCard assessment={assessment} preview />,
  );
  const released = renderToStaticMarkup(
    <AssessmentCard assessment={assessment} />,
  );
  expect(preview.match(/Earlier release/g)?.length).toBe(2);
  expect(released.match(/Earlier release/g)?.length).toBe(1);
});

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type Mark, MarkCard } from "./mark-history";

const mark: Mark = {
  mark: "mark-1",
  learner: "learner",
  item: "assignment",
  evidence: "submission-2",
  score: 7.5,
  scored: true,
  outOf: 10,
  status: "RELEASED",
  feedback: "Good work",
  attempt: 2,
  releasedAt: "2026-09-15T00:00:00Z",
  updatedAt: "2026-09-15T00:00:00Z",
  version: 2,
  label: "Quiz",
};

describe("point grade presentation", () => {
  test("shows score, status metadata, and the supporting learner attempt", () => {
    const html = renderToStaticMarkup(<MarkCard mark={mark} />);
    expect(html).toContain("7.5");
    expect(html).toContain("/ 10");
    expect(html).toContain(
      'href="/assignments/assignment#attempt-submission-2"',
    );
    expect(html).toContain("Attempt 2");
  });

  test("uses the staff evidence route for staff readers", () => {
    const html = renderToStaticMarkup(<MarkCard mark={mark} staff />);
    expect(html).toContain(
      'href="/staff/assignments/assignment#attempt-submission-2"',
    );
  });

  test("never presents an unscored draft or excusal as a zero grade", () => {
    const draft = renderToStaticMarkup(
      <MarkCard
        mark={{ ...mark, score: 0, scored: false, status: "DRAFT" }}
        staff
      />,
    );
    expect(draft).toContain("Ungraded");
    expect(draft).not.toContain("0<!-- --> <span");

    const excused = renderToStaticMarkup(
      <MarkCard
        mark={{ ...mark, score: 0, scored: false, status: "EXCUSED" }}
      />,
    );
    expect(excused).toContain("Excused");
    expect(excused).not.toContain("7.5");
  });
});

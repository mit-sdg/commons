import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { validateIssueDirectory, validateIssueText } from "../../scripts/check-issues.ts";

const concepts = new Set(["Grading"]);
const valid = `---
milestone: public-deployment
concepts:
  - Grading
---

# Correct a grade

## Current behavior

A released grade cannot be revised.

## Unresolved decision

Choose how a released grade returns to draft.

## Acceptance condition

A test checks the chosen correction path.
`;

describe("Commons issue records", () => {
  test("accept the repository's issue files", async () => {
    expect(await validateIssueDirectory(join(import.meta.dirname, "../.."))).toEqual([]);
  });

  test("accept a valid issue file", () => {
    expect(validateIssueText("grade.md", valid, concepts, "open")).toEqual([]);
  });

  test("reject unsupported metadata and missing sections", () => {
    const broken = valid
      .replace("milestone: public-deployment", "owner: someone\nmilestone: public-deployment")
      .replace("## Acceptance condition", "## Verification at completion");
    expect(validateIssueText("grade.md", broken, concepts, "open")).toEqual([
      "grade.md:2: unsupported frontmatter field owner",
      "grade.md: missing Acceptance condition section",
      "grade.md: Verification at completion section does not belong in open",
    ]);
  });

  test("reject state metadata because the issue directory owns state", () => {
    const broken = valid.replace("---\n", "---\nstate: open\n");
    expect(validateIssueText("grade.md", broken, concepts, "open")).toEqual([
      "grade.md:2: unsupported frontmatter field state",
    ]);
  });

  test("reject unknown concepts and the wrong open section", () => {
    const broken = valid
      .replace("  - Grading", "  - Scoring")
      .replace(
        "## Acceptance condition",
        "## Desired behavior\n\nDo both.\n\n## Acceptance condition",
      );
    expect(validateIssueText("grade.md", broken, concepts, "open")).toEqual([
      "grade.md: unknown concept Scoring",
      "grade.md: Desired behavior section does not belong in open",
    ]);
  });

  test("accept lifecycle-specific decided and done sections", () => {
    const decided = valid.replace("Unresolved decision", "Desired behavior");
    const done = valid
      .replace("Current behavior", "Resolution at completion")
      .replace("Unresolved decision", "Decision at completion")
      .replace("Acceptance condition", "Verification at completion");
    expect(validateIssueText("grade.md", decided, concepts, "decided")).toEqual([]);
    expect(validateIssueText("grade.md", done, concepts, "done")).toEqual([]);
  });
});

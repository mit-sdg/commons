import { expect, test } from "@playwright/test";
import {
  assignmentNotificationMailHtml,
  forumNotificationMailHtml,
  invitationMailHtml,
  taskListMailHtml,
  taskMailHtml,
} from "../../src/computations/mail-content.ts";
import { passwordResetMailHtml } from "../../src/computations/password-reset.ts";

const discussion = {
  kind: "mention",
  title: "Planning next week's review",
  author: "Ada Lovelace (@ada)",
  url: "https://commons.example.edu/t/discussion#post-reply",
  content:
    'Could we move the review to **Friday**?\nI have added the outline below.\n\n## Before we meet\n\n- Read the revised brief\n- Bring one question\n  - Include a worked example\n\n> We should leave time for discussion.\n\n[Read the assignment](/assignments/problem-set-3).\n\n```ts\nconst reference = "' +
    "long_identifier_".repeat(16) +
    '";\n```\n\n![Review sketch](https://images.example.edu/sketch.png)\n\n| Part | Due |\n| --- | --- |\n| Outline | Thursday |\n| Review | Friday |',
};
const samples = [
  ["discussion", forumNotificationMailHtml(discussion), "Open discussion"],
  [
    "assignment",
    assignmentNotificationMailHtml({
      kind: "assignment_released",
      title: "Problem Set 3: Models and invariants",
      author: "Dana Prof (@dana)",
      due: "Fri, Sep 18, 2026, 11:59 PM EDT",
      url: "https://commons.example.edu/assignments/problem-set-3",
    }),
    "Open assignment",
  ],
  [
    "task",
    taskMailHtml({
      kind: "task-retimed",
      taskTitle: "Draft the brief for the course launch",
      listTitle: "Course launch",
      deadline: "Fri, Sep 18, 2026, 5:00 PM EDT",
      actor: "",
      details:
        "Two pages and a **short summary**.\n\n- [x] Collect the notes\n- [ ] Draft a recommendation\n- [ ] Send it to the group",
      list: "course-launch",
      task: "brief",
    }),
    "Open task",
  ],
  [
    "membership",
    taskListMailHtml({
      kind: "task-list-added",
      listTitle: "Reading group",
      actor: "Mara Chen (@mara)",
      list: "reading",
      member: true,
    }),
    "Open group",
  ],
  [
    "removal",
    taskListMailHtml({
      kind: "task-list-removed",
      listTitle: "Reading group",
      actor: "Mara Chen (@mara)",
      list: "reading",
      member: false,
    }),
    "Open groups",
  ],
  [
    "invitation",
    invitationMailHtml({
      invitation: "sample-invitation",
      credential: "EXAMPLE-PASSWORD",
      body: "Hello,\n\nYou have a seat in Software Design. Commons is where the class reads, asks, and hands work in.\n\nSign in before the first lecture so we know your account works.",
    }),
    "Register your account",
  ],
  [
    "password-reset",
    passwordResetMailHtml({
      voucher: "sample-voucher",
      credential: "EXAMPLE-CODE",
      username: "ada",
    }),
    "Reset your password",
  ],
] as const;

for (const [name, html, action] of samples) {
  test(`${name} email is readable on mobile and desktop without remote assets`, async ({
    page,
  }, testInfo) => {
    const requests: string[] = [];
    await page.route("**/*", (route) => route.abort());
    page.on("request", (request) => requests.push(request.url()));
    for (const width of [320, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(html);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("a").last()).toHaveText(action);
      await expect(page.locator("img, script, link[rel=stylesheet], input, iframe")).toHaveCount(0);
      expect(
        await page
          .locator("html")
          .evaluate((element, width) => element.scrollWidth <= width + 1, width),
      ).toBe(true);
      expect(
        await page
          .locator("a")
          .evaluateAll((links) =>
            links.every((link) =>
              ["http:", "https:", "mailto:"].includes(new URL(link.href).protocol),
            ),
          ),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
    expect(requests).toEqual([]);
  });
}

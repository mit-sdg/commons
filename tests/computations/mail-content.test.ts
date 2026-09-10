import { describe, expect, test } from "vite-plus/test";
import {
  invitationMailHtml,
  invitationMailText,
  mailPreviewText,
  notificationDiscussionTitle,
  notificationMailSubject,
  notificationMailText,
  notificationMailHtml,
  forumNotificationUrl,
} from "../../src/computations/mail-content.ts";

describe("email presentation", () => {
  test("invitation copy is text, and the required registration footer cannot be omitted", () => {
    const input = {
      invitation: 'id"&',
      credential: "<secret>",
      body: 'Welcome <img src=x onerror="alert(1)">\nSecond line\n\nA new paragraph.',
    };
    const html = invitationMailHtml(input);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<br>Second line</p><p>A new paragraph.</p>");
    expect(html).toContain("&lt;secret&gt;");
    expect(html).toContain("invitation=id%22%26");
    expect(invitationMailText(input)).toContain("Temporary password: <secret>");
  });

  test.each([
    ["reply", "New reply to your post"],
    ["followed_reply", "New reply in a discussion you follow"],
    ["mention", "You were mentioned in a discussion"],
    ["accepted", "Your answer was accepted"],
    ["addressed", "A discussion was started with you"],
    ["staff_message", "New private discussion for staff"],
    ["assignment_released", "A new assignment is available"],
    ["future_kind", "New Commons notification"],
    ["constructor", "New Commons notification"],
    ["__proto__", "New Commons notification"],
    ["toString", "New Commons notification"],
  ])("%s names what happened without machine-kind wording", (kind, phrase) => {
    const input = { kind, title: "<Planning> & review", url: "https://example.edu/t/123#post-456" };
    expect(notificationMailSubject(input)).toBe(`${phrase}: ${input.title}`);
    expect(notificationMailText(input)).toContain(`${phrase}.`);
    expect(notificationMailHtml(input)).toContain("&lt;Planning&gt; &amp; review");
    expect(notificationMailHtml(input)).not.toContain("<Planning>");
    expect(notificationMailText(input)).toContain(input.url);
  });

  test("discussion titles come only from the first line and are bounded; URLs encode opaque IDs", () => {
    expect(notificationDiscussionTitle({ content: "\n# Homework planning\n\nSECRET BODY" })).toBe(
      "Homework planning",
    );
    expect(notificationDiscussionTitle({ content: null })).toBe("Discussion");
    expect(notificationDiscussionTitle({ content: "x".repeat(400) })).toHaveLength(160);
    expect(notificationMailSubject({ kind: "mention", title: "A\r\nB" })).toBe(
      "You were mentioned in a discussion: A B",
    );
    expect(forumNotificationUrl({ conversation: "a/b", post: "c#d" })).toContain(
      "/t/a%2Fb#post-c%23d",
    );
  });

  test("outbox previews hide credentials and link tokens without losing useful copy", () => {
    const text =
      "Welcome\n\nRegister: https://example.edu/register?invitation=invite-token\nTemporary password: secret-one\n\nReset: https://example.edu/reset-password?voucher=reset-token\nReset code: secret-two\n\nKeep this.";
    const preview = mailPreviewText({ text });
    for (const secret of ["invite-token", "reset-token", "secret-one", "secret-two"])
      expect(preview).not.toContain(secret);
    expect(preview).toContain("Welcome");
    expect(preview).toContain("Keep this.");
    expect(mailPreviewText({ text: "Task: Review\nGroup: Planning" })).toBe(
      "Task: Review\nGroup: Planning",
    );
  });
});

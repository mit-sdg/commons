import { describe, expect, test } from "vite-plus/test";
import {
  invitationMailHtml,
  invitationMailText,
  mailPreviewText,
  notificationDiscussionTitle,
  notificationMailSubject,
  notificationAuthorLabel,
  forumNotificationMailText,
  forumNotificationMailHtml,
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

  test("forum author labels use a nonblank display name and fall back to the username", () => {
    expect(notificationAuthorLabel({ username: "ada", displayName: "  Ada Lovelace  " })).toBe(
      "Ada Lovelace (@ada)",
    );
    expect(notificationAuthorLabel({ username: "ada", displayName: " \n\t " })).toBe("@ada");
    expect(notificationAuthorLabel({ username: "ada", displayName: null })).toBe("@ada");
  });

  test("forum messages preserve complete text and safely render HTML paragraphs and line breaks", () => {
    const unabridgedParagraph = `${"Detailed message content remains present. ".repeat(40)}FINAL-CONTENT-MARKER`;
    const input = {
      kind: "mention",
      title: '<Planning> & "review"',
      author: 'Ada <img src=x onerror="alert(1)"> (@ada)',
      content: `First <script>alert("x")</script>\nSecond & line\n\n${unabridgedParagraph}`,
      url: 'https://example.edu/t/thread?x="bad"&y=1#post-reply',
    };
    const text = forumNotificationMailText(input);
    expect(text).toContain("You were mentioned in a discussion.");
    expect(text).toContain(`Discussion: ${input.title}`);
    expect(text).toContain(`From: ${input.author}\n\n${input.content}`);
    expect(text.endsWith(input.url)).toBe(true);

    const html = forumNotificationMailHtml(input);
    expect(html).toContain("You were mentioned in a discussion.");
    expect(html).toContain("&lt;Planning&gt; &amp; &quot;review&quot;");
    expect(html).toContain("Ada &lt;img src=x onerror=&quot;alert(1)&quot;&gt; (@ada)");
    expect(html).toContain(
      "<p>First &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>Second &amp; line</p>",
    );
    expect(html).toContain(`<p>${unabridgedParagraph}</p>`);
    expect(html).toContain(
      'href="https://example.edu/t/thread?x=&quot;bad&quot;&amp;y=1#post-reply"',
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html.endsWith("</a></p>")).toBe(true);
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

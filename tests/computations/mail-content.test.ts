import { describe, expect, test } from "vite-plus/test";
import {
  invitationMailHtml,
  invitationMailText,
  mailPreviewText,
  notificationDiscussionTitle,
  notificationMailSubject,
  notificationAuthorLabel,
  forumNotificationMailBody,
  forumNotificationMailText,
  forumNotificationMailHtml,
  dueWallTime,
  notificationActorLabel,
  assignmentNotificationMailText,
  assignmentNotificationMailHtml,
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
    expect(html).toMatch(/<br>Second line<\/p><p[^>]*>A new paragraph\.<\/p>/);
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
  });

  test("a release names its author and due wall time, escapes both, and omits instructions", () => {
    const input = {
      kind: "assignment_released",
      title: "<Planning> & review",
      url: 'https://example.edu/assignments/a1?x="1"',
      author: "Dana <img src=x> (@dana)",
      due: dueWallTime({
        dueAt: new Date("2026-09-19T03:59:00.000Z"),
        detail: { timezone: "America/New_York" },
      }),
    };
    expect(input.due).toBe("Fri, Sep 18, 2026, 11:59 PM EDT");
    const text = assignmentNotificationMailText(input);
    expect(text).toContain("A new assignment is available.");
    expect(text).toContain("Assignment: <Planning> & review");
    expect(text).toContain("From: Dana <img src=x> (@dana)");
    expect(text).toContain("Due: Fri, Sep 18, 2026, 11:59 PM EDT");
    expect(text.endsWith(input.url)).toBe(true);

    const html = assignmentNotificationMailHtml(input);
    expect(html).toContain("&lt;Planning&gt; &amp; review");
    expect(html).toContain("Dana &lt;img src=x&gt; (@dana)");
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://example.edu/assignments/a1?x=&quot;1&quot;"');
    expect(html).toContain("Open assignment</a>");
    expect(html.indexOf("Open assignment</a>")).toBeGreaterThan(html.indexOf("Due:"));
  });

  test("a due label falls back to UTC without a usable course zone, and says nothing undated", () => {
    const dueAt = new Date("2026-09-19T03:59:00.000Z");
    const utc = "Sat, Sep 19, 2026, 3:59 AM UTC";
    expect(dueWallTime({ dueAt, detail: undefined })).toBe(utc);
    expect(dueWallTime({ dueAt, detail: { timezone: "" } })).toBe(utc);
    expect(dueWallTime({ dueAt, detail: { timezone: "Mars/Olympus" } })).toBe(utc);
    expect(dueWallTime({ dueAt: dueAt.toISOString(), detail: null })).toBe(utc);
    expect(dueWallTime({ dueAt: null, detail: undefined })).toBe("");
    expect(dueWallTime({ dueAt: "not a date", detail: undefined })).toBe("");
    expect(
      assignmentNotificationMailText({
        kind: "assignment_released",
        title: "T",
        url: "u",
        author: "@a",
        due: "",
      }),
    ).not.toContain("Due:");
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
    expect(html).toMatch(
      /<p[^>]*>First &lt;script&gt;alert\("x"\)&lt;\/script&gt;<br\s*\/?>Second &amp; line<\/p>/,
    );
    expect(html).toContain(`${unabridgedParagraph}</p>`);
    expect(html).toContain(
      'href="https://example.edu/t/thread?x=&quot;bad&quot;&amp;y=1#post-reply"',
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html.indexOf("Open discussion</a>")).toBeGreaterThan(
      html.indexOf("FINAL-CONTENT-MARKER"),
    );
  });

  test("an opening's title line is not repeated in its own mail, and a reply keeps every line", () => {
    const opening = "# Homework question\n\nComplete question\n\nSecond paragraph";
    expect(forumNotificationMailBody({ content: opening, post: "p1", opening: "p1" })).toBe(
      "Complete question\n\nSecond paragraph",
    );
    expect(forumNotificationMailBody({ content: opening, post: "p2", opening: "p1" })).toBe(
      opening,
    );
    expect(forumNotificationMailBody({ content: opening, post: "p1", opening: undefined })).toBe(
      opening,
    );
    expect(forumNotificationMailBody({ content: "# Title only", post: "p1", opening: "p1" })).toBe(
      "",
    );
  });

  test("an opening with nothing under its title mails no blank message block", () => {
    const input = {
      kind: "mention",
      title: "Title only",
      author: "@ada",
      content: "",
      url: "https://example.edu/t/1#post-2",
    };
    expect(forumNotificationMailText(input)).toBe(
      "You were mentioned in a discussion.\n\nDiscussion: Title only\nFrom: @ada\n\nOpen discussion:\nhttps://example.edu/t/1#post-2",
    );
    expect(forumNotificationMailHtml(input)).not.toContain("<p></p>");
  });

  test("an actor label names a recorded actor and names nothing when none was recorded", () => {
    expect(notificationActorLabel({ username: "mara", displayName: "Mara Vex" })).toBe(
      "Mara Vex (@mara)",
    );
    expect(notificationActorLabel({ username: "mara", displayName: null })).toBe("@mara");
    expect(notificationActorLabel({ username: undefined, displayName: "Mara Vex" })).toBe("");
    expect(notificationActorLabel({ username: "", displayName: null })).toBe("");
  });

  test("a message past the bound is cut at a word and says the rest is in Commons", () => {
    const word = "alpha ";
    const huge = word.repeat(4_000) + "OMEGA-TAIL-MARKER";
    expect(huge.length).toBeGreaterThan(20_000);
    const body = forumNotificationMailBody({ content: huge, post: "p", opening: undefined });
    expect(body.length).toBeLessThan(huge.length);
    expect(body).not.toContain("OMEGA-TAIL-MARKER");
    expect(body).toContain("(Shortened for email. Open it in Commons to read the rest.)");
    // Cut at a word, never mid-word.
    expect(body).toMatch(/alpha\u2026\n\n\(Shortened/);

    const whole = "alpha beta gamma";
    expect(forumNotificationMailBody({ content: whole, post: "p", opening: undefined })).toBe(
      whole,
    );
  });

  test("a bounded message still renders as whole HTML paragraphs", () => {
    const huge = "sentence ".repeat(4_000);
    const html = forumNotificationMailHtml({
      kind: "mention",
      title: "T",
      url: "u",
      author: "@a",
      content: forumNotificationMailBody({ content: huge, post: "p", opening: undefined }),
    });
    expect(html).toMatch(
      /<p[^>]*>\(Shortened for email\. Open it in Commons to read the rest\.\)<\/p>/,
    );
    expect(html.length).toBeLessThan(60_000);
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

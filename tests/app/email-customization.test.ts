import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";
import { passwordResetMailText } from "../../src/computations/password-reset.ts";

async function setup() {
  const db = await testDb();
  const edge = createEdge(mongoImplementations(db));
  const app = edge.application;
  const admin = await app.concepts.Authenticating.register({
    username: "admin",
    password: "password123",
    email: "admin@example.edu",
  });
  await app.whenIdle();
  const member = await app.concepts.Authenticating.register({
    username: "member",
    password: "password123",
    email: "member@example.edu",
  });
  await app.whenIdle();
  const adminSession = await app.concepts.Sessioning.start({ user: admin.user, at: new Date() });
  const memberSession = await app.concepts.Sessioning.start({ user: member.user, at: new Date() });
  async function call(
    path: string,
    input: Record<string, unknown> = {},
    session = adminSession.session,
  ) {
    return edge.gateway.invoke(path, { session, ...input });
  }
  return { db, edge, app, admin, member, adminSession, memberSession, call };
}

afterAll(stopTestDb);

describe("administrator email customization", () => {
  test("defaults, saved copy, sample preview, persistence, reset, and resend", async () => {
    const { db, app, call } = await setup();
    const defaults = {
      subject: "Your Commons invitation",
      body: "You have been invited to Commons.",
    };
    expect(await call("/mail/template")).toMatchObject({
      ok: true,
      value: { template: defaults, worded: false },
    });
    const copy = {
      subject: "Welcome to 6.1040",
      body: "Hello class,\nBring your questions.\n\n<strong>Plain text, not HTML.</strong>",
    };
    const preview = await call("/mail/preview-template", copy);
    expect(preview).toMatchObject({
      ok: true,
      value: {
        preview: {
          subject: copy.subject,
          text: expect.stringContaining(copy.body),
          html: expect.stringContaining("&lt;strong&gt;"),
        },
      },
    });
    expect(JSON.stringify(preview)).toContain("EXAMPLE-PASSWORD");
    expect(await app.concepts.Mailing._getPending({})).toEqual([]);
    expect(await call("/mail/template")).toMatchObject({ ok: true, value: { template: defaults } });

    expect(await call("/mail/save-template", copy)).toMatchObject({
      ok: true,
      value: { template: copy, worded: true },
    });
    expect(await call("/mail/template")).toMatchObject({
      ok: true,
      value: { template: copy, worded: true },
    });
    const restarted = createEdge(mongoImplementations(db));
    expect(
      await restarted.application.concepts.Wording._wordingIn({ place: "invitation" }),
    ).toEqual([{ heading: copy.subject, passage: copy.body }]);
    const issued = await app.concepts.Inviting.invite({
      channel: "email",
      address: "new@example.edu",
      at: new Date(),
    });
    await app.whenIdle();
    const [mail] = await app.concepts.Mailing._getPending({});
    expect(mail.subject).toBe(copy.subject);
    expect(mail.text).toContain(copy.body);
    expect(mail.text).toContain(`/register?invitation=${issued.invitation}`);
    expect(mail.text).toContain(`Temporary password: ${issued.credential}`);
    expect(mail.html).toContain("&lt;strong&gt;Plain text, not HTML.&lt;/strong&gt;");
    expect(mail.html).not.toContain("<strong>Plain text");

    const inspected = await call("/mail/read", { message: mail.message });
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        subject: copy.subject,
        recipient: "new@example.edu",
        text: expect.stringContaining("Temporary password: [hidden]"),
      },
    });
    expect(JSON.stringify(inspected)).not.toContain(issued.credential);
    expect(JSON.stringify(inspected)).not.toContain(issued.invitation);
    expect(JSON.stringify(await call("/mail/list"))).not.toContain(issued.invitation);
    expect(JSON.stringify(inspected)).not.toContain('"html"');

    expect(await call("/mail/reset-template")).toMatchObject({
      ok: true,
      value: { template: defaults, worded: false },
    });
    // Already queued mail is a snapshot, not rewritten by editing/resetting copy.
    expect((await app.concepts.Mailing._getPending({}))[0].subject).toBe(copy.subject);
    await app.concepts.Inviting.invite({
      channel: "email",
      address: "new@example.edu",
      at: new Date(),
    });
    await app.whenIdle();
    const [resent] = await app.concepts.Mailing._getPending({});
    expect(resent.message).toBe(mail.message);
    expect(resent.subject).toBe(defaults.subject);
    expect(resent.text).toContain(issued.credential);
  });

  test("every template/detail endpoint refuses non-admins and invalid copy never overwrites", async () => {
    const { call, memberSession, edge } = await setup();
    const copy = { subject: "Saved", body: "Keep this" };
    await call("/mail/save-template", copy);
    for (const [path, input] of [
      ["/mail/template", {}],
      ["/mail/save-template", copy],
      ["/mail/reset-template", {}],
      ["/mail/preview-template", copy],
      ["/mail/read", { message: "missing" }],
    ] as const) {
      expect(await call(path, input, memberSession.session)).toMatchObject({
        ok: false,
        error: { kind: "domain", value: "FORBIDDEN" },
      });
      const response = await edge.fetch(
        new Request(`http://edge/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
      expect(response.status).toBe(401);
    }
    for (const invalid of [
      { subject: "Subject\r\nBcc: x@y.edu", body: "Body" },
      { subject: " ", body: "Body" },
      { subject: "Subject", body: " \n " },
      { subject: "s".repeat(201), body: "Body" },
      { subject: "Subject", body: "b".repeat(20_001) },
    ]) {
      expect(await call("/mail/save-template", invalid)).toMatchObject({
        ok: false,
        error: { kind: "domain", value: "INVALID_WORDING" },
      });
      expect(await call("/mail/template")).toMatchObject({ ok: true, value: { template: copy } });
    }
    // A preview renders rather than deciding: it never refuses, saves, or queues.
    const rendered = await call("/mail/preview-template", {
      subject: "Subject\r\nBcc: x@y.edu",
      body: "b".repeat(20_050),
    });
    expect(rendered).toMatchObject({
      ok: true,
      value: {
        preview: {
          subject: "Subject  Bcc: x@y.edu",
          text: expect.stringContaining("b".repeat(20_000)),
        },
      },
    });
    expect(JSON.stringify(rendered)).not.toContain("b".repeat(20_001));
    // A blank draft previews the words Commons falls back to.
    expect(await call("/mail/preview-template", { subject: "   ", body: "  " })).toMatchObject({
      ok: true,
      value: {
        preview: {
          subject: "Your Commons invitation",
          text: expect.stringContaining("You have been invited to Commons."),
        },
      },
    });
    // A non-text subject is refused at the edge, before any wording is read.
    for (const path of ["/mail/save-template", "/mail/preview-template"]) {
      const response = await edge.fetch(
        new Request(`http://edge/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: { $ne: null }, body: 7 }),
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
    }
    expect(await call("/mail/template")).toMatchObject({ ok: true, value: { template: copy } });
    expect(await call("/mail/read", { message: "missing" })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "NOT_FOUND" },
    });
  });

  test("outbox previews redact password-reset secrets and still work after delivery", async () => {
    const { app, call } = await setup();
    const { message } = await app.concepts.Mailing.enqueue({
      key: "reset-voucher",
      recipient: "member@example.edu",
      subject: "Reset your Commons password",
      text: passwordResetMailText({
        voucher: "secret-voucher",
        credential: "secret-code",
        username: "member",
      }),
      html: "<script>never expose raw HTML</script>",
      at: new Date(),
    });
    const [{ generation }] = await app.concepts.Mailing._getPending({});
    await app.concepts.Mailing.markSent({ message, generation, at: new Date() });
    const inspected = await call("/mail/read", { message });
    expect(inspected).toMatchObject({
      ok: true,
      value: { text: expect.stringContaining("Reset code: [hidden]") },
    });
    for (const secret of ["secret-voucher", "secret-code", "<script>"])
      expect(JSON.stringify(inspected)).not.toContain(secret);
    const listing = await call("/mail/list");
    expect(JSON.stringify(listing)).not.toContain('"text"');
    expect(JSON.stringify(listing)).not.toContain('"html"');
    expect(JSON.stringify(listing)).not.toContain('"key"');
    expect(JSON.stringify(listing)).not.toContain("reset-voucher");
  });

  test("forum emails snapshot the public author, complete post, title, and direct link", async () => {
    const { app, admin, member, memberSession, call } = await setup();
    const at = new Date();
    await app.concepts.Profiling.createProfile({
      user: admin.user,
      displayName: "Ada <Admin>",
    });
    const root = await app.concepts.Posting.create({
      author: admin.user,
      content: "# Study & planning\n\nROOT SECRET BODY",
      at,
    });
    const thread = await app.concepts.Conversing.start({ item: root.post, at });
    await app.concepts.Accessing.establish({
      resource: thread.conversation,
      holders: [`account:${admin.user}`, `account:${member.user}`],
    });
    const unabridgedParagraph = `${"Detailed notification content remains readable. ".repeat(40)}FINAL-NOTIFICATION-CONTENT-MARKER`;
    const replyContent = `Complete <script>alert("mail")</script> reply\nSecond & line\n\n${unabridgedParagraph}`;
    const reply = await app.concepts.Posting.create({
      author: admin.user,
      content: replyContent,
      at,
    });
    await app.concepts.Conversing.reply({ item: reply.post, parent: thread.node, at });
    const notified = await app.concepts.Notifying.notify({
      recipient: member.user,
      kind: "mention",
      subject: reply.post,
      link: reply.post,
      actor: null,
      at,
    });
    await app.whenIdle();
    const queuedMail = () =>
      app.concepts.Mailing._getPending({}).then((messages) =>
        messages.find((message) => message.key.includes(notified.notification)),
      );
    const mail = await queuedMail();
    const directLink = `/t/${thread.conversation}#post-${reply.post}`;
    expect(mail?.subject).toBe("You were mentioned in a discussion: Study & planning");
    expect(mail?.text).toContain("You were mentioned in a discussion.");
    expect(mail?.text).toContain("Discussion: Study & planning");
    expect(mail?.text).toContain("From: Ada <Admin> (@admin)");
    expect(mail?.text).toContain(replyContent);
    expect(mail?.text.endsWith(directLink)).toBe(true);
    expect(mail?.html).toContain("You were mentioned in a discussion.");
    expect(mail?.html).toContain("Study &amp; planning");
    expect(mail?.html).toContain("Ada &lt;Admin&gt; (@admin)");
    expect(mail?.html).toContain(
      "<p>Complete &lt;script&gt;alert(&quot;mail&quot;)&lt;/script&gt; reply<br>Second &amp; line</p>",
    );
    expect(mail?.html).toContain(`<p>${unabridgedParagraph}</p>`);
    expect(mail?.html).not.toContain("<script>");
    expect(mail?.html.endsWith(`Open discussion</a></p>`)).toBe(true);
    expect(`${mail?.text}${mail?.html}`).not.toContain("ROOT SECRET BODY");

    await app.concepts.Posting.edit({
      post: reply.post,
      content: "Edited after enqueue",
      at: new Date(at.getTime() + 1_000),
    });
    await app.whenIdle();
    expect((await queuedMail())?.text).toContain(replyContent);
    expect((await queuedMail())?.text).not.toContain("Edited after enqueue");
    const inbox = await call("/notifications/inbox", {}, memberSession.session);
    expect(inbox).toMatchObject({
      ok: true,
      value: {
        notifications: expect.arrayContaining([
          expect.objectContaining({
            notification: notified.notification,
            conversation: thread.conversation,
            discussionTitle: "Study & planning",
          }),
        ]),
      },
    });

    // Reading a surviving reply must never recover the hidden opening's title.
    await app.concepts.Trashing.trash({ item: root.post, by: admin.user, at });
    await app.whenIdle();
    const afterTrash = await call("/notifications/inbox", {}, memberSession.session);
    expect(afterTrash).toMatchObject({
      ok: true,
      value: {
        notifications: expect.arrayContaining([
          expect.objectContaining({
            notification: notified.notification,
            conversation: thread.conversation,
            discussionTitle: "Discussion",
          }),
        ]),
      },
    });
    expect(JSON.stringify(afterTrash)).not.toContain("Study & planning");
    const next = await app.concepts.Notifying.notify({
      recipient: member.user,
      kind: "accepted",
      subject: reply.post,
      link: reply.post,
      actor: null,
      at,
    });
    await app.whenIdle();
    const nextMail = (await app.concepts.Mailing._getPending({})).find((m) =>
      m.key.includes(next.notification),
    );
    expect(nextMail?.subject).toBe("Your answer was accepted: Discussion");
  });
});

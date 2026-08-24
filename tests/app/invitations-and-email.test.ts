import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { deliverPendingMail, type MailSender } from "../../src/email/worker.ts";

const configuration = {
  host: "smtp.example.edu",
  port: 587,
  secure: false,
  from: "Commons <noreply@example.edu>",
};

describe("invitations and email", () => {
  test("the application renders invitation mail before the worker transports it", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const issued = await edge.application.concepts.Inviting.invite({
      channel: "email",
      address: "new@example.edu",
      at: new Date(),
    });
    await edge.application.whenIdle();

    const pending = await edge.application.concepts.Mailing._getPending({});
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toContain(`/register?invitation=${issued.invitation}`);
    expect(pending[0].text).toContain(issued.credential);
    expect(pending[0].text).not.toContain(`invitation=${issued.credential}`);

    const messages: Parameters<MailSender["sendMail"]>[0][] = [];
    await deliverPendingMail(edge.application.concepts.Mailing, configuration, {
      async sendMail(message) {
        messages.push(message);
      },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: "new@example.edu",
      subject: "Your Commons invitation",
      text: pending[0].text,
      html: pending[0].html,
    });

    const registered = await edge.gateway.invoke("/auth/accept-invitation", {
      invitation: issued.invitation,
      temporaryPassword: issued.credential,
      username: "new_member",
      password: "permanent-password",
      displayName: "New Member",
    });
    expect(registered.ok).toBe(true);
  });

  test("the application renders notification mail before transport", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const registered = await edge.application.concepts.Authenticating.register({
      username: "notified_member",
      password: "permanent-password",
      email: "member@example.edu",
    });
    if ("error" in registered) throw new Error(String(registered.error));
    const notified = await edge.application.concepts.Notifying.notify({
      recipient: registered.user,
      kind: "reply",
      subject: "post-1",
      link: "post-1",
      at: new Date(),
    });
    if ("error" in notified) throw new Error(String(notified.error));
    await edge.application.whenIdle();

    const pending = await edge.application.concepts.Mailing._getPending({});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      key: notified.notification,
      recipient: "member@example.edu",
      subject: "New Commons notification",
    });
    expect(pending[0].text).toContain("/notifications");
  });

  test("an invalid invitation is rejected explicitly", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const result = await edge.gateway.invoke("/auth/accept-invitation", {
      invitation: "missing",
      temporaryPassword: "wrong",
      username: "new_member",
      password: "permanent-password",
      displayName: "New Member",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "INVITATION_INVALID" },
    });
  });

  test("an administrator can retract an unaccepted invitation and invalidates its link", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const adminReg = await edge.application.concepts.Authenticating.register({
      username: "admin_user",
      password: "password123",
      email: "admin@example.edu",
    });
    if ("error" in adminReg) throw new Error(String(adminReg.error));
    await edge.application.whenIdle();

    const adminSession = await edge.application.concepts.Sessioning.start({
      user: adminReg.user,
      at: new Date(),
    });
    if ("error" in adminSession) throw new Error(String(adminSession.error));

    const issued = await edge.application.concepts.Inviting.invite({
      channel: "email",
      address: "candidate@example.edu",
      at: new Date(),
    });
    await edge.application.whenIdle();

    // Retract via endpoint
    const retractResult = await edge.gateway.invoke("/invitations/retract", {
      session: adminSession.session,
      invitation: issued.invitation,
    });
    expect(retractResult).toMatchObject({
      ok: true,
      value: { invitation: issued.invitation },
    });
    await edge.application.whenIdle();

    // Trying to accept the retracted invitation fails
    const acceptResult = await edge.gateway.invoke("/auth/accept-invitation", {
      invitation: issued.invitation,
      temporaryPassword: issued.credential,
      username: "candidate_user",
      password: "permanent-password",
      displayName: "Candidate User",
    });
    expect(acceptResult).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "INVITATION_INVALID" },
    });
  });

  test("retracting an invitation that is already gone refuses without ending the session", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const adminReg = await edge.application.concepts.Authenticating.register({
      username: "admin_user3",
      password: "password123",
      email: "admin3@example.edu",
    });
    if ("error" in adminReg) throw new Error(String(adminReg.error));
    await edge.application.whenIdle();

    const login = await edge.fetch(
      new Request("http://edge/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin_user3", password: "password123" }),
      }),
    );
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] as string;
    expect(cookie).toBeTruthy();

    // A second administrator (or a stale list) already removed this invitation.
    const response = await edge.fetch(
      new Request("http://edge/api/invitations/retract", {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: cookie },
        body: JSON.stringify({ invitation: crypto.randomUUID() }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "NOT_FOUND" });
    // A 401 here would make the boundary clear the session cookie and sign the
    // administrator out; the refusal must not touch the session.
    expect(response.headers.get("set-cookie")).toBeNull();

    const stillSignedIn = await edge.fetch(
      new Request("http://edge/api/invitations/list", {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: cookie },
        body: "{}",
      }),
    );
    expect(stillSignedIn.status).toBe(200);
  });

  test("only administrators can list registered users", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const adminReg = await edge.application.concepts.Authenticating.register({
      username: "admin_user2",
      password: "password123",
      email: "admin2@example.edu",
    });
    if ("error" in adminReg) throw new Error(String(adminReg.error));
    await edge.application.concepts.Profiling.createProfile({
      user: adminReg.user,
      displayName: "Admin Two",
    });
    await edge.application.whenIdle();

    const adminSession = await edge.application.concepts.Sessioning.start({
      user: adminReg.user,
      at: new Date(),
    });
    if ("error" in adminSession) throw new Error(String(adminSession.error));

    const nonAdminReg = await edge.application.concepts.Authenticating.register({
      username: "member_user",
      password: "password123",
      email: "member@example.edu",
    });
    if ("error" in nonAdminReg) throw new Error(String(nonAdminReg.error));
    await edge.application.whenIdle();

    const memberSession = await edge.application.concepts.Sessioning.start({
      user: nonAdminReg.user,
      at: new Date(),
    });
    if ("error" in memberSession) throw new Error(String(memberSession.error));

    // Admin listing succeeds
    const adminListResult = await edge.gateway.invoke("/users/list", {
      session: adminSession.session,
    });
    expect(adminListResult.ok).toBe(true);
    if (adminListResult.ok) {
      expect((adminListResult.value as any).users.length).toBeGreaterThanOrEqual(2);
    }

    // Non-admin listing receives FORBIDDEN
    const memberListResult = await edge.gateway.invoke("/users/list", {
      session: memberSession.session,
    });
    expect(memberListResult).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "FORBIDDEN" },
    });
  });

  test("a failed delivery is recorded on the message and the outbox lists it for administrators", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const adminReg = await edge.application.concepts.Authenticating.register({
      username: "mail_admin",
      password: "password123",
      email: "mail-admin@example.edu",
    });
    if ("error" in adminReg) throw new Error(String(adminReg.error));
    await edge.application.whenIdle();
    const adminSession = await edge.application.concepts.Sessioning.start({
      user: adminReg.user,
      at: new Date(),
    });
    if ("error" in adminSession) throw new Error(String(adminSession.error));

    await edge.application.concepts.Inviting.invite({
      channel: "email",
      address: "unreachable@example.edu",
      at: new Date(),
    });
    await edge.application.whenIdle();

    // The transport rejects everything; the worker must record why.
    await deliverPendingMail(edge.application.concepts.Mailing, configuration, {
      async sendMail() {
        throw new Error("550 mailbox unavailable");
      },
    });

    const listed = await edge.gateway.invoke("/mail/list", { session: adminSession.session });
    if (!listed.ok) throw new Error("the administrator could not read the outbox");
    const messages = (
      listed.value as {
        messages: {
          recipient: string;
          sentAt: string | null;
          attempts: number;
          lastError: string | null;
        }[];
      }
    ).messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      recipient: "unreachable@example.edu",
      sentAt: null,
      attempts: 1,
    });
    expect(messages[0].lastError).toContain("550 mailbox unavailable");

    // It stays queued, so a later attempt can still succeed and clear the error.
    await deliverPendingMail(edge.application.concepts.Mailing, configuration, {
      async sendMail() {},
    });
    const afterSuccess = await edge.gateway.invoke("/mail/list", {
      session: adminSession.session,
    });
    if (!afterSuccess.ok) throw new Error("the administrator could not read the outbox");
    const settled = (
      afterSuccess.value as { messages: { sentAt: string | null; lastError: string | null }[] }
    ).messages;
    expect(settled[0].sentAt).not.toBeNull();
    expect(settled[0].lastError).toBeNull();
  });

  test("a non-administrator cannot read the mail outbox", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const adminReg = await edge.application.concepts.Authenticating.register({
      username: "mail_admin2",
      password: "password123",
      email: "mail-admin2@example.edu",
    });
    if ("error" in adminReg) throw new Error(String(adminReg.error));
    await edge.application.whenIdle();
    const memberReg = await edge.application.concepts.Authenticating.register({
      username: "mail_member",
      password: "password123",
      email: "mail-member@example.edu",
    });
    if ("error" in memberReg) throw new Error(String(memberReg.error));
    await edge.application.whenIdle();
    const memberSession = await edge.application.concepts.Sessioning.start({
      user: memberReg.user,
      at: new Date(),
    });
    if ("error" in memberSession) throw new Error(String(memberSession.error));

    expect(
      await edge.gateway.invoke("/mail/list", { session: memberSession.session }),
    ).toMatchObject({ ok: false, error: { kind: "domain", value: "FORBIDDEN" } });
  });

  test("the HTTP boundary denies every data route without a session", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    expect([...edge.publicPaths].sort()).toEqual([
      "/auth/accept-invitation",
      "/auth/login",
      "/setup/register-admin",
    ]);
    const response = await edge.fetch(
      new Request("http://edge/api/threads/latest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });
});

afterAll(stopTestDb);

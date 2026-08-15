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

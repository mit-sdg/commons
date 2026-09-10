import { afterAll, describe, expect, test } from "vite-plus/test";
import { MongoMailingConcept } from "../../src/concepts/mailing/mailing.mongo.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { deliverPendingMail, type MailSender } from "../../src/email/worker.ts";

const configuration = {
  host: "smtp.example.edu",
  port: 587,
  secure: false,
  from: "Course <course@example.edu>",
};
const copyA = {
  key: "invitation",
  recipient: "member@example.edu",
  subject: "Subject A",
  text: "Copy A",
  html: "<p>Copy A</p>",
  at: new Date(),
};
const copyB = { ...copyA, subject: "Subject B", text: "Copy B", html: "<p>Copy B</p>" };

afterAll(stopTestDb);

describe("generation-aware mail delivery", () => {
  test("an in-flight success cannot mark a later resend as sent", async () => {
    const outbox = new MongoMailingConcept(await testDb());
    const { message } = await outbox.enqueue(copyA);
    const sent: Parameters<MailSender["sendMail"]>[0][] = [];
    await deliverPendingMail(outbox, configuration, {
      async sendMail(mail) {
        sent.push(mail);
        // A new invitation enqueue lands while the older SMTP operation is in flight.
        expect(await outbox.enqueue(copyB)).toEqual({ message });
      },
    });
    expect(sent.map((mail) => mail.text)).toEqual(["Copy A"]);
    expect(await outbox._getMessages({})).toMatchObject([
      { subject: "Subject B", sentAt: null, attempts: 0 },
    ]);
    expect(await outbox._getPending({})).toMatchObject([{ message, text: "Copy B" }]);
    await deliverPendingMail(outbox, configuration, {
      async sendMail(mail) {
        sent.push(mail);
      },
    });
    expect(sent.map((mail) => mail.text)).toEqual(["Copy A", "Copy B"]);
    expect(sent[0].messageId).not.toBe(sent[1].messageId);
    expect(await outbox._getPending({})).toEqual([]);
  });

  test("an in-flight failure cannot attach an old error to a newer resend", async () => {
    const outbox = new MongoMailingConcept(await testDb());
    await outbox.enqueue(copyA);
    await deliverPendingMail(outbox, configuration, {
      async sendMail() {
        await outbox.enqueue(copyB);
        throw new Error("Old copy rejected");
      },
    });
    expect(await outbox._getMessages({})).toMatchObject([
      { subject: "Subject B", sentAt: null, attempts: 0, lastError: null, lastAttemptAt: null },
    ]);
    expect(await outbox._getPending({})).toHaveLength(1);
  });

  test("ordinary retries retain a message ID, and legacy queued mail remains deliverable", async () => {
    const db = await testDb();
    const outbox = new MongoMailingConcept(db);
    const { message } = await outbox.enqueue(copyA);
    // Existing deployments have mail queued before generation tracking was introduced.
    await db
      .collection<{ _id: string }>("mailing.messages")
      .updateOne({ _id: message }, { $unset: { generation: "" } });
    expect(await outbox._getPending({})).toMatchObject([{ generation: null }]);
    const ids: string[] = [];
    await deliverPendingMail(outbox, configuration, {
      async sendMail(mail) {
        ids.push(mail.messageId);
        throw new Error("Temporary failure");
      },
    });
    await deliverPendingMail(outbox, configuration, {
      async sendMail(mail) {
        ids.push(mail.messageId);
      },
    });
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(await outbox._getPending({})).toEqual([]);
  });

  test("a legacy acknowledgement cannot consume a newly generated replacement", async () => {
    const db = await testDb();
    const outbox = new MongoMailingConcept(db);
    const { message } = await outbox.enqueue(copyA);
    await db
      .collection<{ _id: string }>("mailing.messages")
      .updateOne({ _id: message }, { $unset: { generation: "" } });
    await outbox.enqueue(copyB);
    await outbox.markSent({ message, generation: null, at: new Date() });
    expect(await outbox._getPending({})).toMatchObject([
      { text: "Copy B", generation: expect.any(String) },
    ]);
  });
});

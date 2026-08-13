import type { Collection, Db } from "mongodb";
import { MailNotFound } from "./errors.ts";
import { normalizeMailRecipient } from "./recipient.ts";

interface MailDoc {
  _id: string;
  key: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
  createdAt: Date;
  sentAt: Date | null;
}

export class MongoMailingConcept {
  private readonly messages: Collection<MailDoc>;
  private index: Promise<string> | undefined;

  constructor(db: Db) {
    this.messages = db.collection<MailDoc>("mailing.messages");
  }

  normalizeRecipient({ recipient }: { recipient: string }) {
    return { recipient: normalizeMailRecipient(recipient) };
  }

  async enqueue({
    key,
    recipient,
    subject,
    text,
    html,
    at,
  }: {
    key: string;
    recipient: string;
    subject: string;
    text: string;
    html: string;
    at: Date;
  }) {
    const normalizedRecipient = normalizeMailRecipient(recipient);
    await (this.index ??= this.messages.createIndex({ key: 1 }, { unique: true }));
    const replace = async (existing: MailDoc) => {
      await this.messages.updateOne(
        { _id: existing._id },
        {
          $set: {
            recipient: normalizedRecipient,
            subject,
            text,
            html,
            createdAt: at,
            sentAt: null,
          },
        },
      );
      return { message: existing._id };
    };

    const existing = await this.messages.findOne({ key });
    if (existing !== null) return replace(existing);

    const message = crypto.randomUUID();
    try {
      await this.messages.insertOne({
        _id: message,
        key,
        recipient: normalizedRecipient,
        subject,
        text,
        html,
        createdAt: at,
        sentAt: null,
      });
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== 11_000
      ) {
        throw error;
      }
      const raced = await this.messages.findOne({ key });
      if (raced === null) throw error;
      return replace(raced);
    }
    return { message };
  }

  async markSent({ message, at }: { message: string; at: Date }) {
    const result = await this.messages.updateOne({ _id: message }, { $set: { sentAt: at } });
    if (result.matchedCount === 0) throw new MailNotFound(message);
    return { message };
  }

  async _getPending(_: Record<string, never>) {
    return (await this.messages.find({ sentAt: null }).sort({ createdAt: 1 }).toArray()).map(
      (doc) => ({
        message: doc._id,
        key: doc.key,
        recipient: doc.recipient,
        subject: doc.subject,
        text: doc.text,
        html: doc.html,
        createdAt: doc.createdAt,
      }),
    );
  }

  async _getStatus({ message }: { message: string }) {
    const doc = await this.messages.findOne({ _id: message });
    return doc === null ? [] : [{ sentAt: doc.sentAt }];
  }
}

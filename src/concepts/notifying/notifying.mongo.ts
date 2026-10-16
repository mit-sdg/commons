import type { Collection, Db } from "mongodb";
import { speedIndexes } from "../indexes.ts";
import { NotificationNotFound } from "./errors.ts";

interface NotificationDoc {
  _id: string;
  recipient: string;
  kind: string;
  subject: string;
  link: string | null;
  actor: string | null;
  createdAt: Date;
  read: boolean;
  seq: number;
}

export class MongoNotifyingConcept {
  private readonly notifications: Collection<NotificationDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;
  readonly #ready: () => Promise<void>;

  constructor(db: Db, instance = "Notifying") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.notifications = db.collection<NotificationDoc>(`${prefix}.notifications`);
    this.counters = db.collection(`${prefix}.counters`);
    this.#ready = speedIndexes(instance, () =>
      this.notifications.createIndexes([
        { key: { recipient: 1, createdAt: -1, seq: -1 } },
        { key: { recipient: 1, read: 1 } },
        { key: { subject: 1 } },
      ]),
    );
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "notifications" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async notify({
    recipient,
    kind,
    subject,
    link,
    actor,
    at,
  }: {
    recipient: string;
    kind: string;
    subject: string;
    link: string | null;
    actor: string | null;
    at: Date;
  }) {
    await this.#ready();
    const notification = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.notifications.insertOne({
      _id: notification,
      recipient,
      kind,
      subject,
      link,
      actor,
      createdAt: at,
      read: false,
      seq,
    });
    return { notification };
  }

  async #ownedOrRefuse(notification: string, recipient: string): Promise<NotificationDoc> {
    await this.#ready();
    const doc = await this.notifications.findOne({ _id: notification });
    if (doc === null || doc.recipient !== recipient) {
      throw new NotificationNotFound(notification);
    }
    return doc;
  }

  async markRead({ notification, recipient }: { notification: string; recipient: string }) {
    await this.#ownedOrRefuse(notification, recipient);
    await this.notifications.updateOne({ _id: notification }, { $set: { read: true } });
    return { notification };
  }

  async markAllRead({ recipient }: { recipient: string }) {
    await this.#ready();
    await this.notifications.updateMany({ recipient }, { $set: { read: true } });
    return { recipient };
  }

  async dismiss({ notification, recipient }: { notification: string; recipient: string }) {
    await this.#ownedOrRefuse(notification, recipient);
    await this.notifications.deleteOne({ _id: notification });
    return { notification };
  }

  async clearSubject({ subject }: { subject: string }) {
    await this.#ready();
    await this.notifications.deleteMany({ subject });
    return { subject };
  }

  async _getInbox({ recipient }: { recipient: string }) {
    await this.#ready();
    const docs = await this.notifications
      .find({ recipient })
      .sort({ createdAt: -1, seq: -1 })
      .toArray();
    return docs.map((doc) => ({
      notification: doc._id,
      kind: doc.kind,
      subject: doc.subject,
      link: doc.link,
      actor: doc.actor,
      createdAt: doc.createdAt,
      read: doc.read,
    }));
  }

  async _hasFor({ user, subject }: { user: string; subject: string }) {
    await this.#ready();
    const doc = await this.notifications.findOne({ recipient: user, subject });
    return { notified: doc !== null };
  }

  async _getUnreadCount({ recipient }: { recipient: string }) {
    await this.#ready();
    const count = await this.notifications.countDocuments({ recipient, read: false });
    return { count };
  }
}

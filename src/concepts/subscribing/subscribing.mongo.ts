import { SubscribingConcept } from "./subscribing.ts";
import type { Collection, Db } from "mongodb";
import { AlreadySubscribed, NotSubscribed } from "./errors.ts";

interface SubscriptionDoc {
  _id: string;
  user: string;
  target: string;
  subscribedAt: Date;
  seq: number;
}

export class MongoSubscribingConcept {
  static readonly queries = SubscribingConcept.queries;

  private readonly subscriptions: Collection<SubscriptionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.subscriptions = db.collection<SubscriptionDoc>("subscribing.subscriptions");
    this.counters = db.collection("subscribing.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "subscriptions" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async subscribe({ user, target, at }: { user: string; target: string; at: Date }) {
    const existing = await this.subscriptions.findOne({ user, target });
    if (existing !== null) {
      throw new AlreadySubscribed(`${user} ${target}`);
    }
    const subscription = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.subscriptions.insertOne({ _id: subscription, user, target, subscribedAt: at, seq });
    return { subscription };
  }

  async unsubscribe({ user, target }: { user: string; target: string }) {
    const doc = await this.subscriptions.findOne({ user, target });
    if (doc === null) {
      throw new NotSubscribed(`${user} ${target}`);
    }
    await this.subscriptions.deleteOne({ _id: doc._id });
    return { subscription: doc._id };
  }

  async clearTarget({ target }: { target: string }) {
    await this.subscriptions.deleteMany({ target });
    return { target };
  }

  async _getSubscribers({ target }: { target: string }) {
    const docs = await this.subscriptions.find({ target }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ user: doc.user }));
  }

  async _getSubscriptions({ user }: { user: string }) {
    const docs = await this.subscriptions
      .find({ user })
      .sort({ subscribedAt: -1, seq: -1 })
      .toArray();
    return docs.map((doc) => ({ target: doc.target, subscribedAt: doc.subscribedAt }));
  }

  async _isSubscribed({ user, target }: { user: string; target: string }) {
    const doc = await this.subscriptions.findOne({ user, target });
    return { subscribed: doc !== null };
  }
}

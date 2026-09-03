/**
 * What the reasoner was asked and what it answered, read straight from the
 * stack's Mongo: every ask about one subject (a relay or a round) with its
 * reply, failure, and latency, and every insistence stood on it. Run under
 * node (the Mongo driver does not start under bun):
 *
 *   node --experimental-strip-types tests/robustness/mind.ts <mongo-uri> <about>
 */

import { MongoClient } from "mongodb";

export interface Ask {
  asking: string;
  about: string;
  passage: string;
  askedAt: string;
  reply: string | null;
  answeredAt: string | null;
  failure: string | null;
  latencyMs: number | null;
}

export interface Insistence {
  insistence: string;
  aim: string;
  patience: number;
  settled: boolean;
  satisfied: boolean;
  exhausted: boolean;
  complaints: { offering: string; account: string }[];
}

export class Mind {
  private readonly client: MongoClient;

  constructor(uri: string) {
    this.client = new MongoClient(uri);
  }

  async open() {
    await this.client.connect();
    return this;
  }

  async close() {
    await this.client.close();
  }

  /** Every ask about a subject, oldest first, with its reply or failure. */
  async asks(about: string): Promise<Ask[]> {
    const db = this.client.db();
    const askings = await db
      .collection("roundReasoning.askings")
      .find({ about })
      .sort({ seq: 1 })
      .toArray();
    const ids = askings.map((doc) => doc._id as unknown as string);
    const replies = await db
      .collection("roundReasoning.replies")
      .find({ asking: { $in: ids } })
      .toArray();
    const failures = await db
      .collection("roundReasoning.failures")
      .find({ asking: { $in: ids } })
      .toArray();
    const replyOf = new Map(replies.map((doc) => [doc.asking as string, doc]));
    const failureOf = new Map(failures.map((doc) => [doc.asking as string, doc]));
    return askings.map((doc) => {
      const reply = replyOf.get(doc._id as unknown as string);
      const failure = failureOf.get(doc._id as unknown as string);
      const askedAt = new Date(doc.askedAt as Date);
      const answeredAt = reply
        ? new Date(reply.answeredAt as Date)
        : failure
          ? new Date(failure.failedAt as Date)
          : null;
      return {
        asking: doc._id as unknown as string,
        about: doc.about as string,
        passage: doc.passage as string,
        askedAt: askedAt.toISOString(),
        reply: reply ? (reply.reply as string) : null,
        answeredAt: answeredAt?.toISOString() ?? null,
        failure: failure ? (failure.account as string) : null,
        latencyMs: answeredAt ? answeredAt.getTime() - askedAt.getTime() : null,
      };
    });
  }

  /** Every insistence whose aim is the subject, with its complaints. */
  async insistences(aim: string): Promise<Insistence[]> {
    const db = this.client.db();
    const docs = await db
      .collection("roundInsisting.insistences")
      .find({ aim })
      .sort({ seq: 1 })
      .toArray();
    const complaints = await db
      .collection("roundInsisting.complaints")
      .find({ insistence: { $in: docs.map((doc) => doc._id as unknown as string) } })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      insistence: doc._id as unknown as string,
      aim: doc.aim as string,
      patience: doc.patience as number,
      settled: doc.settled as boolean,
      satisfied: doc.satisfied as boolean,
      exhausted: doc.exhausted as boolean,
      complaints: complaints
        .filter((entry) => entry.insistence === (doc._id as unknown as string))
        .map((entry) => ({ offering: entry.offering as string, account: entry.account as string })),
    }));
  }
}

if (process.argv[1]?.endsWith("mind.ts") && process.argv[2] && process.argv[3]) {
  const mind = await new Mind(process.argv[2]).open();
  console.log(
    JSON.stringify(
      {
        asks: await mind.asks(process.argv[3]),
        insistences: await mind.insistences(process.argv[3]),
      },
      null,
      2,
    ),
  );
  await mind.close();
}

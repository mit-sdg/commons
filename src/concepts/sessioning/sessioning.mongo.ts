import type { Collection, Db } from "mongodb";
import { SessionNotFound } from "./errors.ts";

const IDLE_MS = 72 * 60 * 60 * 1_000;
const REFRESH_TIMEOUT_MS = 1_000;

/** Preserve the UTC time of day, clamping month-end starts to the last target day. */
function fourMonthsAfter(at: Date): Date {
  const end = new Date(at);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 4);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(at.getUTCDate(), lastDay));
  return end;
}

interface SessionDoc {
  _id: string;
  user: string;
  expiresAt: Date;
  // Absent on legacy sessions, whose original fixed expiry is preserved.
  absoluteExpiresAt?: Date;
}

export class MongoSessioningConcept {
  private readonly sessions: Collection<SessionDoc>;

  constructor(
    db: Db,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.sessions = db.collection<SessionDoc>("sessioning.sessions");
  }

  async start({ user, at }: { user: string; at?: Date }) {
    const beganAt = at ?? this.clock();
    const session = crypto.randomUUID();
    const expiresAt = new Date(beganAt.getTime() + IDLE_MS);
    const absoluteExpiresAt = fourMonthsAfter(beganAt);
    await this.sessions.insertOne({
      _id: session,
      user,
      expiresAt,
      absoluteExpiresAt,
    });
    return { session, expiresAt, absoluteExpiresAt };
  }

  async refresh({ session }: { session: string }) {
    // Sample when the action runs: an earlier request timestamp must not revive expiry.
    const at = this.clock();
    const result = await this.sessions.updateOne(
      { _id: session, expiresAt: { $gt: at }, absoluteExpiresAt: { $gt: at } },
      [
        {
          $set: {
            expiresAt: {
              $max: [
                "$expiresAt",
                { $min: ["$absoluteExpiresAt", new Date(at.getTime() + IDLE_MS)] },
              ],
            },
          },
        },
      ],
      { upsert: false, timeoutMS: REFRESH_TIMEOUT_MS },
    );
    return { session, refreshed: result.matchedCount === 1 };
  }

  async end({ session }: { session: string }) {
    const deleted = await this.sessions.deleteOne({ _id: session });
    if (deleted.deletedCount === 0) {
      throw new SessionNotFound(`No session named ${session}`);
    }
    return { session };
  }

  async endAllForUser({ user }: { user: string }) {
    await this.sessions.deleteMany({ user });
    return { user };
  }

  async _getUser({ session, at }: { session: string; at?: Date }) {
    const doc = await this.sessions.findOne({ _id: session });
    return doc === null || (at ?? this.clock()) >= doc.expiresAt ? [] : [{ user: doc.user }];
  }

  async _isExpired({ session, at }: { session: string; at: Date }) {
    const doc = await this.sessions.findOne({ _id: session });
    return { expired: doc !== null && at >= doc.expiresAt };
  }
}

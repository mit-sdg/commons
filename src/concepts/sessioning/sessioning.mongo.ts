import type { Collection, Db } from "mongodb";
import { SessionNotFound } from "./errors.ts";

interface SessionDoc {
  _id: string;
  user: string;
  expiresAt: Date;
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
    const expiresAt = new Date(beganAt.getTime() + 86_400_000);
    await this.sessions.insertOne({
      _id: session,
      user,
      expiresAt,
    });
    return { session, expiresAt };
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

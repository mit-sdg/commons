import { SessionNotFound } from "./errors.ts";

const freshID = () => crypto.randomUUID();

export class SessioningConcept {
  private readonly sessions = new Map<string, { user: string; expiresAt: Date }>();

  start({ user, at }: { user: string; at?: Date }) {
    const beganAt = at ?? new Date();
    const session = freshID();
    const expiresAt = new Date(beganAt.getTime() + 86_400_000);
    this.sessions.set(session, { user, expiresAt });
    return { session, expiresAt };
  }

  end({ session }: { session: string }) {
    if (!this.sessions.has(session)) {
      throw new SessionNotFound(`No session named ${session}`);
    }
    this.sessions.delete(session);
    return { session };
  }

  endAllForUser({ user }: { user: string }) {
    for (const [session, doc] of this.sessions) {
      if (doc.user === user) this.sessions.delete(session);
    }
    return { user };
  }

  _getUser({ session, at }: { session: string; at?: Date }): { user: string }[] {
    const doc = this.sessions.get(session);
    return doc === undefined || (at ?? new Date()) >= doc.expiresAt ? [] : [{ user: doc.user }];
  }

  _isExpired({ session, at }: { session: string; at: Date }): { expired: boolean } {
    const doc = this.sessions.get(session);
    return { expired: doc !== undefined && at >= doc.expiresAt };
  }
}

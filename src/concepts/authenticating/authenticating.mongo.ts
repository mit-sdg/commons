import { AuthenticatingConcept } from "./authenticating.ts";
import type { Collection, Db } from "mongodb";
import {
  EmailInvalid,
  InvalidCredentials,
  PasswordInvalidLength,
  UsernameInvalidChars,
  UsernameInvalidLength,
  UsernameTaken,
} from "./errors.ts";
import { derivePasswordVerifier, passwordMatchesVerifier } from "./password-verifier.ts";

const USERNAME_ALLOWED_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

interface UserDoc {
  _id: string;
  username: string;
  passwordVerifier: string;
  email: string;
}

export class MongoAuthenticatingConcept {
  static readonly queries = AuthenticatingConcept.queries;

  private readonly users: Collection<UserDoc>;

  constructor(db: Db) {
    this.users = db.collection<UserDoc>("authenticating.users");
  }

  async register({
    username,
    password,
    email,
  }: {
    username: string;
    password: string;
    email: string;
  }) {
    if (!email?.includes("@")) {
      throw new EmailInvalid("email must contain @");
    }
    if (username.length < 3 || username.length > 32) {
      throw new UsernameInvalidLength(username);
    }
    if (!USERNAME_ALLOWED_RE.test(username)) {
      throw new UsernameInvalidChars(username);
    }
    if (password.length < 8 || password.length > 128) {
      throw new PasswordInvalidLength("Must be 8-128 characters");
    }
    const existing = await this.users.findOne({ username });
    if (existing !== null) {
      throw new UsernameTaken(username);
    }
    const user = crypto.randomUUID();
    const passwordVerifier = await derivePasswordVerifier(password);
    await this.users.insertOne({ _id: user, username, passwordVerifier, email });
    return { user };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    const doc = await this.users.findOne({ username });
    const matches = await passwordMatchesVerifier(password, doc?.passwordVerifier);
    if (doc === null || !matches) {
      throw new InvalidCredentials("Unknown username or wrong password");
    }
    return { user: doc._id };
  }

  async changePassword({
    user,
    oldPassword,
    newPassword,
  }: {
    user: string;
    oldPassword: string;
    newPassword: string;
  }) {
    const doc = await this.users.findOne({ _id: user });
    if (!(await passwordMatchesVerifier(oldPassword, doc?.passwordVerifier))) {
      throw new InvalidCredentials("The current password is wrong.");
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new PasswordInvalidLength("Must be 8-128 characters");
    }
    const passwordVerifier = await derivePasswordVerifier(newPassword);
    await this.users.updateOne({ _id: user }, { $set: { passwordVerifier } });
    return { user };
  }

  async _getById({ user }: { user: string }) {
    const doc = await this.users.findOne({ _id: user });
    return doc === null ? [] : [{ username: doc.username, email: doc.email }];
  }

  async _getByUsername({ username }: { username: string }) {
    const doc = await this.users.findOne({ username });
    return doc === null ? [] : [{ user: doc._id }];
  }

  async _getUserCount(_: Record<string, never>) {
    return { count: await this.users.countDocuments() };
  }

  async _search({ query }: { query: string }) {
    const needle = query.toLowerCase();
    const docs = await this.users.find().toArray();
    return docs
      .filter((doc) => doc.username.toLowerCase().startsWith(needle))
      .map((doc) => ({ user: doc._id, username: doc.username }))
      .sort((a, b) => (a.username < b.username ? -1 : a.username > b.username ? 1 : 0))
      .slice(0, 10);
  }

  async _resolveIdentity({ ref }: { ref: string }) {
    const byId = await this.users.findOne({ _id: ref });
    if (byId !== null) return { user: byId._id, username: byId.username };

    const exact = await this.users.findOne({ username: ref });
    if (exact !== null) return { user: exact._id, username: exact.username };

    const folded = ref.toLowerCase();
    const matches = (await this.users.find().toArray()).filter(
      (doc) => doc.username.toLowerCase() === folded,
    );
    if (matches.length !== 1) return { user: null, username: null };
    return { user: matches[0]._id, username: matches[0].username };
  }

  async _denotedUser({ ref }: { ref: string }) {
    const byId = await this.users.findOne({ _id: ref });
    if (byId !== null) return [{ user: ref }];
    const byName = await this.users.findOne({ username: ref });
    if (byName !== null) return [{ user: byName._id }];
    return [{ user: ref }];
  }
}

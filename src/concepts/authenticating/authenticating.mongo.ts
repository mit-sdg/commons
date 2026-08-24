import type { Collection, Db } from "mongodb";
import {
  EmailInvalid,
  EmailTaken,
  InvalidCredentials,
  PasswordInvalidLength,
  UsernameInvalidChars,
  UsernameInvalidLength,
  UsernameTaken,
} from "./errors.ts";
import { derivePasswordVerifier, passwordMatchesVerifier } from "./password-verifier.ts";

const USERNAME_ALLOWED_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const DUPLICATE_KEY = 11_000;

// An address is trimmed and lower-cased before it is stored or matched, so
// addresses differing only in surrounding space or letter case name the same
// account.
function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

// An address looks like one when it contains exactly one @.
function looksLikeAddress(email: string): boolean {
  return email.split("@").length === 2;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === DUPLICATE_KEY
  );
}

interface UserDoc {
  _id: string;
  username: string;
  passwordVerifier: string;
  email: string;
}

export class MongoAuthenticatingConcept {
  private readonly users: Collection<UserDoc>;
  private index: Promise<string> | undefined;

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
    const address = normalizeEmail(email);
    if (!looksLikeAddress(address)) {
      throw new EmailInvalid("The email address is not well formed.");
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
    await (this.index ??= this.users.createIndex({ email: 1 }, { unique: true }));
    const existing = await this.users.findOne({ username });
    if (existing !== null) {
      throw new UsernameTaken(username);
    }
    if ((await this.users.findOne({ email: address })) !== null) {
      throw new EmailTaken(address);
    }
    const user = crypto.randomUUID();
    const passwordVerifier = await derivePasswordVerifier(password);
    try {
      await this.users.insertOne({ _id: user, username, passwordVerifier, email: address });
    } catch (error) {
      // The unique index is the authority: a racing registration for the same
      // address loses here rather than creating a second account for it.
      if (!isDuplicateKey(error)) throw error;
      throw new EmailTaken(address);
    }
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

  async resetPassword({ user, newPassword }: { user: string; newPassword: string }) {
    const doc = await this.users.findOne({ _id: user });
    if (doc === null) {
      throw new InvalidCredentials("There is no such account.");
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

  async _getByEmail({ email }: { email: string }) {
    const doc = await this.users.findOne({ email: normalizeEmail(email) });
    return doc === null ? [] : [{ user: doc._id }];
  }

  async _getByUsername({ username }: { username: string }) {
    const doc = await this.users.findOne({ username });
    return doc === null ? [] : [{ user: doc._id }];
  }

  async _getUserCount(_: Record<string, never>) {
    return { count: await this.users.countDocuments() };
  }

  async _getUsers(_: Record<string, never>) {
    const docs = await this.users.find().sort({ username: 1 }).toArray();
    return docs.map((doc) => ({
      user: doc._id,
      username: doc.username,
      email: doc.email,
    }));
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
    if (byId !== null) return { user: ref };
    const byName = await this.users.findOne({ username: ref });
    if (byName !== null) return { user: byName._id };
    return { user: ref };
  }
}

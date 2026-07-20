import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import {
  EmailInvalid,
  InvalidCredentials,
  PasswordInvalidLength,
  UsernameInvalidChars,
  UsernameInvalidLength,
  UsernameTaken,
} from "./errors.ts";
import { derivePasswordVerifier, passwordMatchesVerifier } from "./password-verifier.ts";

const freshID = () => crypto.randomUUID();

const USERNAME_ALLOWED_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

interface UserDoc {
  username: string;
  passwordVerifier: string;
  email: string;
}

export class AuthenticatingConcept {
  static readonly queries = {
    _getById: "optional",
    _getByUsername: "optional",
    _getUserCount: "one",
    _search: "many",
    _resolveIdentity: "one",
    _denotedUser: "optional",
  } as const satisfies Record<string, QueryPromise>;

  private readonly users = new Map<string, UserDoc>();

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
    for (const doc of this.users.values()) {
      if (doc.username === username) {
        throw new UsernameTaken(username);
      }
    }
    const user = freshID();
    const passwordVerifier = await derivePasswordVerifier(password);
    this.users.set(user, { username, passwordVerifier, email });
    return { user };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    let found: [string, UserDoc] | undefined;
    for (const [user, doc] of this.users) {
      if (doc.username === username) {
        found = [user, doc];
        break;
      }
    }
    if (await passwordMatchesVerifier(password, found?.[1].passwordVerifier)) {
      return { user: found?.[0] as string };
    }
    throw new InvalidCredentials("Unknown username or wrong password");
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
    const doc = this.users.get(user);
    if (doc === undefined || !(await passwordMatchesVerifier(oldPassword, doc.passwordVerifier))) {
      throw new InvalidCredentials("The current password is wrong.");
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new PasswordInvalidLength("Must be 8-128 characters");
    }
    doc.passwordVerifier = await derivePasswordVerifier(newPassword);
    return { user };
  }

  _getById({ user }: { user: string }): { username: string; email: string }[] {
    const doc = this.users.get(user);
    return doc === undefined ? [] : [{ username: doc.username, email: doc.email }];
  }

  _getByUsername({ username }: { username: string }): { user: string }[] {
    for (const [user, doc] of this.users) {
      if (doc.username === username) return [{ user }];
    }
    return [];
  }

  _getUserCount(_: Record<string, never>): { count: number } {
    return { count: this.users.size };
  }

  _search({ query }: { query: string }): { user: string; username: string }[] {
    const needle = query.toLowerCase();
    return [...this.users]
      .filter(([, doc]) => doc.username.toLowerCase().startsWith(needle))
      .map(([user, doc]) => ({ user, username: doc.username }))
      .sort((a, b) => (a.username < b.username ? -1 : a.username > b.username ? 1 : 0))
      .slice(0, 10);
  }

  _resolveIdentity({ ref }: { ref: string }): {
    user: string | null;
    username: string | null;
  } {
    const byId = this.users.get(ref);
    if (byId !== undefined) return { user: ref, username: byId.username };

    for (const [user, doc] of this.users) {
      if (doc.username === ref) return { user, username: doc.username };
    }

    const folded = ref.toLowerCase();
    const matches = [...this.users].filter(([, doc]) => doc.username.toLowerCase() === folded);
    if (matches.length !== 1) return { user: null, username: null };
    const [user, doc] = matches[0];
    return { user, username: doc.username };
  }

  _denotedUser({ ref }: { ref: string }): { user: string }[] {
    if (this.users.has(ref)) return [{ user: ref }];
    for (const [user, doc] of this.users) {
      if (doc.username === ref) return [{ user }];
    }
    return [{ user: ref }];
  }
}

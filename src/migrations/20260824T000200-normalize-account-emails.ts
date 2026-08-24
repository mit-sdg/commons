import type { Migration } from "./migration.ts";

/** The same rule `Authenticating` applies on every write and every lookup. */
const normalize = (email: string): string => (email ?? "").trim().toLowerCase();

/**
 * An email address is now a normalized, unique key on the account.
 *
 * Two things follow for a database written before that rule. Addresses stored
 * with surrounding space or mixed case no longer match a lookup, so the roster
 * import cannot resolve them to an account and the seats it holds for them stay
 * pending — the exact dead end the import sweep exists to remove. And
 * `Authenticating.register` now builds a unique index on `email` lazily, on
 * first use, caching the result for the process: if two stored addresses
 * collide, that index build fails and registration stays broken for the life of
 * the process.
 *
 * This migration normalizes what it can and then builds the index itself, so the
 * failure surfaces here — once, at startup, with the colliding accounts named —
 * rather than later as an unexplained registration outage.
 */
export const normalizeAccountEmails: Migration = {
  id: "20260824T000200-normalize-account-emails",
  description: "Trim and lower-case stored account emails, then enforce uniqueness.",
  async up(database) {
    const users = database.collection<{ _id: string; username: string; email: string }>(
      "authenticating.users",
    );
    const all = await users.find({}, { projection: { username: 1, email: 1 } }).toArray();

    // Group by the normalized address first and refuse before writing anything,
    // so a blocked run leaves the database exactly as it was.
    const byAddress = new Map<string, { _id: string; username: string; email: string }[]>();
    for (const row of all) {
      const address = normalize(row.email ?? "");
      const holders = byAddress.get(address);
      if (holders === undefined) byAddress.set(address, [row]);
      else holders.push(row);
    }

    const collisions = [...byAddress.entries()].filter(([, holders]) => holders.length > 1);
    if (collisions.length > 0) {
      // Picking a winner would silently take an address — a sign-in identity —
      // away from a real account, so this is an operator's decision, not ours.
      const detail = collisions
        .map(([address, holders]) => {
          const named = holders.map((row) => `@${row.username} (${row.email})`).join(", ");
          return `  ${address} is claimed by ${holders.length} accounts: ${named}`;
        })
        .join("\n");
      return {
        summary: "blocked",
        blocked:
          `${collisions.length} address(es) are held by more than one account once trimmed and\n` +
          `lower-cased. An address now identifies at most one account, and choosing which\n` +
          `account keeps it would take a sign-in identity from the others, so Commons will\n` +
          `not decide that on its own.\n\n${detail}\n\n` +
          `Resolve each one — archive or delete the accounts that should not keep the\n` +
          `address, or give them distinct addresses — then start Commons again.`,
      };
    }

    const drifted = all.filter((row) => (row.email ?? "") !== normalize(row.email ?? ""));
    for (const row of drifted) {
      await users.updateOne({ _id: row._id }, { $set: { email: normalize(row.email ?? "") } });
    }

    // Build the index here so the lazy build inside `register` finds it already
    // present. Idempotent: an existing identical index is a no-op.
    await users.createIndex({ email: 1 }, { unique: true });

    return {
      summary:
        drifted.length === 0
          ? "every stored address was already normalized; uniqueness enforced"
          : `normalized ${drifted.length} stored address(es); uniqueness enforced`,
    };
  },
};

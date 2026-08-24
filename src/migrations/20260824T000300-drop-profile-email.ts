import type { Migration } from "./migration.ts";

/**
 * A profile no longer holds an email address.
 *
 * `Authenticating` owns the address now, and every reader that needs one joins
 * it from the account. The stored profile field is inert rather than dangerous —
 * nothing reads it — but leaving it behind would keep a second copy of an address
 * that can no longer be kept in step with the account it belongs to, which is the
 * duplication the change removed. Dropping it makes the stored shape match the
 * contract.
 */
export const dropProfileEmail: Migration = {
  id: "20260824T000300-drop-profile-email",
  description: "Remove the dead `email` field from stored profiles.",
  async up(database) {
    const profiles = database.collection("profiling.profiles");
    const result = await profiles.updateMany(
      { email: { $exists: true } },
      { $unset: { email: "" } },
    );
    return {
      summary:
        result.modifiedCount === 0
          ? "no stored profile carried an email field"
          : `dropped the email field from ${result.modifiedCount} profile(s)`,
    };
  },
};

import type { Migration } from "./migration.ts";
import { roleContextForumToCommons } from "./20260824T000100-role-context-forum-to-commons.ts";
import { normalizeAccountEmails } from "./20260824T000200-normalize-account-emails.ts";
import { dropProfileEmail } from "./20260824T000300-drop-profile-email.ts";
import { adoptLinkingStore } from "./20260902T000200-adopt-linking-store.ts";
import { categorizingScope } from "./20260902T000100-categorizing-scope.ts";
import { carryUses } from "./20260903T000100-carry-uses.ts";

export { MigrationBlocked, runMigrations } from "./migration.ts";
export type { Migration, MigrationOutcome } from "./migration.ts";

/**
 * Every migration, oldest first. Order is the identifier order and is the order
 * they are applied in; entries are append-only once released, because a
 * deployment records what it has already run by identifier.
 */
export const commonsMigrations: readonly Migration[] = [
  roleContextForumToCommons,
  normalizeAccountEmails,
  dropProfileEmail,
  categorizingScope,
  adoptLinkingStore,
  carryUses,
];

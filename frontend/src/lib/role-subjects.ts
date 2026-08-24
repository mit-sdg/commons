import { publicErrorMessage } from "@/lib/api";

/**
 * How the admin console reads the person an administrator types.
 *
 * `/roles/assign` and `/roles/revoke` interpret an account identifier, an exact
 * username, or an exact email address, and they are the authority on which of
 * those a subject names. The console repeats that reading over the registered
 * users it has already loaded for one reason only: to say what the named person
 * currently holds and to keep the last administrator from being stranded before
 * the click. A stale list never decides the outcome — the endpoint does.
 *
 * The edge projects both `SUBJECT_NOT_FOUND` and `ROLE_NOT_FOUND` onto
 * `NOT_FOUND`, and `LAST_ADMINISTRATOR` onto `CONFLICT`, so which refusal it was
 * depends on what the caller was doing and on what the console could match.
 * Keeping that reading here keeps it out of the page and lets it be read alone.
 */

/** One registered account, projected from the administrator's own user list. */
export interface RoleSubjectAccount {
  user: string;
  username: string;
  email: string;
  displayName: string | null;
  archived: boolean;
  roleName: string | null;
  capabilities: readonly string[];
}

/**
 * A subject holding an `@` is read as an address and never as a username,
 * because a username may hold only letters, digits, hyphens, and underscores.
 */
export function subjectIsAddress(subject: string): boolean {
  return subject.includes("@");
}

/** Addresses match trimmed and lower-cased, as Authenticating matches them. */
function sameAddress(one: string, other: string): boolean {
  return one.trim().toLowerCase() === other.trim().toLowerCase();
}

/** The account a typed subject names, or `null` when the list holds nobody. */
export function matchRoleSubject(
  subject: string,
  accounts: readonly RoleSubjectAccount[],
): RoleSubjectAccount | null {
  const typed = subject.trim();
  if (typed === "") return null;
  if (subjectIsAddress(typed))
    return (
      accounts.find((account) => sameAddress(account.email, typed)) ?? null
    );
  return (
    accounts.find((account) => account.user === typed) ??
    accounts.find((account) => account.username === typed) ??
    null
  );
}

/** Somebody typed part of a name; offer the accounts that hold it. */
export function roleSubjectSuggestions(
  subject: string,
  accounts: readonly RoleSubjectAccount[],
  limit = 6,
): RoleSubjectAccount[] {
  const needle = subject.trim().toLowerCase();
  if (needle === "") return [];
  const fields = (account: RoleSubjectAccount) => [
    account.username.toLowerCase(),
    account.email.toLowerCase(),
    (account.displayName ?? "").toLowerCase(),
  ];
  const matches = accounts.filter((account) =>
    fields(account).some((field) => field.includes(needle)),
  );
  // A name somebody has started typing belongs above a name that merely holds
  // those letters, so the person they meant is in the first row or two.
  const startsWith = matches.filter((account) =>
    fields(account).some((field) => field.startsWith(needle)),
  );
  const rest = matches.filter((account) => !startsWith.includes(account));
  return [...startsWith, ...rest].slice(0, limit);
}

/**
 * The deployment keeps at least one administrator, and the server refuses the
 * change that would end that. Work it out here too, so the console can say why
 * instead of failing on click.
 */
export function isLastAdministrator(
  account: RoleSubjectAccount | null,
  accounts: readonly RoleSubjectAccount[],
): boolean {
  if (!account) return false;
  const administrators = accounts.filter((candidate) =>
    candidate.capabilities.includes("administer"),
  );
  return administrators.length === 1 && administrators[0].user === account.user;
}

/** What the refusal to a role change means, said as a sentence about it. */
export function roleSubjectRefusal(
  error: string,
  {
    subject,
    action,
    matched,
  }: {
    subject: string;
    action: "assign" | "revoke";
    matched: RoleSubjectAccount | null;
  },
): string {
  const typed = subject.trim();
  if (error === "CONFLICT") return "Assign another administrator first.";
  if (error !== "NOT_FOUND") return publicErrorMessage(error);
  if (matched === null)
    return subjectIsAddress(typed)
      ? `No account uses ${typed}.`
      : `No account matches “${typed}”. Use an exact username or email.`;
  return action === "assign"
    ? "That role no longer exists."
    : `@${matched.username} has no role.`;
}

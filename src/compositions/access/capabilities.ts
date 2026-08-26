/**
 * The application's capability registry.
 *
 * This is the single source of truth for what a role may carry. Policy views in
 * `policy.ts`, the role endpoints in `roles.ts`, and the admin console all read
 * from it, so the three cannot drift apart.
 *
 * `administer` is deliberately not listed here: it is a wildcard that satisfies
 * every capability check rather than a capability in its own right. An
 * administrator therefore gains new capabilities automatically as they are added.
 */
/**
 * The one reserved role context. It names the deployment as a whole rather than
 * any one area of it, so no capability held there belongs to the forum in
 * particular. Roling stores it as an opaque string.
 */
export const COMMONS = "commons";

export const ADMINISTER = "administer";

export const CAPABILITIES = {
  moderate:
    "Lock threads, trash posts, pin items, resolve flags, read post revisions, and assign posts to categories. Creating or deleting a category needs administer.",
  "course:manage":
    "Create and revise assignments, manage sections and enrolment, and set up or revise the class.",
  grade: "Enter grades, view the gradebook, and view every submission.",
  "live:host":
    "Create quizzes and surveys, draft them with the reasoner, launch and close live runs, and read their results.",
  "student-records": "Manage late days and staff notes about individual students.",
} as const;

export type Capability = keyof typeof CAPABILITIES;

export const CAPABILITY_NAMES = Object.keys(CAPABILITIES) as Capability[];

/** Every capability an administrator reaches, for presentation only. */
export const ALL_CAPABILITIES = [ADMINISTER, ...CAPABILITY_NAMES];

export const ADMIN_ROLE = "administrator";
export const INITIAL_ADMIN_CAPABILITIES = [ADMINISTER];

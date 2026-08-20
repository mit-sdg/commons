import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { assigning } from "./concepts/assigning/registry.ts";
import { authenticating } from "./concepts/authenticating/registry.ts";
import { banking } from "./concepts/banking/registry.ts";
import { bookmarking } from "./concepts/bookmarking/registry.ts";
import { categorizing } from "./concepts/categorizing/registry.ts";
import { conversing } from "./concepts/conversing/registry.ts";
import { flagging } from "./concepts/flagging/registry.ts";
import { formatting } from "./concepts/formatting/registry.ts";
import { grading } from "./concepts/grading/registry.ts";
import { inviting } from "./concepts/inviting/registry.ts";
import { itemizing } from "./concepts/itemizing/registry.ts";
import { linking } from "./concepts/linking/registry.ts";
import { locking } from "./concepts/locking/registry.ts";
import { mailing } from "./concepts/mailing/registry.ts";
import { notifying } from "./concepts/notifying/registry.ts";
import { noting } from "./concepts/noting/registry.ts";
import { pinning } from "./concepts/pinning/registry.ts";
import { posting } from "./concepts/posting/registry.ts";
import { profiling } from "./concepts/profiling/registry.ts";
import { reacting } from "./concepts/reacting/registry.ts";
import { resolving } from "./concepts/resolving/registry.ts";
import { revising } from "./concepts/revising/registry.ts";
import { roling } from "./concepts/roling/registry.ts";
import { rostering } from "./concepts/rostering/registry.ts";
import { sessioning } from "./concepts/sessioning/registry.ts";
import { submitting } from "./concepts/submitting/registry.ts";
import { subscribing } from "./concepts/subscribing/registry.ts";
import { tagging } from "./concepts/tagging/registry.ts";
import { tasking } from "./concepts/tasking/registry.ts";
import { tracking } from "./concepts/tracking/registry.ts";
import { trashing } from "./concepts/trashing/registry.ts";
import { setupSecretMatches } from "./computations/admin-setup.ts";
import {
  invitationMailHtml,
  invitationMailText,
  notificationMailHtml,
  notificationMailText,
} from "./computations/mail-content.ts";
import { taskListExtension, taskListKey, taskListMembers } from "./computations/task-lists.ts";

const registrations = {
  Assigning: assigning,
  Authenticating: authenticating,
  Banking: banking,
  Bookmarking: bookmarking,
  Categorizing: categorizing,
  Conversing: conversing,
  Flagging: flagging,
  Formatting: formatting,
  Grading: grading,
  Inviting: inviting,
  Itemizing: itemizing,
  Linking: linking,
  Locking: locking,
  Mailing: mailing,
  Notifying: notifying,
  Noting: noting,
  Pinning: pinning,
  Posting: posting,
  Profiling: profiling,
  Reacting: reacting,
  Resolving: resolving,
  Revising: revising,
  Roling: roling,
  Rostering: rostering,
  Sessioning: sessioning,
  Submitting: submitting,
  Subscribing: subscribing,
  Tagging: tagging,
  Tasking: tasking,
  TaskListMembership: roling,
  TaskLists: categorizing,
  Tracking: tracking,
  Trashing: trashing,
};

export const learningConcepts = conceptSet(registrations, {
  invitationMailHtml,
  invitationMailText,
  notificationMailHtml,
  notificationMailText,
  setupSecretMatches,
  taskListExtension,
  taskListKey,
  taskListMembers,
});

export const concepts = learningConcepts.concepts;
export const computations = learningConcepts.computations;

/** Construct the complete persistent implementation floor registered by every concept. */
export function mongoImplementations(database: Db, clock?: () => Date) {
  return learningConcepts.implementations("mongo", { database, clock });
}
export type CommonsConceptSet = typeof learningConcepts;

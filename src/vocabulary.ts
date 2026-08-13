import spec from "@design/vocabulary.md" with { type: "text" };
import { conceptSet } from "@mit-sdg/sync-engine/assembly";
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
import { timing } from "./concepts/timing/registry.ts";
import { tracking } from "./concepts/tracking/registry.ts";
import { trashing } from "./concepts/trashing/registry.ts";
import {
  invitationMailHtml,
  invitationMailText,
  notificationMailHtml,
  notificationMailText,
} from "./computations/mail-content.ts";

export { spec };

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
  Timing: timing,
  Tracking: tracking,
  Trashing: trashing,
};

export const learningConcepts = conceptSet(registrations, {
  invitationMailHtml,
  invitationMailText,
  notificationMailHtml,
  notificationMailText,
});

export const concepts = learningConcepts.concepts;
export const computations = learningConcepts.computations;
export const vocabulary = learningConcepts.vocabulary;
export type CommonsVocabulary = typeof vocabulary;

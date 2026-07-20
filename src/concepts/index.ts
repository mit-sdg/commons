import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { assigning } from "./assigning/registry.ts";
import { authenticating } from "./authenticating/registry.ts";
import { banking } from "./banking/registry.ts";
import { bookmarking } from "./bookmarking/registry.ts";
import { categorizing } from "./categorizing/registry.ts";
import { conversing } from "./conversing/registry.ts";
import { flagging } from "./flagging/registry.ts";
import { formatting } from "./formatting/registry.ts";
import { grading } from "./grading/registry.ts";
import { itemizing } from "./itemizing/registry.ts";
import { linking } from "./linking/registry.ts";
import { locking } from "./locking/registry.ts";
import { notifying } from "./notifying/registry.ts";
import { noting } from "./noting/registry.ts";
import { pinning } from "./pinning/registry.ts";
import { posting } from "./posting/registry.ts";
import { profiling } from "./profiling/registry.ts";
import { reacting } from "./reacting/registry.ts";
import { resolving } from "./resolving/registry.ts";
import { revising } from "./revising/registry.ts";
import { roling } from "./roling/registry.ts";
import { rostering } from "./rostering/registry.ts";
import { sessioning } from "./sessioning/registry.ts";
import { submitting } from "./submitting/registry.ts";
import { subscribing } from "./subscribing/registry.ts";
import { tagging } from "./tagging/registry.ts";
import { timing } from "./timing/registry.ts";
import { tracking } from "./tracking/registry.ts";
import { trashing } from "./trashing/registry.ts";

export const learningConcepts = conceptSet({
  Assigning: assigning,
  Authenticating: authenticating,
  Banking: banking,
  Bookmarking: bookmarking,
  Categorizing: categorizing,
  Conversing: conversing,
  Flagging: flagging,
  Formatting: formatting,
  Grading: grading,
  Itemizing: itemizing,
  Linking: linking,
  Locking: locking,
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
});

export const concepts = learningConcepts.concepts;
export const vocabulary = learningConcepts.vocabulary;
export type CommonsVocabulary = typeof vocabulary;

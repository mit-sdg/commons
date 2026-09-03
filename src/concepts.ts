import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { assigning } from "./concepts/assigning/registry.ts";
import { authenticating } from "./concepts/authenticating/registry.ts";
import { banking } from "./concepts/banking/registry.ts";
import { bookmarking } from "./concepts/bookmarking/registry.ts";
import { categorizing } from "./concepts/categorizing/registry.ts";
import { conversing } from "./concepts/conversing/registry.ts";
import { drafting } from "./concepts/drafting/registry.ts";
import { flagging } from "./concepts/flagging/registry.ts";
import { formatting } from "./concepts/formatting/registry.ts";
import { grading } from "./concepts/grading/registry.ts";
import { grouping } from "./concepts/grouping/registry.ts";
import { insisting } from "./concepts/insisting/registry.ts";
import { inviting } from "./concepts/inviting/registry.ts";
import { itemizing } from "./concepts/itemizing/registry.ts";
import { linking } from "./concepts/linking/registry.ts";
import { locking } from "./concepts/locking/registry.ts";
import { locating } from "./concepts/locating/registry.ts";
import { mailing } from "./concepts/mailing/registry.ts";
import { notifying } from "./concepts/notifying/registry.ts";
import { noting } from "./concepts/noting/registry.ts";
import { pinning } from "./concepts/pinning/registry.ts";
import { posting } from "./concepts/posting/registry.ts";
import { profiling } from "./concepts/profiling/registry.ts";
import { publishing } from "./concepts/publishing/registry.ts";
import { questioning } from "./concepts/questioning/registry.ts";
import { reacting } from "./concepts/reacting/registry.ts";
import { reasoning } from "./concepts/reasoning/registry.ts";
import { relaying } from "./concepts/relaying/registry.ts";
import { responding } from "./concepts/responding/registry.ts";
import { resolving } from "./concepts/resolving/registry.ts";
import { revising } from "./concepts/revising/registry.ts";
import { roling } from "./concepts/roling/registry.ts";
import { rostering } from "./concepts/rostering/registry.ts";
import { scoring } from "./concepts/scoring/registry.ts";
import { sessioning } from "./concepts/sessioning/registry.ts";
import { sharing } from "./concepts/sharing/registry.ts";
import { snapshotting } from "./concepts/snapshotting/registry.ts";
import { submitting } from "./concepts/submitting/registry.ts";
import { subscribing } from "./concepts/subscribing/registry.ts";
import { suggesting } from "./concepts/suggesting/registry.ts";
import { tagging } from "./concepts/tagging/registry.ts";
import { tasking } from "./concepts/tasking/registry.ts";
import { tracking } from "./concepts/tracking/registry.ts";
import { trashing } from "./concepts/trashing/registry.ts";
import { vouching } from "./concepts/vouching/registry.ts";
import { setupSecretMatches } from "./computations/admin-setup.ts";
import { capabilitiesAreKnown, effectiveCapabilities } from "./computations/capabilities.ts";
import { subjectIsAddress } from "./computations/role-subject.ts";
import { singleImportRow } from "./computations/roster-import.ts";
import {
  clarifiedPassage,
  draftTitle,
  draftingPassage,
  parseKind,
  parsedForm,
  parsedMaterial,
  parsedQuestion,
  parsedReason,
  repairPassage,
  revisionPassage,
} from "./computations/live-drafting.ts";
import {
  editCap,
  editChoices,
  editParts,
  editPosition,
  editPrompt,
  editRoundCap,
  editRoundChoices,
  editRoundJson,
  editRoundParts,
  editRoundPosition,
  editRoundTakesFrom,
  editRoundTakesShape,
  editShape,
  editTitle,
  legMaterials,
  relayDraftPassage,
  relayDraftReading,
  relayDraftReason,
  relayDraftRepairPassage,
  relayEditLines,
} from "./computations/live-edits.ts";
import { soleTarget } from "./computations/live-links.ts";
import {
  answerKind,
  briefStanding,
  cardStanding,
  carryUses,
  pileCards,
  pilesOnWall,
  useFit,
  useStanding,
} from "./computations/live-carries.ts";
import { cardId, isSame, noChoices, oneBoxCap, oneBoxParts } from "./computations/live-rounds.ts";
import { positionAfter, positionBefore, receiptKind } from "./computations/live-quizzes.ts";
import {
  answerReceipt,
  boardQuestions,
  explanationReceipt,
  partLabel,
  participantQuestions,
  snapshotForm,
  snapshotHasQuestion,
  snapshotIsWhole,
  snapshotTitle,
} from "./computations/live-snapshots.ts";
import {
  lidLines,
  lidPassage,
  participantAnswers,
  participantPassage,
  placingLines,
  placingPassage,
  placingReading,
  placingReason,
  placingRepairPassage,
} from "./computations/live-walls.ts";
import {
  passwordResetCooldownStart,
  passwordResetExpiry,
  passwordResetMailHtml,
  passwordResetMailText,
} from "./computations/password-reset.ts";
import {
  invitationMailHtml,
  invitationMailText,
  notificationMailHtml,
  notificationMailText,
  taskListMailHtml,
  taskListMailSubject,
  taskListMailText,
  taskMailHtml,
  taskMailSubject,
  taskMailText,
} from "./computations/mail-content.ts";

const registrations = {
  AdoptLinking: linking,
  Archiving: trashing,
  Assigning: assigning,
  Authenticating: authenticating,
  Banking: banking,
  Bookmarking: bookmarking,
  Categorizing: categorizing,
  Conversing: conversing,
  Drafting: drafting,
  DraftTrashing: trashing,
  Flagging: flagging,
  Formatting: formatting,
  Grading: grading,
  Grouping: grouping,
  Insisting: insisting,
  Inviting: inviting,
  Itemizing: itemizing,
  Linking: linking,
  Locking: locking,
  Locating: locating,
  Mailing: mailing,
  Notifying: notifying,
  Noting: noting,
  PasswordResetVouching: vouching,
  PickLinking: linking,
  Piling: categorizing,
  Pinning: pinning,
  Posting: posting,
  Profiling: profiling,
  Publishing: publishing,
  Questioning: questioning,
  Reacting: reacting,
  Reasoning: reasoning,
  Relaying: relaying,
  Responding: responding,
  Resolving: resolving,
  Retiring: trashing,
  Revising: revising,
  Roling: roling,
  Rostering: rostering,
  Scoring: scoring,
  Sessioning: sessioning,
  Sharing: sharing,
  RunSnapshotting: snapshotting,
  Submitting: submitting,
  Subscribing: subscribing,
  Suggesting: suggesting,
  Tagging: tagging,
  TaskNotifying: notifying,
  Tasking: tasking,
  Tracking: tracking,
  Trashing: trashing,
};

export const learningConcepts = conceptSet(registrations, {
  answerReceipt,
  boardQuestions,
  capabilitiesAreKnown,
  cardId,
  clarifiedPassage,
  draftTitle,
  draftingPassage,
  editCap,
  editChoices,
  editParts,
  editPosition,
  editPrompt,
  editRoundCap,
  editRoundChoices,
  editRoundJson,
  editRoundParts,
  editRoundPosition,
  editRoundTakesFrom,
  editRoundTakesShape,
  editShape,
  editTitle,
  explanationReceipt,
  legMaterials,
  parseKind,
  parsedForm,
  parsedMaterial,
  parsedQuestion,
  parsedReason,
  participantQuestions,
  relayDraftPassage,
  relayDraftReading,
  relayDraftReason,
  relayDraftRepairPassage,
  relayEditLines,
  repairPassage,
  revisionPassage,
  soleTarget,
  positionAfter,
  positionBefore,
  receiptKind,
  effectiveCapabilities,
  answerKind,
  carryUses,
  pileCards,
  useStanding,
  useFit,
  pilesOnWall,
  cardStanding,
  briefStanding,
  isSame,
  noChoices,
  oneBoxCap,
  oneBoxParts,
  partLabel,
  invitationMailHtml,
  invitationMailText,
  notificationMailHtml,
  notificationMailText,
  passwordResetCooldownStart,
  passwordResetExpiry,
  passwordResetMailHtml,
  passwordResetMailText,
  setupSecretMatches,
  singleImportRow,
  snapshotForm,
  snapshotHasQuestion,
  snapshotIsWhole,
  snapshotTitle,
  lidLines,
  lidPassage,
  participantAnswers,
  participantPassage,
  placingLines,
  placingPassage,
  placingReading,
  placingReason,
  placingRepairPassage,
  subjectIsAddress,
  taskListMailHtml,
  taskListMailSubject,
  taskListMailText,
  taskMailHtml,
  taskMailSubject,
  taskMailText,
});

export const concepts = learningConcepts.concepts;
export const computations = learningConcepts.computations;

/** Construct the complete persistent implementation floor registered by every concept. */
export function mongoImplementations(database: Db, clock?: () => Date) {
  return learningConcepts.implementations("mongo", { database, clock });
}
export type CommonsConceptSet = typeof learningConcepts;

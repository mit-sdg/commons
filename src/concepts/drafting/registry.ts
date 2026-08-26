import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Drafting.md" with { type: "text" };
import { MongoDraftingConcept } from "./drafting.mongo.ts";
import {
  AlreadyAdopted,
  AlreadyAnswered,
  AlreadyDrafted,
  AwaitingClarification,
  BriefNotFound,
  CandidateNotFound,
  ClarificationNotFound,
  NotAwaitingDraft,
  RequestStalled,
} from "./errors.ts";

export const drafting = registerConcept({
  class: MongoDraftingConcept,
  spec,
  refusals: {
    BRIEF_NOT_FOUND: BriefNotFound,
    CANDIDATE_NOT_FOUND: CandidateNotFound,
    CLARIFICATION_NOT_FOUND: ClarificationNotFound,
    ALREADY_DRAFTED: AlreadyDrafted,
    ALREADY_ADOPTED: AlreadyAdopted,
    ALREADY_ANSWERED: AlreadyAnswered,
    AWAITING_CLARIFICATION: AwaitingClarification,
    REQUEST_STALLED: RequestStalled,
    NOT_AWAITING_DRAFT: NotAwaitingDraft,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoDraftingConcept(database) },
});

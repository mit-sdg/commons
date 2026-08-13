import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Inviting.md" with { type: "text" };
import { InvitationAlreadyClaimed, InvitationInvalid } from "./errors.ts";
import { InvitingConcept } from "./inviting.ts";
import { MongoInvitingConcept } from "./inviting.mongo.ts";

export const inviting = registerConcept({
  class: InvitingConcept,
  spec,
  refusals: {
    INVITATION_ALREADY_CLAIMED: InvitationAlreadyClaimed,
    INVITATION_INVALID: InvitationInvalid,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoInvitingConcept(database) },
});

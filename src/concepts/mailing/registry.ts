import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Mailing.md" with { type: "text" };
import { MailNotFound, MailRecipientInvalid } from "./errors.ts";
import { MongoMailingConcept } from "./mailing.mongo.ts";

export const mailing = registerConcept({
  class: MongoMailingConcept,
  spec,
  refusals: {
    MAIL_RECIPIENT_INVALID: MailRecipientInvalid,
    MAIL_NOT_FOUND: MailNotFound,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoMailingConcept(database) },
});

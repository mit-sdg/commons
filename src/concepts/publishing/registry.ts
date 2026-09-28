import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Publishing.md" with { type: "text" };
import { MongoPublishingConcept } from "./publishing.mongo.ts";
import {
  AlreadyClosed,
  EditionNotFound,
  MaterialAlreadyShared,
  PartDone,
  PartOpen,
  WholeClosed,
} from "./errors.ts";

export const publishing = registerConcept({
  class: MongoPublishingConcept,
  spec,
  refusals: {
    MATERIAL_ALREADY_SHARED: MaterialAlreadyShared,
    EDITION_NOT_FOUND: EditionNotFound,
    ALREADY_CLOSED: AlreadyClosed,
    WHOLE_CLOSED: WholeClosed,
    PART_OPEN: PartOpen,
    PART_DONE: PartDone,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoPublishingConcept(database) },
});

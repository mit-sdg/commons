import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Wording.md" with { type: "text" };
import { InvalidWording } from "./errors.ts";
import { MongoWordingConcept } from "./wording.mongo.ts";

export const wording = registerConcept({
  class: MongoWordingConcept,
  spec,
  refusals: { INVALID_WORDING: InvalidWording },
  floors: { mongo: ({ database }: { database: Db }) => new MongoWordingConcept(database) },
});

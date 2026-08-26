import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Reasoning.md" with { type: "text" };
import { MongoReasoningConcept } from "./reasoning.mongo.ts";
import { AlreadySettled, AskingNotFound } from "./errors.ts";

export const reasoning = registerConcept({
  class: MongoReasoningConcept,
  spec,
  refusals: {
    ASKING_NOT_FOUND: AskingNotFound,
    ALREADY_SETTLED: AlreadySettled,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoReasoningConcept(database) },
});

import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Accessing.md" with { type: "text" };
import { MongoAccessingConcept } from "./accessing.mongo.ts";
import { AccessAlreadyEstablished } from "./errors.ts";

export const accessing = registerConcept({
  class: MongoAccessingConcept,
  spec,
  refusals: { ACCESS_ALREADY_ESTABLISHED: AccessAlreadyEstablished },
  floors: { mongo: ({ database }: { database: Db }) => new MongoAccessingConcept(database) },
});

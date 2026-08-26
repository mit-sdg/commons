import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Snapshotting.md" with { type: "text" };
import { SnapshotExists } from "./errors.ts";
import { MongoSnapshottingConcept } from "./snapshotting.mongo.ts";

export const snapshotting = registerConcept({
  class: MongoSnapshottingConcept,
  spec,
  refusals: { SNAPSHOT_EXISTS: SnapshotExists },
  floors: {
    mongo: ({ database }: { database: Db }) => new MongoSnapshottingConcept(database),
  },
});

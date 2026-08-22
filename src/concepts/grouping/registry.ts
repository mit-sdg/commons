import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Grouping.md" with { type: "text" };
import { MongoGroupingConcept } from "./grouping.mongo.ts";
import {
  AlreadyAMember,
  GroupNotFound,
  LastMember,
  NotAMember,
  TargetNotAMember,
} from "./errors.ts";

export const grouping = registerConcept({
  class: MongoGroupingConcept,
  spec,
  refusals: {
    ALREADY_A_MEMBER: AlreadyAMember,
    GROUP_NOT_FOUND: GroupNotFound,
    LAST_MEMBER: LastMember,
    NOT_A_MEMBER: NotAMember,
    TARGET_NOT_A_MEMBER: TargetNotAMember,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoGroupingConcept(database, instance),
  },
});

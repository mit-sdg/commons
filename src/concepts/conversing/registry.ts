import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Conversing.md" with { type: "text" };
import { ConversingConcept } from "./conversing.ts";
import { MongoConversingConcept } from "./conversing.mongo.ts";
import {
  ItemAlreadyInConversation,
  NodeHasChildren,
  NodeNotFound,
  ParentNodeNotFound,
} from "./errors.ts";

export const conversing = registerConcept({
  class: ConversingConcept,
  spec,
  refusals: {
    ITEM_ALREADY_IN_CONVERSATION: ItemAlreadyInConversation,
    PARENT_NODE_NOT_FOUND: ParentNodeNotFound,
    NODE_NOT_FOUND: NodeNotFound,
    NODE_HAS_CHILDREN: NodeHasChildren,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoConversingConcept(database) },
});

import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
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
  queries: {
    _getThread: "many",
    _getConversation: "optional",
    _getNodeByItem: "optional",
    _parentOf: "optional",
    _getItem: "optional",
    _hasChildren: "one",
    _getConversations: "many",
    _getConversationsByLastActivity: "many",
  },
  refusals: {
    ITEM_ALREADY_IN_CONVERSATION: {
      error: ItemAlreadyInConversation,
      on: ["start", "reply"],
      public: PublicError.CONFLICT,
    },
    PARENT_NODE_NOT_FOUND: {
      error: ParentNodeNotFound,
      on: ["reply"],
      public: PublicError.NOT_FOUND,
    },
    NODE_NOT_FOUND: {
      error: NodeNotFound,
      on: ["remove"],
      public: PublicError.NOT_FOUND,
    },
    NODE_HAS_CHILDREN: {
      error: NodeHasChildren,
      on: ["remove"],
      public: PublicError.CONFLICT,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoConversingConcept(database) },
});

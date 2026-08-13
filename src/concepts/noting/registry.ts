import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Noting.md" with { type: "text" };
import { MongoNotingConcept } from "./noting.mongo.ts";
import {
  InvalidVisibility,
  NoteNotFound,
  NoteNotLearnerVisible,
  NoteNotOpen,
  NoteNotOwner,
  NoteNotResolved,
  NoteNotRestorable,
} from "./errors.ts";

export const noting = registerConcept({
  class: MongoNotingConcept,
  spec,
  refusals: {
    INVALID_VISIBILITY: InvalidVisibility,
    NOTE_NOT_FOUND: NoteNotFound,
    NOTE_NOT_OPEN: NoteNotOpen,
    NOTE_NOT_RESOLVED: NoteNotResolved,
    NOTE_NOT_RESTORABLE: NoteNotRestorable,
    NOTE_NOT_LEARNER_VISIBLE: NoteNotLearnerVisible,
    NOTE_NOT_OWNER: NoteNotOwner,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoNotingConcept(database) },
});

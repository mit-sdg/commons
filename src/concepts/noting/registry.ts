import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { NotingConcept } from "./noting.ts";
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
  class: NotingConcept,
  spec,
  refusals: {
    INVALID_VISIBILITY: {
      error: InvalidVisibility,
      on: ["write", "revise"],
      public: PublicError.INVALID_REQUEST,
    },
    NOTE_NOT_FOUND: {
      error: NoteNotFound,
      on: ["revise", "resolve", "archive", "restore", "acknowledge"],
      public: PublicError.NOT_FOUND,
    },
    NOTE_NOT_OPEN: {
      error: NoteNotOpen,
      on: ["revise", "resolve"],
      public: PublicError.CONFLICT,
    },
    NOTE_NOT_RESOLVED: {
      error: NoteNotResolved,
      on: ["archive"],
      public: PublicError.CONFLICT,
    },
    NOTE_NOT_RESTORABLE: {
      error: NoteNotRestorable,
      on: ["restore"],
      public: PublicError.CONFLICT,
    },
    NOTE_NOT_LEARNER_VISIBLE: {
      error: NoteNotLearnerVisible,
      on: ["acknowledge"],
      public: PublicError.NOT_FOUND,
    },
    NOTE_NOT_OWNER: {
      error: NoteNotOwner,
      on: ["acknowledge"],
      public: PublicError.NOT_FOUND,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoNotingConcept(database) },
});

import { PublicError, registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "./spec.md" with { type: "text" };
import { AuthenticatingConcept } from "./authenticating.ts";
import { MongoAuthenticatingConcept } from "./authenticating.mongo.ts";
import {
  EmailInvalid,
  InvalidCredentials,
  PasswordInvalidLength,
  UsernameInvalidChars,
  UsernameInvalidLength,
  UsernameTaken,
} from "./errors.ts";

export const authenticating = registerConcept({
  class: AuthenticatingConcept,
  spec,
  refusals: {
    INVALID_BODY: {
      error: EmailInvalid,
      on: ["register"],
      public: PublicError.INVALID_REQUEST,
    },
    USERNAME_INVALID_LENGTH: {
      error: UsernameInvalidLength,
      on: ["register"],
      public: PublicError.INVALID_REQUEST,
    },
    USERNAME_INVALID_CHARS: {
      error: UsernameInvalidChars,
      on: ["register"],
      public: PublicError.INVALID_REQUEST,
    },
    PASSWORD_INVALID_LENGTH: {
      error: PasswordInvalidLength,
      on: ["register", "changePassword"],
      public: PublicError.INVALID_REQUEST,
    },
    USERNAME_TAKEN: {
      error: UsernameTaken,
      on: ["register"],
      public: PublicError.CONFLICT,
    },
    INVALID_CREDENTIALS: {
      error: InvalidCredentials,
      on: ["authenticate", "changePassword"],
      public: PublicError.UNAUTHORIZED,
    },
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoAuthenticatingConcept(database) },
});

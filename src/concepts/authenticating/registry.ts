import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Authenticating.md" with { type: "text" };
import { MongoAuthenticatingConcept } from "./authenticating.mongo.ts";
import {
  EmailInvalid,
  EmailTaken,
  InvalidCredentials,
  PasswordInvalidLength,
  UsernameInvalidChars,
  UsernameInvalidLength,
  UsernameTaken,
} from "./errors.ts";

export const authenticating = registerConcept({
  class: MongoAuthenticatingConcept,
  spec,
  refusals: {
    INVALID_BODY: EmailInvalid,
    USERNAME_INVALID_LENGTH: UsernameInvalidLength,
    USERNAME_INVALID_CHARS: UsernameInvalidChars,
    PASSWORD_INVALID_LENGTH: PasswordInvalidLength,
    USERNAME_TAKEN: UsernameTaken,
    EMAIL_TAKEN: EmailTaken,
    INVALID_CREDENTIALS: InvalidCredentials,
  },
  floors: { mongo: ({ database }: { database: Db }) => new MongoAuthenticatingConcept(database) },
});

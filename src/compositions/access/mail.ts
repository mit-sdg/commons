import { activeUser } from "./session.ts";
import { each, former, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayAdminister, mayNotAdminister } from "./policy.ts";
import { concepts } from "../../concepts.ts";

const { Mailing } = concepts;

/** Every message the application has queued, with how its delivery went. */
export const theMailMessages = former(
  "the mail messages ()",
  (
    _inputs,
    { message, key, recipient, subject, createdAt, sentAt, attempts, lastAttemptAt, lastError },
  ) =>
    each(
      Mailing._getMessages({}).is({
        message,
        key,
        recipient,
        subject,
        createdAt,
        sentAt,
        attempts,
        lastAttemptAt,
        lastError,
      }),
    ).form({
      message,
      key,
      recipient,
      subject,
      createdAt,
      sentAt,
      attempts,
      lastAttemptAt,
      lastError,
    }),
);

export const List = endpoint("/mail/list", ({ session, actor }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
      .then(respond({ messages: theMailMessages({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

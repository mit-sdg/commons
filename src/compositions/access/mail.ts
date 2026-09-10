import { activeUser } from "./session.ts";
import { compute, each, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { mayAdminister, mayNotAdminister } from "./policy.ts";
import { computations, concepts } from "../../concepts.ts";

const { Mailing, Wording } = concepts;

/** The one place in Commons' mail whose words an administrator may replace. */
const INVITATION = "invitation";

/** Every message the application has queued, with how its delivery went. */
export const theMailMessages = former(
  "the mail messages ()",
  (
    _inputs,
    { message, recipient, subject, createdAt, sentAt, attempts, lastAttemptAt, lastError },
  ) =>
    each(
      Mailing._getMessages({}).is({
        message,
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
      recipient,
      subject,
      createdAt,
      sentAt,
      attempts,
      lastAttemptAt,
      lastError,
    }),
);

/** Commons' own words are Commons', not the outbox's and not the concept's. */
export const invitationCopy = view(
  "the effective invitation copy ()",
  (_inputs, { subject, body }, { wordedSubject, wordedBody }) =>
    where(
      whether(
        Wording._wordingIn({ place: INVITATION }).is({
          heading: wordedSubject,
          passage: wordedBody,
        }),
      ),
      compute(computations.invitationTemplateSubject, { subject: wordedSubject }, subject),
      compute(computations.invitationTemplateBody, { body: wordedBody }, body),
    ),
).one();

export const theInvitationTemplate = former(
  "the invitation email template ()",
  (_inputs, { subject, body }) =>
    where(invitationCopy({}).is({ subject, body })).form({ subject, body }),
);

/** `worded` separates an administrator's own words from the ones Commons falls back to. */
export const Template = endpoint("/mail/template", ({ session, actor }) =>
  receive({ session }).then(
    where(
      activeUser({ session }).is({ user: actor }),
      mayAdminister({ user: actor }),
      Wording._wordingIn({ place: INVITATION }),
    )
      .then(respond({ template: theInvitationTemplate({}), worded: true }))
      .named("worded"),
    where(
      activeUser({ session }).is({ user: actor }),
      mayAdminister({ user: actor }),
      no(Wording._wordingIn({ place: INVITATION })),
    )
      .then(respond({ template: theInvitationTemplate({}), worded: false }))
      .named("default"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const SaveTemplate = endpoint(
  "/mail/save-template",
  ({ session, subject, body, actor, savedSubject, savedBody }) =>
    receive({ session, subject, body }).then(
      where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
        .then(
          Wording.word({ place: INVITATION, heading: subject, passage: body }).responds({
            heading: savedSubject,
            passage: savedBody,
          }),
        )
        .then(respond({ template: { subject: savedSubject, body: savedBody }, worded: true }))
        .named("success"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ResetTemplate = endpoint("/mail/reset-template", ({ session, actor }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
      .then(Wording.withdraw({ place: INVITATION }))
      .then(respond({ template: theInvitationTemplate({}), worded: false }))
      .named("success"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

/** A draft previews through the same fallback and bounds a saved wording meets. */
export const theInvitationPreview = former(
  "the invitation email preview of (subject) and (body)",
  ({ subject, body }, { shownSubject, shownBody, text, html }) =>
    where(
      compute(computations.invitationTemplateSubject, { subject }, shownSubject),
      compute(computations.invitationTemplateBody, { body }, shownBody),
      compute(
        computations.invitationMailText,
        { invitation: "sample-invitation", credential: "EXAMPLE-PASSWORD", body: shownBody },
        text,
      ),
      compute(
        computations.invitationMailHtml,
        { invitation: "sample-invitation", credential: "EXAMPLE-PASSWORD", body: shownBody },
        html,
      ),
    ).form({ subject: shownSubject, text, html }),
);

/** A preview renders; it never decides. Only saving accepts or refuses copy. */
export const PreviewTemplate = endpoint(
  "/mail/preview-template",
  ({ session, subject, body, actor }) =>
    receive({ session, subject, body }).then(
      where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
        .then(respond({ preview: theInvitationPreview({ subject, body }) }))
        .named("success"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

/** Read a safe plain-text preview on demand; never send raw HTML or login secrets to the browser. */
export const Read = endpoint(
  "/mail/read",
  ({ session, message, actor, subject, recipient, text, preview }) =>
    receive({ session, message }).then(
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Mailing._getMessage({ message }).is({ subject, recipient, text }),
        compute(computations.mailPreviewText, { text }, preview),
      )
        .then(respond({ message, subject, recipient, text: preview }))
        .named("success"),
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        no(Mailing._getMessage({ message })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
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

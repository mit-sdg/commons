import { activeUser } from "./session.ts";
import { mayAdminister, mayNotAdminister } from "./policy.ts";
import {
  compute,
  each,
  former,
  now,
  reaction,
  view,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";

const { Inviting, Mailing } = concepts;

export const theInvitations = former(
  "the invitations ()",
  (_inputs, { invitation, channel, address, createdAt, lastInvitedAt, inviteCount, user }) =>
    each(
      Inviting._getInvitations({}).is({
        invitation,
        channel,
        address,
        createdAt,
        lastInvitedAt,
        inviteCount,
        user,
      }),
    ).form({ invitation, channel, address, createdAt, lastInvitedAt, inviteCount, user }),
);

/** Has this address already been invited? */
export const theInvitationFor = view(
  "the invitation for (address)",
  ({ address }, { invitation }, _bindings) =>
    where(Inviting._getInvitationByAddress({ channel: "email", address }).is({ invitation })),
).optional();

export const Invite = endpoint(
  "/invitations/invite",
  ({ session, email, actor, recipient, at, invitation, created }) =>
    receive({ session, email }).then(
      where(now(at), activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
        .then(Mailing.normalizeRecipient({ recipient: email }).responds({ recipient }))
        .then(
          Inviting.invite({ channel: "email", address: recipient, at }).responds({
            invitation,
            created,
          }),
        )
        .then(respond({ invitation, email: recipient, created }))
        .named("success"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const EmailInvitationQueuesMail = reaction(
  ({ invitation, address, credential, created, at, text, html, message }) =>
    when(
      Inviting.invite({ channel: "email", address, at }).responds({
        invitation,
        credential,
        created,
      }),
    )
      .where(
        compute(computations.invitationMailText, { invitation, credential }, text),
        compute(computations.invitationMailHtml, { invitation, credential }, html),
      )
      .then(
        Mailing.enqueue({
          key: invitation,
          recipient: address,
          subject: "Your Commons invitation",
          text,
          html,
          at,
        }).responds({ message }),
      ),
);

export const List = endpoint("/invitations/list", ({ session, actor }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
      .then(respond({ invitations: theInvitations({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const Retract = endpoint("/invitations/retract", ({ session, invitation, actor }) =>
  receive({ session, invitation }).then(
    where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
      .then(Inviting.retract({ invitation }))
      .then(respond({ invitation }))
      .named("success"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

import { compute, now, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";

const { Authenticating, Mailing, Sessioning, Vouching } = concepts;

export const RequestPasswordReset = endpoint(
  "/auth/request-password-reset",
  ({ email, recipient, user, at, expiresAt }) =>
    receive({ email }).then(
      where(now(at))
        .then(Mailing.normalizeRecipient({ recipient: email }).responds({ recipient }))
        .then(respond({ ok: true }))
        .named("accepted"),
      where(
        now(at),
        Authenticating._getByEmail({ email }).is({ user }),
        compute(computations.passwordResetExpiry, { at }, expiresAt),
      )
        .then(Vouching.issue({ subject: user, at, expiresAt }))
        .named("issued"),
    ),
  { input: { required: ["email"] } },
);

export const PasswordResetQueuesMail = reaction(
  ({ voucher, user, credential, at, username, email, text, html, message }) =>
    when(Vouching.issue({ at }).responds({ voucher, subject: user, credential }))
      .where(
        Authenticating._getById({ user }).is({ username, email }),
        compute(computations.passwordResetMailText, { voucher, credential, username }, text),
        compute(computations.passwordResetMailHtml, { voucher, credential, username }, html),
      )
      .then(
        Mailing.enqueue({
          key: voucher,
          recipient: email,
          subject: "Reset your Commons password",
          text,
          html,
          at,
        }).responds({ message }),
      ),
);

export const ResetPassword = endpoint(
  "/auth/reset-password",
  ({ voucher, credential, newPassword, user, at }) =>
    receive({ voucher, credential, newPassword })
      .where(now(at))
      .then(Vouching.verify({ voucher, credential, at }).responds({ subject: user }))
      .then(Authenticating.resetPassword({ user, newPassword }))
      .then(Vouching.redeem({ voucher, credential, at }))
      .then(Sessioning.endAllForUser({ user }))
      .then(respond({ ok: true })),
  { input: { required: ["voucher", "credential", "newPassword"] } },
);

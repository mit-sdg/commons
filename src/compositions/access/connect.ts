import { compute, each, former, is, no, now, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";
import { isArchived } from "./policy.ts";
import { activeUser } from "./session.ts";

const { Authenticating, Connecting, ConnectVouching, Profiling } = concepts;

/**
 * Admission takes the required fields, each holding text, and no fields but
 * those and the optional ones, which hold text or nothing, before any read.
 */
function textInput(required: string[], optional: string[] = []) {
  return (value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return { ok: false };
    const input = value as Record<string, unknown>;
    return {
      ok:
        Object.keys(input).every((field) => required.includes(field) || optional.includes(field)) &&
        required.every((field) => typeof input[field] === "string") &&
        optional.every((field) => input[field] === null || typeof input[field] === "string"),
    };
  };
}

/** A sign-in request names its app and carries the challenge of a verifier. */
const signInRequest = {
  input: {
    required: ["session", "app"],
    defaults: { code_challenge: null, code_challenge_method: null },
  },
  validators: {
    input: textInput(["session", "app"], ["code_challenge", "code_challenge_method"]),
  },
};

export const DescribeApp = endpoint(
  "/connect/describe",
  ({ session, app, challenge, method, user, accepted, challenged, host, callback }) =>
    receive({ session, app, code_challenge: challenge, code_challenge_method: method })
      .where(
        compute(computations.connectAppAccepted, { app }, accepted),
        compute(computations.connectChallengeAccepted, { challenge, method }, challenged),
      )
      .then(
        where(
          activeUser({ session }).is({ user }),
          is.among(accepted, [true]),
          is.among(challenged, [true]),
          compute(computations.connectAppHost, { app }, host),
          compute(computations.connectCallback, { app }, callback),
          Connecting._getApproval({ user, app }),
        )
          .then(respond({ app, host, callback, approved: true }))
          .named("approved"),
        where(
          activeUser({ session }).is({ user }),
          is.among(accepted, [true]),
          is.among(challenged, [true]),
          compute(computations.connectAppHost, { app }, host),
          compute(computations.connectCallback, { app }, callback),
          no(Connecting._getApproval({ user, app })),
        )
          .then(respond({ app, host, callback, approved: false }))
          .named("unapproved"),
        where(activeUser({ session }), is.among(accepted, [false]))
          .then(respond({ error: "CONNECT_APP_INVALID" }))
          .named("refused"),
        where(activeUser({ session }), is.among(accepted, [true]), is.among(challenged, [false]))
          .then(respond({ error: "CONNECT_CHALLENGE_INVALID" }))
          .named("unchallenged"),
      ),
  signInRequest,
);

export const ApproveApp = endpoint(
  "/connect/approve",
  ({
    session,
    app,
    challenge,
    method,
    user,
    accepted,
    challenged,
    at,
    expiresAt,
    connection,
    voucher,
    credential,
    code,
    callback,
  }) =>
    receive({ session, app, code_challenge: challenge, code_challenge_method: method })
      .where(
        activeUser({ session }).is({ user }),
        compute(computations.connectAppAccepted, { app }, accepted),
        is.among(accepted, [true]),
        compute(computations.connectChallengeAccepted, { challenge, method }, challenged),
        is.among(challenged, [true]),
        now(at),
        compute(computations.connectCodeExpiry, { at }, expiresAt),
      )
      .then(Connecting.approve({ user, app, at }).responds({ connection }))
      .then(
        ConnectVouching.issue({
          subject: connection,
          at,
          expiresAt,
          counterpart: challenge,
        }).responds({ voucher, credential }),
      )
      .then(
        where(
          compute(computations.connectCode, { voucher, credential }, code),
          compute(computations.connectCallback, { app }, callback),
        )
          .then(respond({ code, callback }))
          .named("issued"),
      ),
  signInRequest,
);

export const ApproveAppRefused = endpoint(
  "/connect/approve",
  ({ session, app, challenge, method, accepted, challenged }) =>
    receive({ session, app, code_challenge: challenge, code_challenge_method: method })
      .where(
        activeUser({ session }),
        compute(computations.connectAppAccepted, { app }, accepted),
        compute(computations.connectChallengeAccepted, { challenge, method }, challenged),
      )
      .then(
        where(is.among(accepted, [false]))
          .then(respond({ error: "CONNECT_APP_INVALID" }))
          .named("refused"),
        where(is.among(accepted, [true]), is.among(challenged, [false]))
          .then(respond({ error: "CONNECT_CHALLENGE_INVALID" }))
          .named("unchallenged"),
      ),
);

export const RedeemCode = endpoint(
  "/connect/redeem",
  ({
    code,
    app,
    verifier,
    at,
    voucher,
    credential,
    counterpart,
    connection,
    user,
    username,
    email,
    profileName,
    displayName,
  }) =>
    receive({ code, app, code_verifier: verifier })
      .where(
        now(at),
        compute(computations.connectCodeVoucher, { code }, voucher),
        compute(computations.connectCodeCredential, { code }, credential),
        compute(computations.connectVerifierChallenge, { verifier }, counterpart),
      )
      .then(
        ConnectVouching.redeem({ voucher, credential, at, counterpart }).responds({
          subject: connection,
        }),
      )
      .then(
        where(no(Connecting._getConnection({ connection }).is({ app })))
          .then(respond({ error: "CONNECT_CODE_INVALID" }))
          .named("unapproved"),
        where(Connecting._getConnection({ connection }).is({ app, user }), isArchived({ user }))
          .then(respond({ error: "CONNECT_CODE_INVALID" }))
          .named("archived"),
        where(
          Connecting._getConnection({ connection }).is({ app, user }),
          no(isArchived({ user })),
          Authenticating._getById({ user }).is({ username, email }),
          whether(Profiling._getProfileFields({ user }).is({ displayName: profileName })),
          compute(
            computations.connectDisplayName,
            { username, displayName: profileName },
            displayName,
          ),
        )
          .then(respond({ user, username, displayName, email }))
          .named("signed-in"),
      ),
  {
    input: { required: ["code", "app"], defaults: { code_verifier: null } },
    validators: { input: textInput(["code", "app"], ["code_verifier"]) },
  },
);

/** Which apps has this person allowed to sign them in? */
export const theConnectionsOf = former(
  "the connections of (user)",
  ({ user }, { connection, app, approvedAt }) =>
    each(Connecting._getConnections({ user }).is({ connection, app, approvedAt })).form({
      connection,
      app,
      approvedAt,
    }),
);

export const ListConnections = endpoint("/connect/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(respond({ connections: theConnectionsOf({ user }) })),
);

export const WithdrawConnection = endpoint(
  "/connect/withdraw",
  ({ session, connection, user }) =>
    receive({ session, connection }).then(
      where(
        activeUser({ session }).is({ user }),
        Connecting._getConnection({ connection }).is({ user }),
      )
        .then(Connecting.withdraw({ connection }))
        .then(respond({ connection }))
        .named("withdrawn"),
      where(
        activeUser({ session }).is({ user }),
        no(Connecting._getConnection({ connection }).is({ user })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unknown"),
    ),
  {
    input: { required: ["session", "connection"] },
    validators: { input: textInput(["session", "connection"]) },
  },
);

import { compute, each, former, is, no, now, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";
import { isArchived } from "./policy.ts";
import { activeUser } from "./session.ts";

const { Authenticating, Connecting, ConnectVouching, Profiling } = concepts;

/** Admission takes exactly these fields, each holding text, before any read. */
function textInput(...fields: string[]) {
  return (value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return { ok: false };
    const input = value as Record<string, unknown>;
    return {
      ok:
        Object.keys(input).length === fields.length &&
        fields.every((field) => typeof input[field] === "string"),
    };
  };
}

export const DescribeApp = endpoint(
  "/connect/describe",
  ({ session, app, user, accepted, host, callback }) =>
    receive({ session, app })
      .where(compute(computations.connectAppAccepted, { app }, accepted))
      .then(
        where(
          activeUser({ session }).is({ user }),
          is.among(accepted, [true]),
          compute(computations.connectAppHost, { app }, host),
          compute(computations.connectCallback, { app }, callback),
          Connecting._getApproval({ user, app }),
        )
          .then(respond({ app, host, callback, approved: true }))
          .named("approved"),
        where(
          activeUser({ session }).is({ user }),
          is.among(accepted, [true]),
          compute(computations.connectAppHost, { app }, host),
          compute(computations.connectCallback, { app }, callback),
          no(Connecting._getApproval({ user, app })),
        )
          .then(respond({ app, host, callback, approved: false }))
          .named("unapproved"),
        where(activeUser({ session }), is.among(accepted, [false]))
          .then(respond({ error: "CONNECT_APP_INVALID" }))
          .named("refused"),
      ),
  {
    input: { required: ["session", "app"] },
    validators: { input: textInput("session", "app") },
  },
);

export const ApproveApp = endpoint(
  "/connect/approve",
  ({
    session,
    app,
    user,
    accepted,
    at,
    expiresAt,
    connection,
    voucher,
    credential,
    code,
    callback,
  }) =>
    receive({ session, app })
      .where(
        activeUser({ session }).is({ user }),
        compute(computations.connectAppAccepted, { app }, accepted),
        is.among(accepted, [true]),
        now(at),
        compute(computations.connectCodeExpiry, { at }, expiresAt),
      )
      .then(Connecting.approve({ user, app, at }).responds({ connection }))
      .then(
        ConnectVouching.issue({ subject: connection, at, expiresAt }).responds({
          voucher,
          credential,
        }),
      )
      .then(
        where(
          compute(computations.connectCode, { voucher, credential }, code),
          compute(computations.connectCallback, { app }, callback),
        )
          .then(respond({ code, callback }))
          .named("issued"),
      ),
  {
    input: { required: ["session", "app"] },
    validators: { input: textInput("session", "app") },
  },
);

export const ApproveAppRefused = endpoint("/connect/approve", ({ session, app, accepted }) =>
  receive({ session, app })
    .where(
      activeUser({ session }),
      compute(computations.connectAppAccepted, { app }, accepted),
      is.among(accepted, [false]),
    )
    .then(respond({ error: "CONNECT_APP_INVALID" })),
);

export const RedeemCode = endpoint(
  "/connect/redeem",
  ({
    code,
    app,
    at,
    voucher,
    credential,
    connection,
    user,
    username,
    email,
    profileName,
    displayName,
  }) =>
    receive({ code, app })
      .where(
        now(at),
        compute(computations.connectCodeVoucher, { code }, voucher),
        compute(computations.connectCodeCredential, { code }, credential),
      )
      .then(ConnectVouching.redeem({ voucher, credential, at }).responds({ subject: connection }))
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
    input: { required: ["code", "app"] },
    validators: { input: textInput("code", "app") },
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
    validators: { input: textInput("session", "connection") },
  },
);

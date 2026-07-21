import { activeUser } from "./session.ts";
import { no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";
import { ADMIN_ROLE, FORUM, INITIAL_ADMIN_CAPABILITIES } from "./capabilities.ts";

const { Authenticating, Profiling, Roling, Sessioning, Timing } = concepts;
export const InvalidSessionIsRejected = reaction(({ session, at }) =>
  receive({ session })
    .where(Timing._now({}).is({ at }))
    .then(
      where(
        Sessioning._isExpired({ session, at }).is({ expired: false }),
        no(activeUser({ session })),
      )
        .then(respond({ error: "UNAUTHORIZED" }))
        .named("case-1"),
      where(Sessioning._isExpired({ session, at }).is({ expired: true }))
        .then(Sessioning.end({ session }))
        .then(respond({ error: "UNAUTHORIZED" }))
        .named("case-2"),
    ),
);
export const BootstrapAdminOnRegister = reaction(({ user, role }) =>
  when(Authenticating.register({}).responds({ user }))
    .where(
      Authenticating._getUserCount({}).is({ count: 1 }),
      Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
        present: false,
      }),
    )
    .then(
      Roling.ensureRole({ name: ADMIN_ROLE, capabilities: INITIAL_ADMIN_CAPABILITIES }).responds({
        role,
      }),
    )
    .then(Roling.grant({ user, context: FORUM, role })),
);

export const BootstrapAdminOnLogin = reaction(({ user, role }) =>
  when(Authenticating.authenticate({}).responds({ user }))
    .where(
      Authenticating._getUserCount({}).is({ count: 1 }),
      Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
        present: false,
      }),
    )
    .then(
      Roling.ensureRole({ name: ADMIN_ROLE, capabilities: INITIAL_ADMIN_CAPABILITIES }).responds({
        role,
      }),
    )
    .then(Roling.grant({ user, context: FORUM, role })),
);
export const theUserNamed = view(
  "the user named (username) with optional (user)",
  ({ username, user }) => where(Authenticating._getByUsername({ username }).is({ user })),
);

export const Register = endpoint(
  "/auth/register",
  ({ username, password, displayName, email, user }) =>
    receive({ username, password, displayName, email })
      .then(Authenticating.register({ username, password, email }).responds({ user }))
      .then(Profiling.createProfile({ user, displayName, email }))
      .then(respond({ user })),
);

export const Login = endpoint(
  "/auth/login",
  ({ username, password, user, session, expiresAt, at }) =>
    receive({ username, password })
      .then(Authenticating.authenticate({ username, password }).responds({ user }))
      .then(Timing.capture({}).responds({ at }))
      .then(Sessioning.start({ user, at }).responds({ session, expiresAt }))
      .then(respond({ session, expiresAt, user })),
);

export const Logout = endpoint("/auth/logout", ({ session }) =>
  receive({ session })
    .where(activeUser({ session }))
    .then(Sessioning.end({ session }))
    .then(respond({ ok: true })),
);

export const Me = endpoint("/auth/me", ({ session, user, username, email, profile }) =>
  receive({ session })
    .where(
      activeUser({ session }).is({ user }),
      Authenticating._getById({ user }).is({ username, email }),
      Profiling._getProfile({ user }).is({ profile }),
    )
    .then(respond({ user, username, email, profile })),
);

export const Resolve = endpoint("/auth/resolve", ({ username, user }) =>
  receive({ username }).then(
    where(theUserNamed({ username }).is({ user })).then(respond({ user })).named("case-1"),
    where(no(theUserNamed({ username })))
      .then(respond({ user: null }))
      .named("case-2"),
  ),
);
export const ChangePassword = endpoint(
  "/auth/changePassword",
  ({ session, oldPassword, newPassword, user }) =>
    receive({ session, oldPassword, newPassword })
      .where(activeUser({ session }).is({ user }))
      .then(Authenticating.changePassword({ user, oldPassword, newPassword }))
      .then(Sessioning.endAllForUser({ user }))
      .then(respond({ user })),
  { input: { required: ["session", "oldPassword", "newPassword"] } },
);

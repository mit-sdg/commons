import { activeUser } from "./session.ts";
import { no, reaction, request, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts/index.ts";
import { ADMIN_ROLE, FORUM, INITIAL_ADMIN_CAPABILITIES } from "./capabilities.ts";

const { Authenticating, Profiling, Roling, Sessioning, Timing } = concepts;
export const InvalidSessionIsRejected = reaction(({ session, at }) =>
  receive({ session })
    .where(Timing._now({}).is({ at }))
    .either(
      where(
        Sessioning._isExpired({ session, at }).is({ expired: false }),
        no(activeUser({ session })),
      ).then(respond({ error: "UNAUTHORIZED" })),
      where(Sessioning._isExpired({ session, at }).is({ expired: true })).then(
        request(Sessioning.end, { session }),
        respond({ error: "UNAUTHORIZED" }),
      ),
    ),
);
export const BootstrapAdminOnRegister = reaction(({ user, role }) =>
  when(Authenticating.register, {}, { user })
    .where(
      Authenticating._getUserCount({}).is({ count: 1 }),
      Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
        present: false,
      }),
    )
    .then(
      request(
        Roling.ensureRole,
        { name: ADMIN_ROLE, capabilities: INITIAL_ADMIN_CAPABILITIES },
        { role },
      ),
      request(Roling.grant, { user, context: FORUM, role }),
    ),
);

export const BootstrapAdminOnLogin = reaction(({ user, role }) =>
  when(Authenticating.authenticate, {}, { user })
    .where(
      Authenticating._getUserCount({}).is({ count: 1 }),
      Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
        present: false,
      }),
    )
    .then(
      request(
        Roling.ensureRole,
        { name: ADMIN_ROLE, capabilities: INITIAL_ADMIN_CAPABILITIES },
        { role },
      ),
      request(Roling.grant, { user, context: FORUM, role }),
    ),
);
export const theUserNamed = view(
  "the user named (username) with optional (user)",
  ({ username, user }) => where(Authenticating._getByUsername({ username }).is({ user })),
);

export const Register = endpoint(
  "/auth/register",
  ({ username, password, displayName, email, user }) =>
    receive({ username, password, displayName, email }).then(
      request(Authenticating.register, { username, password, email }, { user }),
      request(Profiling.createProfile, { user, displayName, email }),
      respond({ user }),
    ),
);

export const Login = endpoint(
  "/auth/login",
  ({ username, password, user, session, expiresAt, at }) =>
    receive({ username, password }).then(
      request(Authenticating.authenticate, { username, password }, { user }),
      request(Timing.capture, {}, { at }),
      request(Sessioning.start, { user, at }, { session, expiresAt }),
      respond({ session, expiresAt, user }),
    ),
);

export const Logout = endpoint("/auth/logout", ({ session }) =>
  receive({ session })
    .where(activeUser({ session }))
    .then(request(Sessioning.end, { session }), respond({ ok: true })),
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
  receive({ username }).either(
    where(theUserNamed({ username }).is({ user })).then(respond({ user })),
    where(no(theUserNamed({ username }))).then(respond({ user: null })),
  ),
);
export const ChangePassword = endpoint(
  "/auth/changePassword",
  ({ session, oldPassword, newPassword, user }) =>
    receive({ session, oldPassword, newPassword })
      .where(activeUser({ session }).is({ user }))
      .then(
        request(Authenticating.changePassword, { user, oldPassword, newPassword }),
        request(Sessioning.endAllForUser, { user }),
        respond({ user }),
      ),
  { input: { required: ["session", "oldPassword", "newPassword"] } },
);

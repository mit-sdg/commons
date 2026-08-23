import { activeUser } from "./session.ts";
import {
  compute,
  each,
  former,
  is,
  no,
  now,
  reaction,
  view,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  holdsARole,
  holdsNoRole,
  isArchived,
  isNotSoleAdministrator,
  isSoleAdministrator,
  mayAdminister,
  mayNotAdminister,
} from "./policy.ts";
import { theRoleFaceOf, theRoleOf } from "./roles.ts";
import { computations, concepts } from "../../concepts.ts";
import { ADMIN_ROLE, ADMINISTER, FORUM, INITIAL_ADMIN_CAPABILITIES } from "./capabilities.ts";

const { Archiving, Authenticating, Inviting, Profiling, Roling, Sessioning } = concepts;
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
    .then(Roling.assign({ user, context: FORUM, role })),
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
    .then(Roling.assign({ user, context: FORUM, role })),
);

export const RegisterInitialAdmin = endpoint(
  "/setup/register-admin",
  ({ setupSecret, username, password, displayName, email, valid, user }) =>
    receive({ setupSecret, username, password, displayName, email })
      .where(compute(computations.setupSecretMatches, { secret: setupSecret }, valid))
      .then(
        where(is.among(valid, [true]), Authenticating._getUserCount({}).is({ count: 0 }))
          .then(Authenticating.register({ username, password, email }).responds({ user }))
          .then(Profiling.createProfile({ user, displayName, email }))
          .then(respond({ user }))
          .named("success"),
        where(is.among(valid, [false]))
          .then(respond({ error: "UNAUTHORIZED" }))
          .named("unauthorized"),
        where(is.among(valid, [true]), no(Authenticating._getUserCount({}).is({ count: 0 })))
          .then(respond({ error: "CONFLICT" }))
          .named("initialized"),
      ),
);

export const theUserNamed = view("the user named (username)", ({ username }, { user }, _bindings) =>
  where(Authenticating._getByUsername({ username }).is({ user })),
).optional();

export const AcceptInvitation = endpoint(
  "/auth/accept-invitation",
  ({ invitation, temporaryPassword, username, password, displayName, email, user }) =>
    receive({ invitation, temporaryPassword, username, password, displayName })
      .then(
        Inviting.verify({ invitation, credential: temporaryPassword, channel: "email" }).responds({
          address: email,
        }),
      )
      .then(Authenticating.register({ username, password, email }).responds({ user }))
      .then(Profiling.createProfile({ user, displayName, email }))
      .then(Inviting.claim({ invitation, credential: temporaryPassword, user }))
      .then(respond({ user })),
);

export const theArchivedUserNamed = view(
  "the archived user named (username)",
  ({ username }, { user }, _bindings) =>
    where(Authenticating._getByUsername({ username }).is({ user }), isArchived({ user })),
).optional();

export const Login = endpoint(
  "/auth/login",
  ({ username, password, user, session, expiresAt, at }) =>
    receive({ username, password }).then(
      where(theArchivedUserNamed({ username }))
        .then(Authenticating.authenticate({ username, password }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("archived"),
      where(now(at), no(theArchivedUserNamed({ username })))
        .then(Authenticating.authenticate({ username, password }).responds({ user }))
        .then(Sessioning.start({ user, at }).responds({ session, expiresAt }))
        .then(respond({ session, expiresAt, user }))
        .named("success"),
    ),
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

/**
 * Every capability the signed-in caller reaches, in one read.
 *
 * The `administer` wildcard is expanded here rather than in the browser, so the
 * client and the endpoints that enforce policy cannot disagree about what a
 * caller may do.
 */
export const Permissions = endpoint(
  "/auth/permissions",
  ({ session, user, capabilities, effective }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }))
      .then(
        where(
          theRoleOf({ user, context: FORUM }).is({ capabilities }),
          compute(computations.effectiveCapabilities, { capabilities }, effective),
        )
          .then(respond({ capabilities: effective }))
          .named("assigned"),
        where(no(theRoleOf({ user, context: FORUM })))
          .then(respond({ capabilities: [] }))
          .named("none"),
      ),
);

export const Resolve = endpoint("/auth/resolve", ({ username, user }) =>
  receive({ username }).then(
    where(theUserNamed({ username }).is({ user })).then(respond({ user })).named("found"),
    where(no(theUserNamed({ username })))
      .then(respond({ user: null }))
      .named("absent"),
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

export const theRegisteredUsers = former(
  "the registered users ()",
  (_inputs, { user, username, email, displayName, avatar, archived }) =>
    each(Authenticating._getUsers({}).is({ user, username, email }))
      .where(
        whether(Profiling._getProfileFields({ user }).is({ displayName, avatar })),
        Archiving._isTrashed({ item: user }).is({ trashed: archived }),
      )
      .form({
        user,
        username,
        email,
        displayName,
        avatar,
        archived,
        role: whether(theRoleFaceOf({ user, context: FORUM })),
      }),
);

export const ListUsers = endpoint("/users/list", ({ session, actor }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
      .then(respond({ users: theRegisteredUsers({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

/**
 * An archived account can never sign in again, so it must not go on counting as
 * a holder of `administer`: the role goes before the archive does, and the
 * last-administrator floor guards the archive the same way it guards a
 * revocation. The steps are visible between one another — between the
 * revocation and the archive the account reads as an ordinary member that can
 * still sign in.
 */
export const ArchiveUser = endpoint("/users/archive", ({ session, user, actor, at }) =>
  receive({ session, user })
    .where(now(at), activeUser({ session }).is({ user: actor }))
    .then(
      where(
        mayAdminister({ user: actor }),
        activeUser({ session }).is.not({ user }),
        isNotSoleAdministrator({ user }),
        holdsARole({ user, context: FORUM }),
      )
        // The caller's authority is confirmed against Roling itself before the
        // ordered effects begin, which is also what carries the resolved caller
        // past the revocation and into the archive that records them.
        .then(Roling.requireCapability({ user: actor, context: FORUM, capability: ADMINISTER }))
        .then(Roling.revoke({ user, context: FORUM }))
        .then(Archiving.trash({ item: user, by: actor, at }))
        .then(Sessioning.endAllForUser({ user }))
        .then(respond({ user }))
        .named("success"),
      where(
        mayAdminister({ user: actor }),
        activeUser({ session }).is.not({ user }),
        isNotSoleAdministrator({ user }),
        holdsNoRole({ user, context: FORUM }),
      )
        .then(Archiving.trash({ item: user, by: actor, at }))
        .then(Sessioning.endAllForUser({ user }))
        .then(respond({ user }))
        .named("success-without-role"),
      where(
        mayAdminister({ user: actor }),
        activeUser({ session }).is.not({ user }),
        isSoleAdministrator({ user }),
      )
        .then(respond({ error: "LAST_ADMINISTRATOR" }))
        .named("last-administrator"),
      where(mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(mayAdminister({ user: actor }), activeUser({ session }).is({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("self"),
    ),
);

export const RestoreUser = endpoint("/users/restore", ({ session, user, actor }) =>
  receive({ session, user }).then(
    where(activeUser({ session }).is({ user: actor }), mayAdminister({ user: actor }))
      .then(Archiving.restore({ item: user }))
      .then(respond({ user }))
      .named("success"),
    where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

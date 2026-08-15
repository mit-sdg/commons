import { activeUser } from "./session.ts";
import { each, former, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../../concepts.ts";
import { mayAdminister, mayNotAdminister } from "./policy.ts";

const { Authenticating, Roling } = concepts;

/** Which roles are defined? */
export const theDefinedRoles = former(
  "the defined roles ()",
  (_inputs, { role, name, capabilities }) =>
    each(Roling._listRoles({}).is({ role, name, capabilities })).form({
      role,
      name,
      capabilities,
    }),
);

/** Which roles does this user hold in this context? */
export const theRolesHeldBy = former(
  "the roles held by (user) in (context)",
  ({ user, context }, { role }) =>
    each(Roling._getRoles({ user, context }).is({ role })).form({ role }),
);

export const DefineRole = endpoint("/roles/define", ({ session, name, capabilities, user, role }) =>
  receive({ session, name, capabilities }).then(
    where(activeUser({ session }).is({ user }), mayAdminister({ user }))
      .then(Roling.defineRole({ name, capabilities }).responds({ role }))
      .then(respond({ role }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GrantRole = endpoint(
  "/roles/grant",
  ({ session, user, context, role, actor, subject, resolved, grant }) =>
    receive({ session, user, context, role }).then(
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Authenticating._denotedUser({ ref: user }).is({ user: subject }),
        Roling._denotedRole({ ref: role }).is({ role: resolved }),
      )
        .then(Roling.grant({ user: subject, context, role: resolved }).responds({ grant }))
        .then(respond({ grant }))
        .named("success"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const RevokeRole = endpoint(
  "/roles/revoke",
  ({ session, user, context, role, actor, subject, resolved, grant }) =>
    receive({ session, user, context, role }).then(
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Authenticating._denotedUser({ ref: user }).is({ user: subject }),
        Roling._denotedRole({ ref: role }).is({ role: resolved }),
      )
        .then(Roling.revoke({ user: subject, context, role: resolved }).responds({ grant }))
        .then(respond({ grant }))
        .named("success"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const RolesForUser = endpoint("/roles/forUser", ({ user, context, subject }) =>
  receive({ user, context })
    .where(Authenticating._denotedUser({ ref: user }).is({ user: subject }))
    .then(respond({ roles: theRolesHeldBy({ user: subject, context }) })),
);

export const RoleCan = endpoint("/roles/can", ({ user, context, capability, allowed }) =>
  receive({ user, context, capability })
    .where(Roling._hasCapability({ user, context, capability }).is({ allowed }))
    .then(respond({ allowed })),
);

export const RoleGet = endpoint("/roles/get", ({ role, name, capabilities }) =>
  receive({ role })
    .where(Roling._getRoleDetail({ role }).is({ name, capabilities }))
    .then(respond({ name, capabilities })),
);

export const RoleList = endpoint("/roles/list", () =>
  receive().then(respond({ roles: theDefinedRoles({}) })),
);

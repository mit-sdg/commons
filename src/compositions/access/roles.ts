import { activeUser } from "./session.ts";
import { compute, each, former, is, no, view, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { computations, concepts } from "../../concepts.ts";
import {
  isNotSoleAdministrator,
  isSoleAdministrator,
  mayAdminister,
  mayNotAdminister,
} from "./policy.ts";

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

/**
 * The same answer in the two shapes the assembly needs: a formed value to embed
 * in a larger read, and a view to branch an endpoint on.
 */
export const theRoleFaceOf = former(
  "the role face of (user) in (context)",
  ({ user, context }, { role, name, capabilities }) =>
    where(
      Roling._getRole({ user, context }).is({ role }),
      Roling._getRoleDetail({ role }).is({ name, capabilities }),
    ).form({ role, name, capabilities }),
).optional();

export const theRoleOf = view(
  "the role of (user) in (context)",
  ({ user, context }, { role, name, capabilities }, _bindings) =>
    where(
      Roling._getRole({ user, context }).is({ role }),
      Roling._getRoleDetail({ role }).is({ name, capabilities }),
    ),
).optional();

export const DefineRole = endpoint(
  "/roles/define",
  ({ session, name, capabilities, user, known, role }) =>
    receive({ session, name, capabilities })
      .where(compute(computations.capabilitiesAreKnown, { capabilities }, known))
      .then(
        where(
          activeUser({ session }).is({ user }),
          mayAdminister({ user }),
          is.among(known, [true]),
        )
          .then(Roling.defineRole({ name, capabilities }).responds({ role }))
          .then(respond({ role }))
          .named("success"),
        where(
          activeUser({ session }).is({ user }),
          mayAdminister({ user }),
          is.among(known, [false]),
        )
          .then(respond({ error: "UNKNOWN_CAPABILITY" }))
          .named("unknown-capability"),
        where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
          .then(respond({ error: "FORBIDDEN" }))
          .named("forbidden"),
      ),
);

export const DeleteRole = endpoint("/roles/delete", ({ session, role, user, resolved }) =>
  receive({ session, role }).then(
    where(
      activeUser({ session }).is({ user }),
      mayAdminister({ user }),
      Roling._denotedRole({ ref: role }).is({ role: resolved }),
    )
      .then(Roling.deleteRole({ role: resolved }).responds({ role: resolved }))
      .then(respond({ role: resolved }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotAdminister({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

/**
 * Assigning replaces whatever role the subject already held, so a person always
 * carries exactly one. Moving the last administrator onto another role is
 * refused, otherwise the deployment would be left with nobody who can administer.
 */
export const AssignRole = endpoint(
  "/roles/assign",
  ({ session, user, context, role, actor, subject, resolved, assignment }) =>
    receive({ session, user, context, role }).then(
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Authenticating._denotedUser({ ref: user }).is({ user: subject }),
        isNotSoleAdministrator({ user: subject }),
        Roling._denotedRole({ ref: role }).is({ role: resolved }),
      )
        .then(Roling.assign({ user: subject, context, role: resolved }).responds({ assignment }))
        .then(respond({ assignment }))
        .named("success"),
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Authenticating._denotedUser({ ref: user }).is({ user: subject }),
        isSoleAdministrator({ user: subject }),
      )
        .then(respond({ error: "LAST_ADMINISTRATOR" }))
        .named("last-administrator"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const RevokeRole = endpoint(
  "/roles/revoke",
  ({ session, user, context, actor, subject, assignment }) =>
    receive({ session, user, context }).then(
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Authenticating._denotedUser({ ref: user }).is({ user: subject }),
        isNotSoleAdministrator({ user: subject }),
      )
        .then(Roling.revoke({ user: subject, context }).responds({ assignment }))
        .then(respond({ assignment }))
        .named("success"),
      where(
        activeUser({ session }).is({ user: actor }),
        mayAdminister({ user: actor }),
        Authenticating._denotedUser({ ref: user }).is({ user: subject }),
        isSoleAdministrator({ user: subject }),
      )
        .then(respond({ error: "LAST_ADMINISTRATOR" }))
        .named("last-administrator"),
      where(activeUser({ session }).is({ user: actor }), mayNotAdminister({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

/** One read answers the subject's role and what it carries, with no follow-up fetch. */
export const RoleForUser = endpoint(
  "/roles/forUser",
  ({ user, context, subject, role, name, capabilities }) =>
    receive({ user, context })
      .where(Authenticating._denotedUser({ ref: user }).is({ user: subject }))
      .then(
        where(theRoleOf({ user: subject, context }).is({ role, name, capabilities }))
          .then(respond({ role, name, capabilities }))
          .named("held"),
        where(no(theRoleOf({ user: subject, context })))
          .then(respond({ role: null, name: null, capabilities: [] }))
          .named("none"),
      ),
);

export const RoleGet = endpoint("/roles/get", ({ role, name, capabilities }) =>
  receive({ role })
    .where(Roling._getRoleDetail({ role }).is({ name, capabilities }))
    .then(respond({ name, capabilities })),
);

export const RoleList = endpoint("/roles/list", () =>
  receive().then(respond({ roles: theDefinedRoles({}) })),
);

import spec from "@design/compositions/Access.md" with { type: "text" };
import * as auth from "./access/auth.ts";
import * as invitations from "./access/invitations.ts";
import * as policy from "./access/policy.ts";
import * as roles from "./access/roles.ts";
import * as session from "./access/session.ts";

export { spec };
export const compositions = { auth, invitations, policy, roles, session };

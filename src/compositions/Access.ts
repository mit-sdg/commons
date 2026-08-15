import * as auth from "./access/auth.ts";
import * as invitations from "./access/invitations.ts";
import * as roles from "./access/roles.ts";
import * as session from "./access/session.ts";

export const compositions = { auth, invitations, roles, session };

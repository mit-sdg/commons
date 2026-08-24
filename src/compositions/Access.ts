import * as auth from "./access/auth.ts";
import * as invitations from "./access/invitations.ts";
import * as mail from "./access/mail.ts";
import * as recovery from "./access/recovery.ts";
import * as roles from "./access/roles.ts";
import * as session from "./access/session.ts";

export const compositions = { auth, invitations, mail, recovery, roles, session };

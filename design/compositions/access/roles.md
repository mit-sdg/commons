# Roles

A role is a named bundle of capabilities, and each account holds exactly one of
them in a context. Policy reads that single assignment whenever an operation
runs.

Commons declares four capabilities — `moderate`, `course:manage`, `grade`, and
`student-records` — plus the reserved `administer` wildcard, which names no power
of its own. The wildcard belongs to Commons, not to Roling: Roling stores exactly
the capability names a role was defined with and answers plain containment, and it
never expands `administer` into anything else. Every endpoint that enforces policy
therefore asks whether the caller's role contains the capability that endpoint
requires or contains `administer`, and each matching denial holds when the role
contains neither. An administrator therefore reaches new capabilities as they are
added instead of drifting behind a stored list, without any concept learning which
capability this application reserves.

An administrator uses [Access.roles.DefineRole](reaction:Access.roles.DefineRole) to create a uniquely named
bundle. Every requested capability is checked against the registry first, so a
mistyped name is refused with `UNKNOWN_CAPABILITY` rather than stored as a
permanently inert string. `administer` is not in that registry, so it is refused
here exactly like a mistyped name: no role defined through this endpoint can carry
the wildcard, and only the built-in administrator role established at registration
holds it.
[Access.roles.DeleteRole](reaction:Access.roles.DeleteRole) removes a role that nobody currently holds and
refuses one that is still assigned.

[Access.roles.AssignRole](reaction:Access.roles.AssignRole) interprets a known account identifier or exact
username and a known role identifier or name, then replaces whatever role the
subject already held, so a person never accumulates two.
[Access.roles.RevokeRole](reaction:Access.roles.RevokeRole) performs the same interpretation before removing
that assignment. Both refuse with `LAST_ADMINISTRATOR` when the change would
leave the deployment with nobody holding `administer`; the very first
administrator is instead established at registration, while the account count is
still one. The holders that guard counts are exactly the accounts that can still
sign in, because archiving an account revokes the role it held before the archive
commits, as Authentication describes. An unknown account reference is passed to
Roling as an opaque user identity rather than checked against Authenticating; an
unknown role is refused by Roling. Unauthorized changes return `FORBIDDEN`.

That guard is a composition-level read taken before a separate Roling action, and
Roling declares no such refusal, so the check and the change are not atomic. Two
administrators revoking each other's role at the same moment can each read the
other as a second holder and each commit, leaving the deployment with nobody
holding `administer`; sequential use cannot reach that state, and nothing detects
it afterwards. The invariant is deliberately left here rather than pushed into
Roling, which is a generic concept that must not learn which capability an
application reserves. Archiving carries the same shape: its own
`LAST_ADMINISTRATOR` check is a composition-level read taken before the separate
revocation and archive it performs, so two administrators archiving each other at
the same moment can each still read the other as a holder, each revoke, and reach
that same state. The hazard belongs to the guard rather than to one endpoint.
Recovery from a lost race is out of band: no endpoint can
assign a role once nobody holds `administer`, so an operator restores an
assignment through deployment access to the stored role state.

Public role reads expose authorization structure but do not authorize a caller.
[Access.roles.RoleForUser](reaction:Access.roles.RoleForUser) resolves an account and answers
[the role it holds](former:Access.roles.theRoleFaceOf) in one context, together with that role's name
and capabilities, so a reader never has to follow up with a second request.
[Access.roles.RoleGet](reaction:Access.roles.RoleGet) returns the name and capabilities of one known role.
[Access.roles.RoleList](reaction:Access.roles.RoleList) forms
[the complete role catalog](former:Access.roles.theDefinedRoles) with each role's capabilities. None of
these reads creates a role or assignment.

[The role held here](view:Access.roles.theRoleOf) is the same answer in the shape an endpoint
branches on, and is the view the session's permissions read consumes;
Authentication owns what that read answers the browser.

```endpoints
Access.roles.DefineRole at /roles/define
Access.roles.DeleteRole at /roles/delete
Access.roles.AssignRole at /roles/assign
Access.roles.RevokeRole at /roles/revoke
Access.roles.RoleForUser at /roles/forUser
Access.roles.RoleGet at /roles/get
Access.roles.RoleList at /roles/list
```

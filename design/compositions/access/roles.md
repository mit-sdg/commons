# Roles

A role is a named bundle of capabilities, and each account holds exactly one of
them in a context. Policy reads that single assignment whenever an operation
runs. Commons reserves one context for the deployment as a whole, named
`commons`, and every capability below is held and enforced there; the name is
Commons's own constant, and Roling stores it as an opaque string like any other.

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

[Access.roles.AssignRole](reaction:Access.roles.AssignRole) interprets a known account identifier, an
exact username, or an exact email address, together with a known role identifier
or name, then replaces whatever role the subject already held, so a person never
accumulates two. [Access.roles.RevokeRole](reaction:Access.roles.RevokeRole) performs the same interpretation
before removing that assignment. Both resolve the caller from the session and
refuse `FORBIDDEN` before they interpret the subject at all, so a caller who does
not hold `administer` receives the same answer whatever address they type. A
subject [holding an `@`](computation:subjectIsAddress) is read as an address and never as a
username: Authenticating accepts only letters, digits, hyphens, and underscores
in a username, so a subject holding one cannot be a username anybody could have
registered.
[The account holding an address](view:Access.roles.theAccountForAddress) answers such a subject the
way Authenticating matches an address, trimmed and lower-cased, so surrounding
space and letter case do not change who is named. An address that no account
holds is refused `SUBJECT_NOT_FOUND`, saying that no account holds that address,
and the refusal lands before the guard below is read and before Roling is asked
for anything: typing an address nobody holds is a mistake in the name, not an
instruction to give a role to a string. Both refuse with `LAST_ADMINISTRATOR`
when the change would leave the deployment with nobody holding `administer`; the
very first administrator is instead established at registration, while the
account count is still one. The holders that guard counts are exactly the accounts that can still
sign in, because archiving an account revokes the role it held before the archive
commits, as Authentication describes. Any other unknown account reference is
still passed to Roling as an opaque user identity rather than checked against
Authenticating; an unknown role is refused by Roling. Unauthorized changes return
`FORBIDDEN`.

Reading an address is therefore the one subject shape these two endpoints settle,
and Commons accepts what that costs. An assignment already keyed to a literal
address string can no longer be named here, because the same text now answers the
account that holds the address or is refused; such an assignment still counts as a
holder of whatever capability it carries, and correcting it is out of band through
deployment access to the stored role state, the same way a lost guard race is
corrected. Both endpoints already require `administer`, so only an administrator
can tell an address nobody holds from an address whose account holds no role.

The refusal stays on those two writes. No public role read resolves an address:
the reads below are approved as reads that expose authorization structure without
authorizing anyone, and an address handed to one of them is an unmatched string
like any other, so no caller — signed in or not — can use Commons to learn which
addresses have accounts. An administrative console showing what the
person it is naming currently holds answers that from the administrator-gated list
of registered accounts it already loads, not from a public read, and the refusal
must not be moved onto a read to save it the trouble.

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

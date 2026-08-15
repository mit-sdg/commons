# Roles

Roles are named capability bundles. A grant connects one role to an account in a
context, and policy reads current grants whenever an operation runs.

An administrator uses [Access.roles.DefineRole](reaction:Access.roles.DefineRole) to create a uniquely named
capability bundle.
[Access.roles.GrantRole](reaction:Access.roles.GrantRole) interprets a known account identifier or exact
username and a known role identifier or name before adding the grant, while
storing its context as an opaque string without an existence check.
[Access.roles.RevokeRole](reaction:Access.roles.RevokeRole) performs the same interpretation before removing
that grant. An unknown account reference is passed to Roling as an opaque user
identity rather than checked against Authenticating; an unknown role is refused
by Roling. Unauthorized changes return `FORBIDDEN`, and owner refusals such as a
duplicate or missing grant leave Roling unchanged. Built-in policy interprets
the reserved `forum` context and conversation identities; grants in other
contexts remain stored but do not affect those checks.

Public role reads expose authorization structure but do not authorize a caller.
[Access.roles.RolesForUser](reaction:Access.roles.RolesForUser) resolves an account and forms
[the roles it holds](former:Access.roles.theRolesHeldBy) in one context.
[Access.roles.RoleCan](reaction:Access.roles.RoleCan) reports whether that account's current grants
contain one capability. [Access.roles.RoleGet](reaction:Access.roles.RoleGet) returns the name and capabilities of one known role.
[Access.roles.RoleList](reaction:Access.roles.RoleList) forms
[the complete role catalog](former:Access.roles.theDefinedRoles) with each role's capabilities. None of
these reads creates a role or grant.

Roster behavior can also change the built-in course-staff grant. Because those
changes go through Roling, they immediately affect the same policy decisions as
administrator-managed grants and leave unrelated roles untouched.

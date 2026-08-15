# Roling

## Purpose

Define roles as named sets of capabilities, then grant or revoke those roles for
individual users within a context.

## Principle

A course defines an instructor role with grade and publish capabilities. A
second role with the same name is refused. Maya receives the role in the
course; granting it there again is refused. Revoking the role succeeds once and
is refused when she no longer holds it.

## Types

```types
external User
  An application-owned identity used in the user role.

external Context
  An application-owned identity used in the context role.
```

## State

```state
a set of Roles with
  a name         String
  a capabilities Strings

a set of Grants with
  a user    User
  a context Context
  a role    Role
```

## Actions

```actions
defineRole(name: String, capabilities: Strings) : return (role: Role)
  where no role has name name
  then
    add a new role with name and capabilities
    return role
  where some role has name name
  then
    refuse ROLE_ALREADY_EXISTS "A role with this name already exists."

ensureRole(name: String, capabilities: Strings) : return (role: Role)
  where some role has name name
  then
    return role
  where no role has name name
  then
    add a new role with name and capabilities
    return role

grant(user: User, context: Context, role: Role) : return (grant: Grant)
  where role in roles and no grant has user, context, and role
  then
    add a new grant with user, context, and role
    return grant
  where role not in roles
  then
    refuse ROLE_NOT_FOUND "No such role exists."
  where some grant has user, context, and role
  then
    refuse GRANT_ALREADY_EXISTS "The user already holds this role in this context."

revoke(user: User, context: Context, role: Role) : return (grant: Grant)
  where some grant has user, context, and role
  then
    delete that grant
    return grant
  where no grant has user, context, and role
  then
    refuse GRANT_NOT_FOUND "The user does not hold this role in this context."

requireCapability(user: User, context: Context, capability: String) : return (allowed: Boolean)
  where the user holds a granted role in the context that includes capability
  then
    return allowed
  where the user holds no granted role in the context that includes capability
  then
    refuse FORBIDDEN "The user does not hold the required capability in this context."
```

## Queries

```queries
_hasCapability (user: String, context: String, capability: String) : one (allowed: Boolean)
  answers whether a Role granted to the User in the Context contains the capability

_hasCapabilityHolder (context: String, capability: String) : one (present: Boolean)
  answers whether any User in the Context holds a Role containing the capability

_holdsRoleNamed (user: String, context: String, name: String) : one (held: Boolean)
  answers whether the User holds the named Role in the Context

_getRoles (user: String, context: String) : many (role: String)
  answers the user's granted roles in grant order
  answers no rows when none match

_getRoleByName (name: String) : optional (role: String)
  answers the Role with the exact name
  answers no row when the Role does not exist

_getRoleDetail (role: String) : optional (name: String, capabilities: Strings)
  answers the Role's name and capabilities
  answers no row when the Role does not exist

_listRoles () : many (role: String, name: String, capabilities: Strings)
  answers every role in definition order
  answers no rows when none match

_denotedRole (ref: String) : one (role: String)
  answers the existing Role denoted by an identifier or exact name
  answers ref itself as the Role when neither matches
```

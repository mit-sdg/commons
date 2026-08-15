# Roling

## Purpose

Define roles as named sets of capabilities, then grant or revoke those roles for
individual users within a context.

## Principle

A course defines an instructor role with grade and publish capabilities. A
second role with the same name is refused. Maya receives the role in the
course; granting it there again is refused. Revoking the role succeeds once and
is refused when she no longer holds it.

- `_hasCapability (user, context, capability)` answers exactly one row with
  `allowed`.
- `_hasCapabilityHolder (context, capability)` answers exactly one row with
  `present`.
- `_holdsRoleNamed (user, context, name)` answers exactly one row with `held`.
- `_getRoles (user, context)` answers the user's granted roles in grant order.
- `_getRoleByName (name)`, `_getRoleDetail (role)`, and `_denotedRole (ref)`
  each answer at most one role.
- `_listRoles ()` answers every role in definition order.

## Types

```types
external User
  The application user identity.

external Context
  The application context in which a role applies.

external Strings
  A collection of string values.
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

_hasCapabilityHolder (context: String, capability: String) : one (present: Boolean)

_holdsRoleNamed (user: String, context: String, name: String) : one (held: Boolean)

_getRoles (user: String, context: String) : many (role: String)

_getRoleByName (name: String) : optional (role: String)

_getRoleDetail (role: String) : optional (name: String, capabilities: Strings)

_listRoles () : many (role: String, name: String, capabilities: Strings)

_denotedRole (ref: String) : optional (role: String)
```

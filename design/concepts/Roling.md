# Roling

## Purpose

Define roles as named sets of capabilities, then give each user at most one role
within a context.

## Principle

A course defines an instructor role with grade and publish capabilities. A
second role with the same name is refused. Maya is assigned the role in the
course; assigning her a different role there replaces the first, so she holds
exactly one. Revoking her role succeeds once and is refused when she holds
none. A role still assigned to someone cannot be deleted. Reading the course's
instructors, or the courses in which Maya is one, follows the same assignments.

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

a set of Assignments with
  a user    User
  a context Context
  a role    Role

Rule: a user has at most one assignment in a context.
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

deleteRole(role: Role) : return (role: Role)
  where role in roles and no assignment has role
  then
    delete that role
    return role
  where role not in roles
  then
    refuse ROLE_NOT_FOUND "No such role exists."
  where some assignment has role
  then
    refuse ROLE_IN_USE "The role is still assigned to a user."

assign(user: User, context: Context, role: Role) : return (assignment: Assignment)
  where role in roles and no assignment has user and context
  then
    add a new assignment with user, context, and role
    return assignment
  where role in roles and some assignment has user and context
  then
    replace that assignment's role with role
    return assignment
  where role not in roles
  then
    refuse ROLE_NOT_FOUND "No such role exists."

revoke(user: User, context: Context) : return (assignment: Assignment)
  where some assignment has user and context
  then
    delete that assignment
    return assignment
  where no assignment has user and context
  then
    refuse ASSIGNMENT_NOT_FOUND "The user holds no role in this context."

requireCapability(user: User, context: Context, capability: String) : return (allowed: Boolean)
  where the user's role in the context includes capability
  then
    return allowed
  where the user holds no role in the context that includes capability
  then
    refuse FORBIDDEN "The user does not hold the required capability in this context."
```

## Queries

```queries
_hasCapability (user: String, context: String, capability: String) : one (allowed: Boolean)
  answers whether the Role assigned to the User in the Context contains the capability

_hasCapabilityHolder (context: String, capability: String) : one (present: Boolean)
  answers whether any User in the Context holds a Role containing the capability

_isSoleCapabilityHolder (user: String, context: String, capability: String) : one (sole: Boolean)
  answers whether the User is the only holder of the capability in the Context
  answers false when the User does not hold it at all

_holdsRoleNamed (user: String, context: String, name: String) : one (held: Boolean)
  answers whether the User holds the named Role in the Context

_getRole (user: String, context: String) : optional (role: String)
  answers the User's role in the Context
  answers no row when the User holds none

_getContextsOfRoleNamed (user: String, name: String) : many (context: String)
  answers every context in which the User holds the named Role, in assignment order
  answers no rows when none match

_getHoldersOfRoleNamed (context: String, name: String) : many (user: String)
  answers every User holding the named Role in the Context, in assignment order
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

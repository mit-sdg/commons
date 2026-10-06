# Connecting

## Purpose

Let a person allow an outside app to learn who they are, remember that they
did, and withdraw it later.

Prevents: a person asked the same question every time an app they already
allowed signs them in; an allowance that cannot be found again to take back.

## Principle

Ines opens her team's project app, which asks to learn who she is. She
_approves_ it, and Connecting remembers the connection. The next time the app
asks, her approval is already there: approving again answers the same
connection and its first approval time. Later she approves a second app, and
her connections list it above the first. Paul's approvals are his own and never
appear among hers. When Ines _withdraws_ the first app's connection it leaves
her list, and withdrawing it a second time is refused because it no longer
exists. If she approves that app again, it is a new connection.

## Types

```types
external User
  An application-owned identity used in the user role.
```

## State

```state
a set of Connections with
  a user       User
  an app       String
  an approvedAt Date

Rule: a user holds at most one connection to a given app.
Rule: approving an app the user has already approved changes nothing and answers the standing connection, which keeps its first approval time.
Rule: withdrawing removes the connection, so approving the same app afterwards makes a new connection.
Rule: an app is opaque text. Connecting does not interpret it, decide which apps may be approved, or say what an approved app may learn.
```

## Actions

```actions
approve (user: User, app: String, at: Date) : return (connection: Connection)
  where no connection has user and app
  then
    add a new connection with user, app, and approvedAt at
    return connection
  where some connection has user and app
  then
    leave that connection and its approvedAt unchanged
    return connection

withdraw (connection: Connection) : return (connection: Connection)
  where connection in connections
  then
    delete connection
    return connection
  where connection not in connections
  then
    refuse CONNECTION_NOT_FOUND "There is no such connection."
```

## Queries

```queries
_getConnection (connection: String) : optional (user: String, app: String, approvedAt: Date)
  answers the user, app, and first approval time of the connection
  answers no row for an unknown or withdrawn connection

_getApproval (user: String, app: String) : optional (connection: String, approvedAt: Date)
  answers the user's connection to the app
  answers no row when the user has not approved the app, or has withdrawn it

_getConnections (user: String) : many (connection: String, app: String, approvedAt: Date)
  answers the user's connections, the most recent approval first, and in app order among approvals made at the same instant
  answers no rows when the user holds no connection
```

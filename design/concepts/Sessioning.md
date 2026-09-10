# Sessioning

## Purpose

Give a user a session that identifies them until it ends or expires.

## Principle

Maya starts a session with a 72-hour idle deadline and a fixed cap four calendar
months later. Refreshing it while live extends the idle deadline, never beyond
the cap. Reads do not refresh it. Ending it removes the session; ending it again
is refused.

## Types

```types
external User
  An application-owned identity used in the user role.

```

## State

```state
a set of Sessions with
  a user User
  an expiresAt Date
  an optional absoluteExpiresAt Date

Rule: the cap preserves UTC time of day and clamps to the last day of the target month.
Rule: legacy sessions without a cap retain their fixed expiry and cannot refresh.
Rule: endAllForUser removes every session for the user and succeeds when none remain.
```

## Actions

```actions
start(user: User, at?: Date) : return (session: Session, expiresAt: Date, absoluteExpiresAt: Date)
  where true
  then
    add a new session with user, expiresAt 72 hours after at, and absoluteExpiresAt four calendar months after at
    return session, expiresAt, absoluteExpiresAt

refresh(session: Session) : return (session: Session, refreshed: Boolean)
  where session exists and the server clock at execution is before both deadlines
  then
    atomically extend expiresAt to the greater of its current value and the earlier of 72 hours from now or absoluteExpiresAt
    set refreshed to true
    return session, refreshed
  where session is unknown, expired, or legacy without absoluteExpiresAt
  then
    leave state unchanged
    set refreshed to false
    return session, refreshed

end(session: Session) : return (session: Session)
  where session in sessions
  then
    delete session
    return session
  where session not in sessions
  then
    refuse SESSION_NOT_FOUND "There is no such session."
endAllForUser(user: User) : return (user: User)
  where true
  then
    delete every session standing for user
    return user
```

## Queries

```queries
_getUser (session: String, at?: Date) : optional (user: String)
  answers the Session's User only while at is before its expiry
  answers no row for an unknown or expired Session

_isExpired (session: String, at: Date) : one (expired: Boolean)
  answers true when the retained Session has reached or passed its expiry
  answers false for an unknown or unexpired Session
```

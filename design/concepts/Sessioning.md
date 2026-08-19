# Sessioning

## Purpose

Give a user a session that identifies them until it ends or expires.

## Principle

Maya starts a session that expires one day later. Before expiry, it identifies
her. Ending it removes the session. Ending the same session again is refused.

## Types

```types
external User
  An application-owned identity used in the user role.

external Moment
  An application-owned identity used in the moment role.
```

## State

```state
a set of Sessions with
  a user User
  an expiresAt Moment

Rule: endAllForUser removes every session for the user and succeeds when none remain.
```

## Actions

```actions
start(user: User, at?: Moment) : return (session: Session, expiresAt: Moment)
  where true
  then
    add a new session with user and expiresAt one day after at
    return session, expiresAt

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

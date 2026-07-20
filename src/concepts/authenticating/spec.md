# Authenticating

## Purpose

Let a person create an account with a username and password, then use those
credentials to identify themselves later.

## Principle

Nadia registers with the username nadia, a password, and her email address. A
user now exists for her. Later she authenticates with that username and
password and is recognized as the same user.

When Omar tries to register the username nadia, it is refused as taken. When
he tries to authenticate with a guessed password, he is turned away without
learning whether the username or the password was wrong.

## State

```state
a set of Users with
  a username String
  a passwordVerifier String
  an email   String
```

Registration checks its inputs with these computations:

```computation
(email: String) looks like an address : Bool
(username: String) is within name length : Bool
(username: String) is well-formed : Bool
(password: String) is within password length : Bool
(password: String) matches (passwordVerifier: String) : Bool
```

A username is within name length when it is 3 to 32 characters long; it is well-formed when it starts with a letter and contains only letters, digits, hyphens, and underscores. A password is within password length when it is 8 to 128 characters long. Authenticating derives each verifier with scrypt using N=16384, r=8, p=1, and maxmem 32 MiB, a random 16-byte salt, and a 32-byte derived key. A password matches when the same derivation and a constant-time key comparison succeed. An email looks like an address when it contains an @. The password itself is never retained.

## Actions

```actions
register (username: String, password: String, email: String) : return (user: User), refuse (message: String)
  where email looks like an address, username is within name length, username is well-formed,
        password is within password length, and no user has username username
  then
    add a new user with username, a passwordVerifier derived from password, and email
    return user
  where email does not look like an address
  then
    refuse "The email address is not well formed."
  where username is not within name length
  then
    refuse "The username must be 3 to 32 characters long."
  where username is not well-formed
  then
    refuse "The username must start with a letter and contain only letters, digits, hyphens, and underscores."
  where password is not within password length
  then
    refuse "The password must be 8 to 128 characters long."
  where some user has username username
  then
    refuse "That username is already taken."

authenticate (username: String, password: String) : return (user: User), refuse (message: String)
  where some user has username username and password matches its passwordVerifier
  then
    return that user
  where no user has username username whose passwordVerifier matches password
  then
    refuse "Unknown username or wrong password."

changePassword (user: User, oldPassword: String, newPassword: String) : return (user: User), refuse (message: String)
  where the user exists and oldPassword matches its passwordVerifier, and newPassword is within password length
  then
    set the user's passwordVerifier to one derived from newPassword
    return user
  where the user does not exist or oldPassword does not match its passwordVerifier
  then
    refuse "The current password is wrong."
  where newPassword is not within password length
  then
    refuse "The password must be 8 to 128 characters long."
```

Changing a password requires the current password. A failed check does not say
whether the account or password was wrong. The new password follows the same
length rule as registration.

## Questions

`_getById (user)` and `_getByUsername (username)` each answer at most one row.
`_getUserCount ()` answers exactly one row with the number of users.

```questions
_search (query: String) : many { user: User, username: String }
  every user whose username starts with query, ignoring case; alphabetical by
  username, at most ten.

_resolveIdentity (ref: String) : one { user: User or nothing, username: String or nothing }
  the existing user denoted by ref and that user's registered username: an
  existing user identifier first, then an exact username, then the sole
  case-blind username match. If no user matches, or several usernames match
  only by case, both answers are nothing.

_denotedUser (ref: String) : zero-or-one { user: User }
  the existing user denoted by an identifier or exact username. If neither
  matches, the reference itself is returned as the user.
```

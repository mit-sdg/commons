# Authenticating

## Purpose

Let a person create an account with a username, a password, and an email address
that no other account holds, then use those credentials to identify themselves
later and be found again by that address.

## Principle

Nadia registers with the username nadia, a password, and the email address
`Nadia@Example.com` typed with a stray space on each side. A user now exists for
her, holding the address `nadia@example.com`. Later she authenticates with that
username and password and is recognized as the same user, and looking the address
up in any spelling answers her account.

When Omar tries to register the username nadia, it is refused as taken. When he
registers the username omar with the address `NADIA@example.com`, that is refused
too, because the address is already Nadia's. When he tries to authenticate with a
guessed password, he is turned away without learning whether the username or the
password was wrong.

## Types

```types

```

## State

```state
a set of Users with
  a username String
  a passwordVerifier String
  an email   String

Rule: registration checks its inputs with these computations: a username is within name length when it is 3 to 32 characters long, it is well-formed when it starts with a letter and contains only letters, digits, hyphens, and underscores, and a password is within password length when it is 8 to 128 characters long.
Rule: Authenticating derives each verifier with scrypt using N=16384, r=8, p=1, and maxmem 32 MiB, a random 16-byte salt, and a 32-byte derived key; a password matches when the same derivation and a constant-time key comparison succeed.
Rule: an email is trimmed and lower-cased before it is stored on a user or matched against one, so addresses differing only in surrounding space or letter case name the same account.
Rule: an email looks like an address when it contains exactly one @, and the password itself is never retained.
Rule: an address identifies at most one user.
Rule: registration reports a malformed input before a conflict, and a taken username before a taken address, because a username can simply be chosen again while a taken address means the person already has an account.
Rule: changing a password requires the current password, a failed check does not say whether the account or password was wrong, and the new password follows the same length rule as registration.
```

## Actions

```actions
register(username: String, password: String, email: String) : return (user: User)
  where email looks like an address, username is within name length, username is well-formed, password is within password length, no user has username username, and no user holds the normalized email
  then
    add a new user with username, a passwordVerifier derived from password, and the normalized email
    return user
  where email does not look like an address
  then
    refuse INVALID_BODY "The email address is not well formed."
  where username is not within name length
  then
    refuse USERNAME_INVALID_LENGTH "The username must be 3 to 32 characters long."
  where username is not well-formed
  then
    refuse USERNAME_INVALID_CHARS "The username must start with a letter and contain only letters, digits, hyphens, and underscores."
  where password is not within password length
  then
    refuse PASSWORD_INVALID_LENGTH "The password must be 8 to 128 characters long."
  where some user has username username
  then
    refuse USERNAME_TAKEN "That username is already taken."
  where some user holds the normalized email
  then
    refuse EMAIL_TAKEN "That email address already has an account."

authenticate(username: String, password: String) : return (user: User)
  where some user has username username and password matches its passwordVerifier
  then
    return user
  where no user has username username whose passwordVerifier matches password
  then
    refuse INVALID_CREDENTIALS "Unknown username or wrong password."

changePassword(user: User, oldPassword: String, newPassword: String) : return (user: User)
  where the user exists and oldPassword matches its passwordVerifier, and newPassword is within password length
  then
    set the user's passwordVerifier to one derived from newPassword
    return user
  where the user does not exist or oldPassword does not match its passwordVerifier
  then
    refuse INVALID_CREDENTIALS "The current password is wrong."
  where newPassword is not within password length
  then
    refuse PASSWORD_INVALID_LENGTH "The password must be 8 to 128 characters long."
```

## Queries

```queries
_getById (user: String) : optional (username: String, email: String)
  answers the username and email of the User
  answers no row when the User does not exist

_getByEmail (email: String) : optional (user: String)
  answers the User holding the address, compared after trimming and lower-casing both sides
  answers no row when no User holds it

_getByUsername (username: String) : optional (user: String)
  answers the User with the exact username
  answers no row when no User matches

_getUserCount () : one (count: Number)
  answers the number of Users

_getUsers () : many (user: String, username: String, email: String)
  answers all registered Users with their usernames and email addresses
  orders rows alphabetically by username
  answers no rows when none match

_search (query: String) : many (user: String, username: String)
  answers Users whose usernames start with query, ignoring case
  orders rows alphabetically by username and returns at most ten
  answers no rows when none match

_resolveIdentity (ref: String) : one (user: String|Null, username: String|Null)
  answers the User denoted by an existing identifier, then an exact username, then a sole case-blind username match
  answers both fields as null when no User matches or several usernames match only by case

_denotedUser (ref: String) : one (user: String)
  answers the existing User denoted by an identifier or exact username
  answers ref itself as the User when neither matches
```

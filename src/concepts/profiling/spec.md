# Profiling

## Purpose

Keep a display name, bio, avatar, and contact email for each user, so the user
can be presented by profile details rather than only an identifier.

## Principle

Priya's profile is created with her display name and email; her bio and avatar
start empty. A second profile for Priya is refused. She later changes her bio
and avatar. Updating a profile that was never created is refused.

A field never set reads as the empty string.

## State

Each user has at most one profile.

```state
a set of Profiles with
  a user        User
  a displayName String
  a bio         String
  an avatar     String
  an email      String
```

## Actions

```actions
createProfile (user: User, displayName: String, email: String) : return (user: User), refuse (message: String)
  where no profile has user user
  then
    add a new profile with user, displayName, and email, and with an empty bio and avatar
    return user
  where some profile has user user
  then
    refuse "This user already has a profile."

setDisplayName (user: User, displayName: String) : return (user: User), refuse (message: String)
  where some profile has user user
  then
    set that profile's displayName to displayName
    return user
  where no profile has user user
  then
    refuse "There is no profile for this user."

setBio (user: User, bio: String) : return (user: User), refuse (message: String)
  where some profile has user user
  then
    set that profile's bio to bio
    return user
  where no profile has user user
  then
    refuse "There is no profile for this user."

setAvatar (user: User, avatar: String) : return (user: User), refuse (message: String)
  where some profile has user user
  then
    set that profile's avatar to avatar
    return user
  where no profile has user user
  then
    refuse "There is no profile for this user."
```

## Questions

```questions
_getProfile (user: User) : zero-or-one { profile: { displayName, bio, avatar, email } }
  the user's complete profile nested under a `profile` key.

_getProfileFields (user: User) : zero-or-one { displayName, bio, avatar, email }
  the same fields as a flat row.
```

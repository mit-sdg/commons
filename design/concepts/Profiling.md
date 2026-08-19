# Profiling

## Purpose

Keep a display name, bio, avatar, and contact email for each user, so the user
can be presented by profile details rather than only an identifier.

## Principle

Priya's profile is created with her display name and email; her bio and avatar
start empty. A second profile for Priya is refused. She later changes her bio
and avatar. Updating a profile that was never created is refused.

A field never set reads as the empty string.

## Types

```types
external User
  An application-owned identity used in the user role.
```

## State

```state
a set of Profiles with
  a user        User
  a displayName String
  a bio         String
  an avatar     String
  an email      String

Rule: each user has at most one profile.
```

## Actions

```actions
createProfile(user: User, displayName: String, email: String) : return (user: User)
  where no profile has user user
  then
    add a new profile with user, displayName, and email, and with an empty bio and avatar
    return user
  where some profile has user user
  then
    refuse PROFILE_ALREADY_EXISTS "This user already has a profile."

setDisplayName(user: User, displayName: String) : return (user: User)
  where some profile has user user
  then
    set that profile's displayName to displayName
    return user
  where no profile has user user
  then
    refuse PROFILE_NOT_FOUND "There is no profile for this user."

setBio(user: User, bio: String) : return (user: User)
  where some profile has user user
  then
    set that profile's bio to bio
    return user
  where no profile has user user
  then
    refuse PROFILE_NOT_FOUND "There is no profile for this user."

setAvatar(user: User, avatar: String) : return (user: User)
  where some profile has user user
  then
    set that profile's avatar to avatar
    return user
  where no profile has user user
  then
    refuse PROFILE_NOT_FOUND "There is no profile for this user."
```

## Queries

```queries
_getProfile (user: String) : optional (profile: Profile)
  answers the User's complete Profile nested under profile
  answers no row when the User has no Profile

_getProfileFields (user: String) : optional (displayName: String, bio: String, avatar: String, email: String)
  answers the User's display name, bio, avatar, and email
  answers no row when the User has no Profile

_getProfilesOf (users: Strings) : many (user: String, displayName: String, bio: String, avatar: String)
  answers the public face of each named User that has a Profile, in the order the names are given
  answers no rows when none match
```

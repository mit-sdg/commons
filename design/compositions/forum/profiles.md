# Profiles and public identity

[Forum.profiles.GetProfile](reaction:Forum.profiles.GetProfile) resolves the caller from the session before
choosing fields. An active course member sees their own private profile;
roster managers can see another user's private fields; other active members see
only display name, bio, and avatar. Missing profiles, callers outside the course,
and unauthorized cross-user reads are hidden as `NOT_FOUND`.

A logged-in account changes only its own display name through
[Forum.profiles.SetDisplayName](reaction:Forum.profiles.SetDisplayName). [Forum.profiles.SetBio](reaction:Forum.profiles.SetBio) changes only the calling account's public biography.
[Forum.profiles.SetAvatar](reaction:Forum.profiles.SetAvatar) changes only the calling account's public avatar. These
operations do not accept a target account and cannot change the email saved when
the profile was created.

[Forum.profiles.SearchUsers](reaction:Forum.profiles.SearchUsers) accepts username-prefix searches only from active
course members. It searches
account usernames by case-insensitive prefix, returns at most ten, and combines
each result with any current public profile face. [Forum.profiles.ResolvePublicUser](reaction:Forum.profiles.ResolvePublicUser)
needs no session and resolves an account identifier, exact username, or sole
case-insensitive username match; ambiguous or absent identities return both the
user and username as `null` rather than exposing candidates.

Profile, post, and thread presentation reads their owners' current state. A
missing optional profile face does not create a replacement identity or grant
access.

## Supporting declarations

Views [theProfileOf](view:Forum.profiles.theProfileOf) support the behavior and result shapes described above.

Formers [theUserPage](former:Forum.profiles.theUserPage), [theUserSearch](former:Forum.profiles.theUserSearch) support the behavior and result shapes described above.

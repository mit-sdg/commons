# Profiles and public identity

[Forum.profiles.GetProfile](reaction:Forum.profiles.GetProfile) resolves the caller from the session before
using [theProfileOf view](view:Forum.profiles.theProfileOf) to choose fields. An authenticated account sees its own existing private profile;
a caller holding `course:manage` can see another user's private fields; other
active members see only display name, bio, and avatar. Missing profiles, callers
outside the course, and unauthorized cross-user reads are hidden as `NOT_FOUND`.

Course membership here is an active seat, not a capability. The staff view of
another person's private fields turns on `course:manage`, but the reads gated on
membership — the member tier of a profile read, and the username search below —
answer only for an account that holds an active seat. Staff who have been given a
role but never enrolled, and the initial administrator registered through setup,
are therefore outside the course until a course manager enrols them; Roster
describes that route, which is now the only one.

A logged-in account changes only its own display name through
[Forum.profiles.SetDisplayName](reaction:Forum.profiles.SetDisplayName). [Forum.profiles.SetBio](reaction:Forum.profiles.SetBio) changes only the calling account's public biography.
[Forum.profiles.SetAvatar](reaction:Forum.profiles.SetAvatar) changes only the calling account's public avatar. These
operations do not accept a target account and cannot change the email saved when
the profile was created.

[Forum.profiles.SearchUsers](reaction:Forum.profiles.SearchUsers) accepts username-prefix searches only from active
course members. It forms [the user search](former:Forum.profiles.theUserSearch) from at most ten
case-insensitive username-prefix matches, combining each result with any current public profile face. [Forum.profiles.ResolvePublicUser](reaction:Forum.profiles.ResolvePublicUser)
needs no session and resolves an account identifier, exact username, or sole
case-insensitive username match; ambiguous or absent identities return both the
user and username as `null` rather than exposing candidates.

The [user-page former](former:Forum.profiles.theUserPage) combines current account, profile, post, and thread
state without copying it into another owner. A missing optional profile face
does not create a replacement identity or grant access.

```endpoints
Forum.profiles.GetProfile at /profiles/get
Forum.profiles.ResolvePublicUser at /users/resolve
Forum.profiles.SearchUsers at /users/search
Forum.profiles.SetAvatar at /profiles/setAvatar
Forum.profiles.SetBio at /profiles/setBio
Forum.profiles.SetDisplayName at /profiles/setDisplayName
```

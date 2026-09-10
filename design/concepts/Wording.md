# Wording

## Purpose

Let an operator replace the standing words an application uses in a named place,
and withdraw them so the application's own words come back.

Prevents: wording that only a redeployment can change; a heading kept beside a
passage from a different edit; a rejected edit destroying the wording already
standing.

## Principle

Rosa runs a lending library whose overdue notice has always gone out in the
words its builders wrote. She opens that notice, rewrites its heading and its
passage together, and saves them; every notice sent afterwards is worded her
way, while the notices already written keep the words they went out with. She
pastes a heading with a line break hidden in it, and the save is refused whole:
her previous wording still stands, and no place is left showing a new heading
beside an old passage. A year later she withdraws her wording and the builders'
words come back — because Wording keeps only what an operator put there, and
never the words a place falls back to.

## Types

```types
external Place
  An application-owned identity for where wording stands.
```

## State

```state
a set of Wordings with
  a place   Place
  a heading String
  a passage String

Rule: at most one wording stands in a place, and a heading and passage always enter and leave it together, so a place never shows a heading from one edit beside a passage from another.
Rule: retained text is trimmed, and its line endings are normalized to line feeds.
Rule: a heading is valid when trimming leaves it nonempty and at most 200 characters, and it holds no control character or line separator — a heading is one line.
Rule: a passage is valid when trimming leaves it nonempty and at most 20000 characters.
Rule: withdrawing a place where no wording stands succeeds and changes nothing, so an operator may always ask for the application's own words back.
Rule: Wording keeps words. It does not render them, interpret anything inside them, decide who may change them, or supply what a place reads as when no wording stands there.
```

## Actions

```actions
word (place: Place, heading: String, passage: String) : return (heading: String, passage: String)
  where heading and passage are valid
  then
    replace the wording standing in place with the trimmed heading and passage together
    return heading, passage
  where heading or passage is not valid
  then
    leave the wording standing in place unchanged
    refuse INVALID_WORDING "Use a one-line heading of up to 200 characters and a passage of up to 20000 characters."

withdraw (place: Place) : return (place: Place)
  where always
  then
    remove any wording standing in place
    return place
```

## Queries

```queries
_wordingIn (place: String) : optional (heading: String, passage: String)
  answers the heading and passage standing in the place, always together
  answers no row when no wording stands there
```

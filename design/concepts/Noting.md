# Noting

## Purpose

Let staff keep notes about a learner, choose whether to show each note to that
learner, and move notes through open, resolved, and archived states.

## Principle

Ms. Okafor writes a note about Ana's project work, shows it to Ana, and Ana
acknowledges it. A second note about a missed meeting remains staff-only and has
a follow-up date. After the meeting, Ms. Okafor revises, resolves, and archives
that note. Revising a resolved note is refused; restoring it makes it open
again. Hiding an acknowledged note does not erase Ana's acknowledgment.

## Types

```types
external Author
  An application-owned identity used in the author role.

external Learner
  An application-owned identity used in the learner role.
```

## State

```state
a set of Notes with
  an author     Author
  a learner     Learner
  a body        String
  a tags        Strings
  a createdAt   Date
  an optional updatedAt      Date
  an optional followUpAt     Date
  an optional acknowledgedAt Date

an Open      set of Notes
a Resolved   set of Notes
an Archived  set of Notes
a Disclosed  set of Notes
```

Every note has one working status: open, resolved, or archived. Disclosure is
independent of that status and says whether the learner may see the note.
`acknowledgedAt` records the learner's latest acknowledgment and is retained if
the note later becomes staff-only.

Whether a stated visibility is one of the two this concept knows is a calculation over the input alone:

A visibility names a visibility when it is "STAFF_ONLY" or "LEARNER_VISIBLE".

Acknowledgment checks disclosure and the learner, not working status. A learner
may therefore acknowledge a disclosed resolved or archived note. A later
acknowledgment replaces the earlier time. `followUpAt` may be absent, and an
empty tags list means the note has no tags.

Noting keeps notes and receipts. It does not decide who may call its actions or
queries.

## Actions

```actions
write(author: Author, learner: Learner, body: String, visibility: String, tags: Strings, followUpAt: Date, at: Date) : return (note: Note)
  where visibility names a visibility
  then
    add a new note with author, learner, body, tags, and followUpAt
    set note's createdAt to at
    add note to open
    add note to disclosed if visibility is "LEARNER_VISIBLE"
    return note
  where visibility does not name a visibility
  then
    refuse INVALID_VISIBILITY "Visibility must be staff-only or learner-visible."

revise(note: Note, body: String, visibility: String, tags: Strings, followUpAt: Date, at: Date) : return (note: Note)
  where note in open and visibility names a visibility
  then
    set note's body, tags, and followUpAt from the inputs
    set note's updatedAt to at
    add note to disclosed if visibility is "LEARNER_VISIBLE", remove it from disclosed otherwise
    return note
  where no note has this note
  then
    refuse NOTE_NOT_FOUND "There is no such note."
  where note not in open
  then
    refuse NOTE_NOT_OPEN "This note is no longer open."
  where visibility does not name a visibility
  then
    refuse INVALID_VISIBILITY "Visibility must be staff-only or learner-visible."

resolve(note: Note, at: Date) : return (note: Note)
  where note in open
  then
    remove note from open
    add note to resolved
    set note's updatedAt to at
    return note
  where no note has this note
  then
    refuse NOTE_NOT_FOUND "There is no such note."
  where note not in open
  then
    refuse NOTE_NOT_OPEN "This note is no longer open."

archive(note: Note, at: Date) : return (note: Note)
  where note in resolved
  then
    remove note from resolved
    add note to archived
    set note's updatedAt to at
    return note
  where no note has this note
  then
    refuse NOTE_NOT_FOUND "There is no such note."
  where note not in resolved
  then
    refuse NOTE_NOT_RESOLVED "Only a resolved note can be archived."

restore(note: Note, at: Date) : return (note: Note)
  where note in resolved or note in archived
  then
    remove note from resolved and from archived
    add note to open
    set note's updatedAt to at
    return note
  where no note has this note
  then
    refuse NOTE_NOT_FOUND "There is no such note."
  where note in open
  then
    refuse NOTE_NOT_RESTORABLE "This note cannot be restored."

acknowledge(note: Note, learner: Learner, at: Date) : return (note: Note)
  where note in disclosed and the learner of note is learner
  then
    set note's acknowledgedAt to at
    return note
  where no note has this note
  then
    refuse NOTE_NOT_FOUND "There is no such note."
  where note not in disclosed
  then
    refuse NOTE_NOT_LEARNER_VISIBLE "This note is not shown to its learner."
  where the learner of note is not learner
  then
    refuse NOTE_NOT_OWNER "Only the learner a note concerns may acknowledge it."
```

## Queries

```queries
_getNote (note: String) : optional (note: String, author: String, learner: String, body: String, visibility: String, status: String, createdAt: Date, updatedAt: Date|Null, followUpAt: Date|Null, acknowledgedAt: Date|Null, tags: Strings)
  answers the complete Note
  answers no row when the Note does not exist

_getActiveNotesFor (learner: String) : many (note: String, author: String, learner: String, body: String, visibility: String, status: String, createdAt: Date, updatedAt: Date|Null, followUpAt: Date|Null, acknowledgedAt: Date|Null, tags: Strings)
  answers open and resolved notes in creation order, regardless of disclosure
  answers no rows when none match

_getShownTo (learner: String) : many (note: String, author: String, learner: String, body: String, status: String, createdAt: Date, updatedAt: Date|Null, followUpAt: Date|Null, acknowledgedAt: Date|Null, tags: Strings)
  answers disclosed open and resolved notes in creation order
  answers no rows when none match

_getByAuthor (author: String) : many (note: String, learner: String, status: String, visibility: String, createdAt: Date)
  answers the author's notes in creation order
  answers no rows when none match

_getOpenFollowUpsBefore (before: Date) : many (note: String, author: String, learner: String, body: String, followUpAt: Date, createdAt: Date)
  answers open notes due for follow-up on or before the given moment, in creation order
  answers no rows when none match
```

# Publishing

## Purpose

Let an author release a reviewed version to its audience, whole or one part at a time, and close it when its moment has passed, so the audience always meets exactly what the author released, for as long as the author keeps it open.

Prevents: two runs of one thing live at once, so nobody knows which is real; two parts of one run open at once, so the audience is split between them; a part released into a run that has already ended.

## Principle

Professor Lee _publishes_ her reviewed quiz at the start of lecture; an open edition exists, fixed to that exact material. Students participate in it all hour while her later edits stay her own. Publishing the same material again while the edition stands open is refused, so there is never a question of which run is the live one. After lecture she _closes_ it; a late scanner finds it closed rather than quietly different. Closing it again is refused and tells her it is already closed.

Professor Lee publishes tonight's session, then _publishes_ its first question _within_ the session. While that part stands open, publishing the second question within the session is refused, since her audience would be answering two at once. She closes the first and publishes the second. Publishing the first again within the session is refused: it already had its moment there.

## Types

```types
external Author
  An application-owned identity used in the author role.

external Material
  An application-owned identity naming what an edition releases.
```

## State

```state
a set of Editions with
  an author   Author
  a material  Material
  an optional whole Edition
  an openedAt Date
  an optional closedAt Date

an Open   set of Editions
a Closed set of Editions

Rule: an edition published within another is a part, and the edition it was published within is its whole.
Rule: an edition's material and whole are fixed when it is published and never move afterward.
Rule: every edition is in exactly one of open or closed, and a closed edition is never forgotten.
Rule: at most one open edition exists for a material at a time.
Rule: a part is published only within an open whole.
Rule: a whole has at most one open part.
Rule: a material is published at most once within a whole.
Rule: Publishing does not produce the material it fixes, decide who may reach an edition, or record what an audience did inside one; whether a closed edition's results stay visible, how a later edition supersedes an earlier one, and whether a whole's open parts close with it are arranged outside the concept.
```

## Actions

```actions
publish (author: Author, material: Material, at: Date) : return (edition: Edition)
  where no open edition has material material
  then
    add a new edition with author, material, and openedAt at
    add edition to open
    return edition
  where an open edition has material material
  then
    refuse MATERIAL_ALREADY_SHARED "This is already running; close the open run first."

publishWithin (whole: Edition, author: Author, material: Material, at: Date) : return (edition: Edition)
  where whole in open, no part of whole has material material, no part of whole is open, and no open edition has material material
  then
    add a new edition with whole, author, material, and openedAt at
    add edition to open
    return edition
  where whole does not exist
  then
    refuse EDITION_NOT_FOUND "There is no such edition."
  where whole in closed
  then
    refuse WHOLE_CLOSED "What this belongs to is closed."
  where whole in open and a part of whole has material material
  then
    refuse PART_DONE "This was already released here."
  where whole in open, no part of whole has material material, and a part of whole is open
  then
    refuse PART_OPEN "Another part is open; close it first."
  where whole in open, no part of whole has material material, no part of whole is open, and an open edition has material material
  then
    refuse MATERIAL_ALREADY_SHARED "This is already running; close the open run first."

close (edition: Edition, at: Date) : return (edition: Edition)
  where edition in open
  then
    remove edition from open
    add edition to closed
    set edition's closedAt to at
    return edition
  where edition does not exist
  then
    refuse EDITION_NOT_FOUND "There is no such edition."
  where edition in closed
  then
    refuse ALREADY_CLOSED "This edition is already closed."
```

## Queries

```queries
_edition (edition: String) : optional (author: String, material: String, whole: String|Null, open: Boolean, openedAt: Date, closedAt: Date|Null)
  answers the complete Edition, with a null whole when it is not a part
  answers no row when the Edition does not exist

_parts (whole: String) : many (edition: String, material: String, open: Boolean, openedAt: Date, closedAt: Date|Null)
  answers the whole's parts, earliest published first
  answers no rows when the whole has none or does not exist

_openPart (whole: String) : optional (edition: String, material: String)
  answers the whole's open part
  answers no row when no part of the whole is open

_hasOpenEditionFor (material: String) : one (open: Boolean)
  answers whether any open edition releases the material
  answers false when none does

_editionsFor (material: String) : many (edition: String, open: Boolean, openedAt: Date, closedAt: Date|Null)
  answers the material's editions, newest first
  answers no rows when none match

_openEditions () : many (edition: String, author: String, material: String, openedAt: Date)
  answers every open edition, newest first
```

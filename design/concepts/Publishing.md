# Publishing

## Purpose

Let an author release a reviewed version to its audience and close it when its
moment has passed — so the audience always meets exactly what the author
released, for as long as the author keeps it open.

## Principle

Professor Lee publishes her reviewed quiz at the start of lecture; an open
edition exists, fixed to that exact material. Students participate in it all
hour while her later edits stay her own. Publishing the same material again
while the edition stands open is refused, so there is never a question of
which run is the live one. After lecture she closes it; a late scanner finds
it closed rather than quietly different. Closing it again is refused and tells
her it is already closed.

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
  an openedAt Date
  an optional closedAt Date

an Open   set of Editions
a Closed set of Editions

Rule: an edition's material is fixed when it is published and never moves afterward.
Rule: every edition is in exactly one of open or closed, and a closed edition is never forgotten.
Rule: at most one open edition exists for a material at a time.
Rule: Publishing does not produce the material it fixes, decide who may reach an edition, or record what an audience did inside one; whether a closed edition's results stay visible, and how a later edition supersedes an earlier one, are arranged outside the concept.
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
_edition (edition: String) : optional (author: String, material: String, open: Boolean, openedAt: Date, closedAt: Date|Null)
  answers the complete Edition
  answers no row when the Edition does not exist

_hasOpenEditionFor (material: String) : one (open: Boolean)
  answers whether any open edition releases the material
  answers false when none does

_editionsFor (material: String) : many (edition: String, open: Boolean, openedAt: Date, closedAt: Date|Null)
  answers the material's editions, newest first
  answers no rows when none match

_openEditions () : many (edition: String, author: String, material: String, openedAt: Date)
  answers every open edition, newest first
```

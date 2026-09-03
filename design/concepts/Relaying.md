# Relaying

## Purpose

Establish the **handing on** between the legs of a planned **series**: a later leg takes what an earlier leg produced, so the series builds on what its participants make rather than on what its planner guessed in advance.

Prevents: a leg drawing on a leg that comes after it; the order of legs changed so that a leg comes before what it draws on; a leg removed while another still draws on it.

## Principle

Dana _plans_ a relay of three legs and _adds_ each: name it, vote on three of the names, explain your vote. She makes the second leg _draw_ its choices from the first leg's piles, and the third draw its prompt from whichever choice wins. She tries to _move_ the third leg above the second and is refused, because it would come before what it draws on. She tries to make the first leg draw on the third and is refused for the same reason. She thinks better of the vote's shape and _undraws_ it, then draws it again with the shape she wants. When she tries to _remove_ the first leg she is refused, because the second still draws on it. In class each leg opens when she says so; what the second leg carries from the first is decided at that moment, not when she planned it. Next term she _retitles_ the relay and runs it on a different concept without touching a draw.

## Types

```types
external Author
  An application-owned identity used in the author role.

external Material
  An application-owned identity for what a leg puts before its participants.
```

## State

```state
a set of Relays with
  an author    Author
  a title      String
  a createdAt  Date

a set of Legs with
  a relay     Relay
  a material  Material
  a position  Number

a set of Draws with
  a leg     Leg
  a source  Leg
  a shape   String

Rule: a title is trimmed first and is valid when it is nonblank and no longer than 200 characters.
Rule: legs belong to their relay and stand in position order, contiguous from one; adding appends at the end, and removing closes the ranks behind what was removed.
Rule: a draw's source stands earlier in the same relay than its leg, so a draw never points forward.
Rule: at most one draw joins a leg to a source; drawing again on the same source sets the shape.
Rule: a shape is a nonblank string; what a shape means — what the source produced and how much of it is carried — is the surrounding design's to say.
Rule: moving a leg is refused when the order it would make has any draw pointing forward.
Rule: a leg is removed only while nothing draws on it; its own draws go with it.
Rule: Relaying does not know what a material is, open a leg to anyone, or carry anything from one leg to the next; those are arranged outside the concept.
```

## Actions

```actions
plan (author: Author, title: String, at: Date) : return (relay: Relay)
  where title is valid
  then
    add a new relay with author, normalized title, and createdAt at
    return relay
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be 1 to 200 characters long."

retitle (relay: Relay, title: String) : return (relay: Relay)
  where relay exists and title is valid
  then
    set relay's title to normalized title
    return relay
  where relay does not exist
  then
    refuse RELAY_NOT_FOUND "There is no such relay."
  where title is not valid
  then
    refuse INVALID_TITLE "The title must be 1 to 200 characters long."

addLeg (relay: Relay, material: Material) : return (leg: Leg, position: Number)
  where relay exists
  then
    add a new leg with relay, material, and the position after the relay's last leg
    return leg, position
  where relay does not exist
  then
    refuse RELAY_NOT_FOUND "There is no such relay."

removeLeg (leg: Leg) : return (leg: Leg, relay: Relay, material: Material)
  where leg exists and no draw has source leg
  then
    delete leg and every draw whose leg is leg, remembering its relay and material
    close the ranks of the relay's remaining legs
    return leg, relay, material
  where leg does not exist
  then
    refuse LEG_NOT_FOUND "There is no such leg."
  where some draw has source leg
  then
    refuse LEG_DRAWN_ON "Another leg still draws on this one."

moveLeg (leg: Leg, position: Number) : return (leg: Leg, position: Number)
  where leg exists, position is between one and the relay's leg count, and the order it makes has no draw pointing forward
  then
    place leg at position, shifting the legs between its old and new places by one
    return leg, position
  where leg does not exist
  then
    refuse LEG_NOT_FOUND "There is no such leg."
  where position is below one or past the relay's leg count
  then
    refuse NO_SUCH_POSITION "There is no such place in this relay."
  where the order it makes has a draw pointing forward
  then
    refuse FORWARD_DRAW "A leg cannot come before what it draws on."

draw (leg: Leg, source: Leg, shape: String) : return (draw: Draw)
  where leg and source exist, share a relay, source stands earlier than leg, and shape is nonblank
  then
    set the draw of leg on source to shape, adding one when none stands
    return draw
  where leg does not exist or source does not exist
  then
    refuse LEG_NOT_FOUND "There is no such leg."
  where leg and source do not share a relay
  then
    refuse NOT_SIBLINGS "These legs do not share a relay."
  where source stands at or after leg
  then
    refuse FORWARD_DRAW "A leg cannot come before what it draws on."
  where shape is blank
  then
    refuse INVALID_SHAPE "A draw needs a shape."

undraw (leg: Leg, source: Leg) : return (leg: Leg)
  where a draw joins leg to source
  then
    delete that draw
    return leg
  where no draw joins leg to source
  then
    refuse NO_DRAW "This leg does not draw on that one."
```

## Queries

```queries
_relay (relay: String) : optional (author: String, title: String, createdAt: Date)
  answers the complete Relay
  answers no row when the Relay does not exist

_relays () : many (relay: String, author: String, title: String, createdAt: Date)
  answers every relay, newest first

_legs (relay: String) : many (leg: String, material: String, position: Number)
  answers the relay's legs in position order
  answers no rows when none match

_leg (leg: String) : optional (relay: String, material: String, position: Number)
  answers the complete Leg
  answers no row when the Leg does not exist

_legFor (material: String) : optional (leg: String, relay: String, position: Number)
  answers the leg whose material this is
  answers no row when no leg has the material

_draws (leg: String) : many (draw: String, source: String, shape: String)
  answers the leg's draws in the order they were made
  answers no rows when none match

_drawsOn (source: String) : many (draw: String, leg: String, shape: String)
  answers every draw whose source is the leg, in the order they were made
  answers no rows when none match

_plan (relay: String) : optional (legs: Seq)
  answers the relay's legs back as one value: an ordered sequence of
  `{ leg, material, position, draws }` entries in position order, each draws
  entry `{ source, shape }` in the order the draws were made
  answers one row with an empty sequence when the relay has no legs
  answers no row when the Relay does not exist
```

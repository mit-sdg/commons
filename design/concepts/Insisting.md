# Insisting

## Purpose

Let someone stand on a request that came back unusable — saying what was wrong
rather than accepting it, and stopping honestly once patience runs out — so a
bad answer is neither taken nor chased forever.

## Principle

Noor asks for a figure in a fixed format and receives one in the wrong format,
so she stands on the request: she sends back exactly what she got with an
account of what was wrong. The second attempt is right, so her insistence is
satisfied and the matter closes. Had she given herself two complaints and used
both, the insistence would be exhausted — she would stop, with both attempts
and both accounts on record, rather than asking a third time or accepting the
wrong format; a further complaint is refused because every complaint she gave
herself is spent.

## Types

```types
external Aim
  An application-owned identity for what is being insisted on.
```

## State

```state
a set of Insistences with
  an aim      Aim
  a patience Number

a set of Complaints with
  an insistence Insistence
  an offering   String
  an account    String

a Settled   set of Insistences
a Satisfied set of Insistences
an Exhausted set of Insistences

Rule: at most one unsettled insistence exists per aim, which is what makes addressing by aim unambiguous.
Rule: patience counts complaints, so an aim is attempted at most patience times; the exhausting transition belongs to complain, and boundedness is guard-held.
Rule: remaining is the patience less the complaints recorded, computed at reading rather than stored.
Rule: insisting begins with the first complaint — there is nothing to stand on until something came back wrong — and a later complaint about the same aim joins the insistence already open, carrying its patience without changing it.
Rule: _standingFor and _spentFor are the two halves of the bound as standing questions — exactly one of them answers for an aim being insisted on, so a complainer asks whichever it needs and never compares numbers itself.
Rule: Insisting does not perform the next attempt, form what carries a complaint, or decide what counts as unusable; those belong to whoever is insisting.
```

## Actions

```actions
complain (aim: Aim, patience: Number, offering: String, account: String) : return (complaint: Complaint, insistence: Insistence, remaining: Number)
  where patience is at least one and no unsettled insistence has aim aim
  then
    add a new insistence with aim and patience
    add a new complaint with that insistence, offering, and account
    return complaint, insistence, remaining
  where an unsettled insistence for aim has complaints left
  then
    add a new complaint with that insistence, offering, and account
    return complaint, insistence, remaining
  where patience is less than one
  then
    refuse NO_PATIENCE "Insisting takes at least one complaint."
  where the unsettled insistence for aim has had its patience in complaints
  then
    refuse PATIENCE_SPENT "This aim has had every complaint it was given."

giveUp (aim: Aim) : return (insistence: Insistence)
  where an unsettled insistence has aim aim
  then
    add that insistence to settled
    add that insistence to exhausted
    return insistence
  where no unsettled insistence has aim aim
  then
    refuse NOT_INSISTING "Nothing is being insisted on for this aim."

satisfy (aim: Aim) : return (insistence: Insistence)
  where an unsettled insistence has aim aim
  then
    add that insistence to settled
    add that insistence to satisfied
    return insistence
  where no unsettled insistence has aim aim
  then
    refuse NOT_INSISTING "Nothing is being insisted on for this aim."
```

## Queries

```queries
_unsettledFor (aim: String) : optional (insistence: String, patience: Number, remaining: Number)
  answers the aim's one unsettled insistence
  answers no row when none is open

_standingFor (aim: String) : optional (insistence: String, remaining: Number)
  answers the aim's unsettled insistence while complaints remain under the patience
  answers no row otherwise

_spentFor (aim: String) : optional (insistence: String, complaints: Number)
  answers the aim's unsettled insistence once its patience is spent
  answers no row otherwise

_for (aim: String) : many (insistence: String, patience: Number, settled: Boolean, satisfied: Boolean, exhausted: Boolean, remaining: Number)
  answers every insistence for the aim in opening order
  answers no rows when none match

_complaints (insistence: String) : many (complaint: String, offering: String, account: String)
  answers the insistence's complaints in the order they were made
  answers no rows when none match
```

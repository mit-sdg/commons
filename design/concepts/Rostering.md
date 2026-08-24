# Rostering

## Purpose

Keep one class configuration, revisable after it is made, together with its
sections and the pending, active, or dropped seats held by its members, each seat
removable outright.

## Principle

The class is configured once; a second configuration is refused. An import
creates pending seats for Ana and Ben and skips a later row repeating Ana's
address, and a row reading `Ana@Example.com` repeats it too, because every
address is trimmed and lower-cased before it is stored or matched. Ana claims her
seat and becomes active. Ben cannot claim another seat while he already holds an
active one. Ana's seat may be dropped, reinstated, or moved to another section.
Once dropped, Ana's seat is reinstated rather than enrolled again: enrolling her
address once more is refused, because the seat still exists. Removing that seat
is what changes the answer — it is deleted outright, so her address identifies no
seat and enrolling or importing it again creates a fresh one. The class is
revised later to correct its title and timezone; revising a class that was never
configured is refused.

## Types

```types
external User
  An application-owned identity used in the user role.
```

## State

```state
an element of Class with
  a code     String
  a title    String
  a term     String
  a timezone String
  a status   String

a set of Sections with
  a name           String
  a location       String
  a meetingPattern String
  a status         String

a set of Seats with
  an email             String
  a kind               String
  an optional section  Section
  an optional holder   User

a Pending set of Seats
an Active set of Seats
a Dropped set of Seats

Rule: the class is absent until it is configured, and it is configured at most once.
Rule: an import row carries an email, a kind, and optionally a section.
Rule: an address is trimmed and lower-cased before it is stored on a seat or matched against one, so addresses differing only in surrounding space or letter case name the same seat.
Rule: an address identifies at most one seat.
Rule: removing a seat deletes it, so the address it carried identifies no seat afterwards and is free for a later import or enrolment.
```

## Actions

```actions
configureClass(code: String, title: String, term: String, timezone: String) : return (class: Class)
  where no class is configured
  then
    add a new class with code, title, term, and timezone
    return class
  where a class is already configured
  then
    refuse CLASS_ALREADY_CONFIGURED "The class has already been configured."

updateClass(code: String, title: String, term: String, timezone: String) : return (class: Class)
  where a class is configured
  then
    set the class's code, title, term, and timezone
    return class
  where no class is configured
  then
    refuse CLASS_NOT_CONFIGURED "The class has not been configured."

createSection(name: String, location: String, meetingPattern: String) : return (section: Section)
  where true
  then
    add a new section with name, location, and meetingPattern
    return section

updateSection(section: Section, name: String, location: String, meetingPattern: String) : return (section: Section)
  where section in sections
  then
    set section's name, location, and meetingPattern
    return section
  where section not in sections
  then
    refuse SECTION_NOT_FOUND "No such section exists."
previewImport(csv: String) : return (rows: Rows)
  where true
  then
    read the first newline-delimited line as comma-delimited headers
    read each later newline-delimited line as comma-delimited values, without quoting or escaping
    return rows

importSeats(rows: Rows) : return (created: Seats, skipped: Strings)
  where true
  then
    for each row whose email no seat already carries:
      add a new seat with the row's email, kind, and section, and no holder
      add the seat to pending
    return created, skipped

enrol(email: String, kind: String, section: Section, user: User) : return (seat: Seat, kind: String, user: User, section: Section)
  where a seat not in pending carries email
  then
    refuse SEAT_ALREADY_EXISTS "A seat already exists for this address."
  where no seat outside pending carries email and user holds a seat in active
  then
    refuse SEAT_ALREADY_ACTIVE "This user already holds an active seat."
  where a seat in pending carries email and user holds no seat in active
  then
    set that seat's holder to user
    remove it from pending, add it to active
    take that seat's own kind as kind and its own section as section, leaving the supplied kind and section unused
    return seat, kind, user, section
  where no seat carries email and user holds no seat in active
  then
    add a new seat with email, kind, and section, held by user
    add the seat to active
    return seat, kind, user, section

claimSeat(seat: Seat, user: User) : return (seat: Seat, kind: String, user: User, section: Section)
  where seat in pending and user holds no seat in active
  then
    set seat's holder to user
    remove seat from pending, add seat to active
    return seat, kind, user, section
  where seat not in seats
  then
    refuse SEAT_NOT_FOUND "No such seat exists."
  where seat not in pending
  then
    refuse SEAT_NOT_PENDING "This seat is not open to claim."
  where user holds a seat in active
  then
    refuse SEAT_ALREADY_ACTIVE "This user already holds an active seat."
dropSeat(seat: Seat) : return (seat: Seat, kind: String, user: User)
  where seat in active
  then
    remove seat from active, add seat to dropped
    return seat, kind, user
  where seat not in seats
  then
    refuse SEAT_NOT_FOUND "No such seat exists."
  where seat not in active
  then
    refuse SEAT_NOT_ACTIVE "This seat is not active."
reinstateSeat(seat: Seat) : return (seat: Seat, kind: String, user: User, section: Section)
  where seat in dropped and its holder holds no other seat in active
  then
    remove seat from dropped, add seat to active
    return seat, kind, user, section
  where seat not in seats
  then
    refuse SEAT_NOT_FOUND "No such seat exists."
  where seat not in dropped
  then
    refuse SEAT_NOT_DROPPED "This seat is not dropped."
  where seat in dropped and its holder holds another seat in active
  then
    refuse SEAT_ALREADY_ACTIVE "This user already holds an active seat."
removeSeat(seat: Seat) : return (seat: Seat, email: String)
  where seat in seats
  then
    take that seat's own email as email
    remove seat from whichever of pending, active, and dropped holds it
    delete the seat
    return seat, email
  where seat not in seats
  then
    refuse SEAT_NOT_FOUND "No such seat exists."
moveSection(seat: Seat, section: Section) : return (seat: Seat)
  where seat in seats
  then
    set seat's section to section
    return seat
  where seat not in seats
  then
    refuse SEAT_NOT_FOUND "No such seat exists."
```

## Queries

```queries
_getClass () : optional (detail: Class)
  answers the configured Class
  answers no row before the Class is configured

_getSections () : many (section: String, name: String, location: String, meetingPattern: String, status: String)
  answers every section in creation order
  answers no rows when none match

_getSeatByEmail (email: String) : optional (seat: String, email: String)
  answers the Seat carrying the address, compared after trimming and lower-casing both sides
  answers no row when no Seat matches

_getPendingSeatByEmail (email: String) : optional (seat: String, email: String)
  answers the pending, unclaimed Seat carrying the address, compared the same way
  answers no row when no pending Seat matches

_getSeatByUser (user: String) : optional (seat: String, user: String|Null, email: String, kind: String, section: String|Null, status: String)
  answers the User's active Seat when one exists, otherwise their most recently created held Seat
  answers no row when the User holds no Seat

_getSeatDetail (user: String) : optional (detail: Seat)
  answers the complete active Seat when one exists, otherwise the User's most recently created held Seat
  answers no row when the User holds no Seat

_getActiveMembers () : many (user: String|Null, seat: String, kind: String, section: String|Null, email: String)
  answers active seats in creation order
  answers no rows when none match

_isActiveStudent (user: String) : one (active: Boolean)
  answers whether the User holds an active student Seat

_getActiveStudents () : many (user: String, seat: String, section: String|Null, email: String)
  answers linked active student seats in creation order
  answers no rows when none match

_getUnclaimedSeats () : many (seat: String, email: String, kind: String, section: String|Null)
  answers pending unclaimed seats in creation order
  answers no rows when none match

_getDroppedSeats () : many (user: String|Null, seat: String, kind: String, section: String|Null, email: String)
  answers dropped seats in creation order
  answers no rows when none match
```

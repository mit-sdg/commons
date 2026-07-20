# Rostering

## Purpose

Keep one class configuration, its sections, and the pending, active, or dropped
seats held by its members.

## Principle

The class is configured once; a second configuration is refused. An import
creates pending seats for Ana and Ben and skips a later row with Ana's existing
external key. Ana claims her seat and becomes active. Ben cannot claim another
seat while he already holds an active one. Ana's seat may be dropped,
reinstated, or moved to another section.

## State

```state
an optional Class with
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
  an externalKey       String
  an email             String
  a rosterName         String
  a kind               String
  an optional section  Section
  an optional holder   User

a Pending set of Seats
an Active set of Seats
a Dropped set of Seats
```

## Actions

An import row carries an externalKey, an email, a rosterName, a kind, and optionally a section.

```actions
configureClass (code: String, title: String, term: String, timezone: String) : return (class: Class), refuse (message: String)
  where no class is configured
  then
    add a new class with code, title, term, and timezone
    return class
  where a class is already configured
  then
    refuse "The class has already been configured."

createSection (name: String, location: String, meetingPattern: String) : return (section: Section)
  then
    add a new section with name, location, and meetingPattern
    return section

updateSection (section: Section, name: String, location: String, meetingPattern: String) : return (), refuse (message: String)
  where section in sections
  then
    set section's name, location, and meetingPattern
    return
  where section not in sections
  then
    refuse "No such section exists."

previewImport (csv: String) : return (rows: seq of Rows)
  then
    read the first newline-delimited line as comma-delimited headers
    read each later newline-delimited line as comma-delimited values, without quoting or escaping
    return rows

importSeats (rows: seq of Rows) : return (created: seq of Seats, skipped: seq of Strings)
  then
    for each row whose externalKey no seat already carries:
      add a new seat with the row's externalKey, email, rosterName, kind, and section, and no holder
      add the seat to pending
    return the seats created and the externalKeys skipped

claimSeat (seat: Seat, user: User) : return (), refuse (message: String)
  where seat in pending and user holds no seat in active
  then
    set seat's holder to user
    remove seat from pending, add seat to active
    return
  where seat not in seats
  then
    refuse "No such seat exists."
  where seat not in pending
  then
    refuse "This seat is not open to claim."
  where user holds a seat in active
  then
    refuse "This user already holds an active seat."

dropSeat (seat: Seat) : return (), refuse (message: String)
  where seat in active
  then
    remove seat from active, add seat to dropped
    return
  where seat not in seats
  then
    refuse "No such seat exists."
  where seat not in active
  then
    refuse "This seat is not active."

reinstateSeat (seat: Seat) : return (), refuse (message: String)
  where seat in dropped and its holder holds no other seat in active
  then
    remove seat from dropped, add seat to active
    return
  where seat not in seats
  then
    refuse "No such seat exists."
  where seat not in dropped
  then
    refuse "This seat is not dropped."
  where seat in dropped and its holder holds another seat in active
  then
    refuse "This user already holds an active seat."

moveSection (seat: Seat, section: Section) : return (), refuse (message: String)
  where seat in seats
  then
    set seat's section to section
    return
  where seat not in seats
  then
    refuse "No such seat exists."
```

## Questions

- `_getSections ()` answers every section in creation order.
- `_getSeatByExternalKey (externalKey)` answers at most one seat and its roster
  email. `_getSeatByUser (user)` and `_getSeatDetail (user)` each answer at
  most one seat.
- `_getActiveMembers ()` answers active seats in creation order.
- `_isActiveStudent (user)` answers exactly one row with `active`.
- `_getActiveStudents ()` answers linked active student seats in creation
  order.
- `_getUnclaimedSeats ()` answers pending unclaimed seats in creation order.

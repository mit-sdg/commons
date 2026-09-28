# Attending

## Purpose

Show whoever runs a **gathering** its **attendance** as it stands: who has checked in lately, and what each of them is looking at.

Prevents: a host carries on while half the room has stopped following; participants sit on the wrong screen until one of them speaks up.

## Principle

Priya is running round two of a class quiz. Every few seconds each of the forty phones and laptops in the room _attends_ the quiz and says which round it shows. Her screen says two of the forty are still waiting for round two, so she walks over to the two in the back row. Sam's phone goes to sleep, and a minute later Priya's count no longer includes it; when it wakes, it _attends_ again and is counted on round two. At the end Sam closes the page and his phone _leaves_. The page sends _leave_ once more as it goes, and that is refused, since Sam's phone is no longer there.

## Types

```types
external Gathering
  An application-owned identity for the occasion people attend.

external Attendee
  An application-owned identity for one participant checking in, such as a device.
```

## State

```state
a set of Attendances with
  a gathering Gathering
  an attendee Attendee
  a holding   String
  a heardAt   Date

Rule: at most one attendance exists per gathering and attendee.
Rule: holding is what the attendee is looking at, and is empty while it looks at nothing in particular.
Rule: heardAt keeps a grain of twenty seconds: a check-in less than twenty seconds after heardAt with the same holding changes nothing, while a check-in with another holding is recorded at once.
Rule: heardAt never moves backward, so a check-in heard at or before heardAt changes nothing.
Rule: an attendance is eligible for expiry a day after heardAt.
Rule: Attending does not decide who may attend, show anything to attendees, or interpret a holding; how recently an attendee must have been heard to count is chosen by whoever reads the attendance.
```

## Actions

```actions
attend (gathering: Gathering, attendee: Attendee, holding: String, at: Date) : return (attendee: Attendee)
  where no attendance has gathering gathering and attendee attendee
  then
    add a new attendance with gathering, attendee, holding, and heardAt at
    return attendee
  where the attendance of attendee at gathering was heard twenty seconds or more before at, or holds another holding and was heard before at
  then
    set that attendance's holding to holding and its heardAt to at
    return attendee
  where the attendance of attendee at gathering was heard at or after at, or was heard less than twenty seconds before at and holds holding
  then
    return attendee

leave (gathering: Gathering, attendee: Attendee) : return (attendee: Attendee)
  where an attendance has gathering gathering and attendee attendee
  then
    delete that attendance
    return attendee
  where no attendance has gathering gathering and attendee attendee
  then
    refuse NOT_ATTENDING "This participant is not here."
```

## Queries

```queries
_present (gathering: String, since: Date) : many (attendee: String, holding: String, heardAt: Date)
  answers the gathering's attendances heard at or after since, in attendee order
  answers no rows when nobody at the gathering was heard since then
```

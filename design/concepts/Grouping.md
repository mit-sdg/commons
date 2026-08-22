# Grouping

## Purpose

Keep a collection of people identified by an independent group identity with a
mutable title and a non-empty equal-power roster, so members can rename the
group, add members, remove members, or leave the group.

## Principle

Priya creates a "Project" group with herself as member. She adds Omar to the
group. Either Priya or Omar can rename the group to "Final Project". Omar adds
Ana. Priya removes Omar. Ana leaves the group. Priya is the last member, so
removing her or her leaving is refused.

## Types

```types
external Person
  An application-owned identity used in the person role.
```

## State

```state
a set of Groups with
  a title      String
  a members    set of Person
  a createdAt  Date
  a updatedAt  Date

Rule: every group has at least one member.
Rule: members are unique within a group.
Rule: titles need not be unique.
```

## Actions

```actions
create(title: String, creator: Person, at: Date) : return (group: Group)
  where true
  then
    add a new group with title, members containing creator, createdAt at, and updatedAt at
    return group

rename(group: Group, member: Person, title: String, at: Date) : return (group: Group)
  where group in groups and member in group's members
  then
    set group's title to title
    set group's updatedAt to at
    return group
  where group not in groups
  then
    refuse GROUP_NOT_FOUND "There is no such group."
  where group in groups and member not in group's members
  then
    refuse NOT_A_MEMBER "This person is not a member of the group."

addMember(group: Group, member: Person, candidate: Person, at: Date) : return (group: Group)
  where group in groups and member in group's members and candidate not in group's members
  then
    add candidate to group's members
    set group's updatedAt to at
    return group
  where group not in groups
  then
    refuse GROUP_NOT_FOUND "There is no such group."
  where group in groups and member not in group's members
  then
    refuse NOT_A_MEMBER "This person is not a member of the group."
  where group in groups and member in group's members and candidate in group's members
  then
    refuse ALREADY_A_MEMBER "This person is already a member of the group."

removeMember(group: Group, member: Person, target: Person, at: Date) : return (group: Group)
  where group in groups and member in group's members and target in group's members and size of group's members > 1
  then
    remove target from group's members
    set group's updatedAt to at
    return group
  where group not in groups
  then
    refuse GROUP_NOT_FOUND "There is no such group."
  where group in groups and member not in group's members
  then
    refuse NOT_A_MEMBER "This person is not a member of the group."
  where group in groups and member in group's members and target not in group's members
  then
    refuse TARGET_NOT_A_MEMBER "The target person is not a member of the group."
  where group in groups and member in group's members and target in group's members and size of group's members <= 1
  then
    refuse LAST_MEMBER "The final member cannot be removed from the group."

leave(group: Group, member: Person, at: Date) : return (group: Group)
  where group in groups and member in group's members and size of group's members > 1
  then
    remove member from group's members
    set group's updatedAt to at
    return group
  where group not in groups
  then
    refuse GROUP_NOT_FOUND "There is no such group."
  where group in groups and member not in group's members
  then
    refuse NOT_A_MEMBER "This person is not a member of the group."
  where group in groups and member in group's members and size of group's members <= 1
  then
    refuse LAST_MEMBER "The final member cannot leave the group."
```

## Queries

```queries
_getGroup (group: String) : optional (title: String, createdAt: Date, updatedAt: Date)
  answers the group's title and timestamps
  answers no row when the group does not exist

_getMembers (group: String) : many (member: String)
  answers every member in the group
  answers no rows when the group does not exist

_getGroupsOf (member: String) : many (group: String, title: String, createdAt: Date, updatedAt: Date)
  answers every group the member belongs to, in creation order
  answers no rows when the member belongs to no groups

_isMember (group: String, member: String) : one (isMember: Boolean)
  answers whether the person is a member of the group
```

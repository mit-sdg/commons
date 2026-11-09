# Policymaking

## Purpose

Let several people keep named policies, revise them without overwriting one
another's saves, and settle on one as final, with every saved version kept.

Prevents: a save that quietly overwrites a newer save someone else made; a
change nobody can trace to who saved it and when; two policies both treated as
final.

## Principle

Professor Jackson creates a policy named "Course guide" and saves it. Ana
loads it and Ravi loads it too. Ravi saves a change first, so the policy moves
to a new version. When Ana saves her change against the version she loaded,
her save is refused because Ravi saved since; she saves her change as a copy
named "Course guide, Ana" instead, and the original keeps Ravi's version and
every version before it. Professor Jackson marks "Course guide" final; marking
"Course guide, Ana" final later moves the mark, so one policy is final at a
time. A policy that is final can't be removed until another is marked final.

## Types

```types
external Author
  An application-owned identity naming who saved a version.

external Specification
  An application-owned structured value saved without interpretation.
```

## State

```state
a set of Policies with
  a name          String
  a version       Number
  a specification Specification
  an author       Author
  a savedAt       Date
a set of Versions with
  a policy        Policy
  a number        Number
  a specification Specification
  an author       Author
  a savedAt       Date
a Final with
  a policy Policy

Rule: policy names are unique after trimming, and never blank.
Rule: a policy's version, specification, author, and savedAt are those of its latest saved version; every saved version is kept.
Rule: a save names the version it was made from, and the comparison with the policy's current version and the write happen together.
Rule: the final is absent until a policy is marked final, so at most one policy is final, and the final policy cannot be removed.
Rule: Policymaking preserves a specification but does not produce, validate, or interpret it; that belongs to the surrounding design.
```

## Actions

```actions
create (name: String, specification: Specification, author: Author, at: Date) : returns (policy: Policy, version: Number)
  where name is not blank and no policy has name
  then
    add a new policy with name at version 1, with specification, author, and savedAt at
    add its version 1
    returns policy, version
  where name is blank
  then
    refuses POLICY_NAME_REQUIRED "A policy needs a name."
  where a policy has name
  then
    refuses POLICY_NAME_TAKEN "Another policy has this name."

save (policy: Policy, version: Number, specification: Specification, author: Author, at: Date) : returns (policy: Policy, version: Number)
  where policy stands at version
  then
    set policy's version to version plus one, with specification, author, and savedAt at
    add that version
    returns policy, version
  where policy does not exist
  then
    refuses POLICY_NOT_FOUND "There is no such policy."
  where policy has moved past version
  then
    refuses POLICY_STALE "Someone saved a newer version of this policy."

rename (policy: Policy, name: String) : returns (policy: Policy)
  where policy exists, name is not blank, and no other policy has name
  then
    set policy's name to name
    returns policy
  where policy does not exist
  then
    refuses POLICY_NOT_FOUND "There is no such policy."
  where name is blank
  then
    refuses POLICY_NAME_REQUIRED "A policy needs a name."
  where another policy has name
  then
    refuses POLICY_NAME_TAKEN "Another policy has this name."

remove (policy: Policy) : returns (policy: Policy)
  where policy exists and is not final
  then
    delete policy and its versions
    returns policy
  where policy does not exist
  then
    refuses POLICY_NOT_FOUND "There is no such policy."
  where policy is final
  then
    refuses POLICY_IS_FINAL "Mark another policy final before removing this one."

markFinal (policy: Policy) : returns (policy: Policy)
  where policy exists
  then
    set final to policy
    returns policy
  where policy does not exist
  then
    refuses POLICY_NOT_FOUND "There is no such policy."
```

## Queries

```queries
_policies () : many (policy: String, name: String, version: Number, author: String, savedAt: Date, final: Flag)
  answers every policy in name order
  answers no rows when none exist

_policy (policy: String) : optional (name: String, version: Number, specification: Specification, author: String, savedAt: Date, final: Flag)
  answers the policy at its current version
  answers no row when the policy does not exist

_version (policy: String, version: Number) : optional (specification: Specification, author: String, savedAt: Date)
  answers one saved version of the policy
  answers no row when the policy or the version does not exist

_final () : optional (policy: String, name: String, version: Number, specification: Specification)
  answers the final policy at its current version
  answers no row when no policy is final
```

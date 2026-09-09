# Accessing

## Purpose

Establish the complete set of holders for a resource and keep that choice until
the resource's access is retired.

Prevents: a reader seeing only part of an initial choice; a second establishment
silently replacing the holders; delayed establishment reopening retired access.

## Principle

Mira establishes access to a room for Omar and Lee together. She queries its
holders and finds both. An attempt to establish the room again for Ravi is
refused, leaving Omar and Lee in place. When the room closes, Mira retires its
access. Its holders query then returns no row. Repeating retirement succeeds,
but a delayed establishment for the same room is refused. Retiring another room
before any establishment also keeps a delayed establishment from opening it.

## Types

```types
external Resource
  The identity whose access is established; its existence is supplied externally.
external Holder
  An identity named in the choice; its interpretation is supplied externally.
```

## State

```state
a set of Establishments with
  a resource Resource
  a holders set of Holder
a set of Retirements with
  a resource Resource

Rule: a resource has at most one establishment or retirement, never both.
Rule: establishment makes the entire holder set visible atomically and it never changes.
Rule: an empty holder set establishes access for nobody.
Rule: retirement removes holders and permanently prevents establishment for that resource identity.
```

## Actions

```actions
establish(resource: Resource, holders: Seq) : return (resource: Resource)
  where resource has neither an establishment nor a retirement
  then
    add one establishment with resource and the complete set of holders
    return resource
  where resource has an establishment or a retirement
  then
    refuse ACCESS_ALREADY_ESTABLISHED "Access has already been established or retired."

retire(resource: Resource) : return (resource: Resource)
  where true
  then
    remove any establishment for resource
    retain a retirement for resource
    return resource
```

## Queries

```queries
_grants (resource: Resource) : many (holder: Holder)
  answers each explicit holder from one complete audience observation, or no rows when absent or retired

_isRetired (resource: Resource) : one (retired: Boolean)
  answers whether the resource is permanently retired, including retirement before establishment

_holders (resource: Resource) : optional (holders: Seq)
  Answers the complete established holder set in identity order; no row before establishment or after retirement.
```

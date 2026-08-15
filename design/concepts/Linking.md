# Linking

## Purpose

Record the ordered targets that a source links to, and support reading or
removing those links from either direction.

## Principle

Noor's guide links to two worksheets, which are returned in the order she named
them. After she edits the guide to link to one worksheet, setting the links
replaces the previous list. Clearing a discarded worksheet's backlinks removes
it from every source. Clearing links that do not exist still succeeds.

## Types

```types
external Source
  An application-owned identity used in the source role.

external Target
  An application-owned identity used in the target role.
```

## State

```state
a set of Sources with
  a links Targetss
```

## Actions

```actions
setLinks(source: Source, targets: Targets) : return (source: Source)
  where true
  then
    set source's links to targets, replacing any prior links
    return source
setLinksFrom(source: Source, content: String) : return (source: Source)
  where true
  then
    read each nonempty target between [[ and ]] from left to right
    set source's links to those targets in that order, preserving repeats
    return source


clearLinks(source: Source) : return (source: Source)
  where true
  then
    remove all of source's links
    return source
clearBacklinks(target: Target) : return (target: Target)
  where true
  then
    remove target from every source's links
    return target
```

## Queries

```queries
_getLinks (source: String) : many (target: String)
  answers the source's targets in their stated order
  answers no rows when none match

_getBacklinks (target: String) : many (source: String)
  answers every source that links to the target, in source creation order
  answers no rows when none match
```

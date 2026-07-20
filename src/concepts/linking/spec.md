# Linking

## Purpose

Record the ordered targets that a source links to, and support reading or
removing those links from either direction.

## Principle

Noor's guide links to two worksheets, which are returned in the order she named
them. After she edits the guide to link to one worksheet, setting the links
replaces the previous list. Clearing a discarded worksheet's backlinks removes
it from every source. Clearing links that do not exist still succeeds.

## State

```state
a set of Sources with
  a links seq of Targets
```

## Actions

```actions
setLinks (source: Source, targets: seq of Target) : return ()
  then
    set source's links to targets, replacing any prior links
    return

setLinksFrom (source: Source, content: String) : return ()
  then
    read each nonempty target between [[ and ]] from left to right
    set source's links to those targets in that order, preserving repeats
    return

clearLinks (source: Source) : return ()
  then
    remove all of source's links
    return

clearBacklinks (target: Target) : return ()
  then
    remove target from every source's links
    return
```

## Questions

- `_getLinks (source)` answers the source's targets in their stated order.
- `_getBacklinks (target)` answers every source that links to the target, in
  source creation order.

Backlinks are derived from the stored forward links.
